#!/usr/bin/env node
// qwen-thinking-proxy.mjs — llama.cpp Anthropic API の thinking ブロックを除去するリバースプロキシ
//
// llama.cpp は全レスポンスに thinking ブロック (signature: "") を含むが、
// Claude Code はこれを次リクエストに含めて Anthropic API に送信 → Invalid signature エラー。
// このプロキシはレスポンスから thinking ブロックを除去し、マルチターン会話を可能にする。
//
// Usage:
//   UPSTREAM_URL=http://10.8.2.1:8080 PORT=8081 node scripts/qwen-thinking-proxy.mjs
//
// Architecture:
//   Claude Code → Proxy (localhost:8081) → llama.cpp (10.8.2.1:8080)

import http from 'node:http';

if (!process.env.UPSTREAM_URL) {
  console.error('環境変数 UPSTREAM_URL を設定してください (例: http://10.x.x.x:8080)');
  process.exit(1);
}
const UPSTREAM_URL = process.env.UPSTREAM_URL;
const PORT = parseInt(process.env.PORT || '8081', 10);
const upstream = new URL(UPSTREAM_URL);

let requestCount = 0;

const server = http.createServer(async (req, res) => {
  const id = ++requestCount;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] #${id} ${req.method} ${req.url}`);

  // Collect request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  // Build upstream request
  const headers = { ...req.headers, host: upstream.host };
  // Remove hop-by-hop headers
  delete headers['connection'];
  delete headers['keep-alive'];

  const proxyReq = http.request(
    {
      hostname: upstream.hostname,
      port: upstream.port,
      path: req.url,
      method: req.method,
      headers,
      timeout: 7_200_000, // 2h — ローカル 122B は長時間推論あり
    },
    (proxyRes) => {
      const ct = proxyRes.headers['content-type'] || '';

      if (ct.includes('text/event-stream')) {
        handleStreaming(id, proxyRes, res);
      } else if (ct.includes('application/json')) {
        handleJSON(id, proxyRes, res);
      } else {
        // Pass through (health, etc.)
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    }
  );

  // クライアント切断時に upstream も abort → llama.cpp スロット解放
  // req.socket (= res.socket) の close でクライアント切断を検出
  res.on('close', () => {
    if (!res.writableFinished) {
      console.log(`[${ts}] #${id} client disconnected`);
      proxyReq.destroy(new Error('client disconnected'));
    }
  });

  proxyReq.on('error', (err) => {
    if (err.message === 'client disconnected') {
      // Already logged above; don't send error response to closed client
      return;
    }
    console.error(`[${ts}] #${id} upstream error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `Upstream error: ${err.message}` } }));
    }
  });

  proxyReq.on('timeout', () => {
    console.error(`[${ts}] #${id} upstream timeout`);
    proxyReq.destroy(new Error('upstream timeout'));
  });

  if (body.length > 0) proxyReq.write(body);
  proxyReq.end();
});

// ── Streaming (SSE) handler ──────────────────────────────────────────────
const STALL_TIMEOUT = 300_000; // 5分 — llama.cpp がスタックした場合の自動 abort

function handleStreaming(id, proxyRes, res) {
  const responseHeaders = { ...proxyRes.headers };
  // Ensure chunked transfer for streaming
  delete responseHeaders['content-length'];
  res.writeHead(proxyRes.statusCode, responseHeaders);

  const thinkingIndices = new Set();
  let stripped = 0;
  let buffer = '';
  const startTime = Date.now();
  let totalBytes = 0;
  let lastLogBytes = 0;
  let lastLog = startTime;

  // ストリーミングストール検出: データが STALL_TIMEOUT 間来なければ abort
  let stallTimer = setTimeout(onStall, STALL_TIMEOUT);

  function onStall() {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`  #${id} stall detected: no data for ${STALL_TIMEOUT / 1000}s (total ${elapsed}s, ${(totalBytes / 1024).toFixed(1)}KB)`);
    proxyRes.destroy(new Error('upstream stall'));
    if (!res.writableEnded) res.end();
  }

  proxyRes.on('data', (chunk) => {
    // ストールタイマーリセット
    clearTimeout(stallTimer);
    stallTimer = setTimeout(onStall, STALL_TIMEOUT);

    buffer += chunk.toString();
    totalBytes += chunk.length;
    const now = Date.now();
    if (now - lastLog >= 30_000) {
      const elapsed = Math.round((now - startTime) / 1000);
      const deltaKB = ((totalBytes - lastLogBytes) / 1024).toFixed(1);
      console.log(`  #${id} streaming: ${elapsed}s elapsed, ${(totalBytes / 1024).toFixed(1)}KB total (+${deltaKB}KB/30s)`);
      lastLogBytes = totalBytes;
      lastLog = now;
    }

    // Process complete SSE events (delimited by \n\n)
    let pos = 0;
    while (pos < buffer.length) {
      const boundary = buffer.indexOf('\n\n', pos);
      if (boundary === -1) break;

      const eventText = buffer.slice(pos, boundary);
      pos = boundary + 2;

      const result = processSSEEvent(eventText, thinkingIndices);
      if (result !== null) {
        res.write(result + '\n\n');
      } else {
        stripped++;
      }
    }
    buffer = buffer.slice(pos);
  });

  proxyRes.on('end', () => {
    clearTimeout(stallTimer);
    // Flush remaining buffer
    if (buffer.trim()) {
      const result = processSSEEvent(buffer.trim(), thinkingIndices);
      if (result !== null) {
        res.write(result + '\n\n');
      }
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  #${id} complete: ${elapsed}s, ${(totalBytes / 1024).toFixed(1)}KB, stripped ${stripped} thinking events`);
    res.end();
  });

  proxyRes.on('error', (err) => {
    clearTimeout(stallTimer);
    console.error(`  #${id} stream error: ${err.message}`);
    if (!res.writableEnded) res.end();
  });
}

function processSSEEvent(eventText, thinkingIndices) {
  // Parse SSE fields
  let eventType = '';
  const dataLines = [];

  for (const line of eventText.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
    // Ignore other fields (id:, retry:, comments)
  }

  const dataStr = dataLines.join('\n');
  if (!dataStr || dataStr === '[DONE]') {
    // Pass through ping, done, and non-data events
    return eventText;
  }

  let parsed;
  try {
    parsed = JSON.parse(dataStr);
  } catch {
    return eventText; // Unparseable — pass through
  }

  switch (eventType) {
    case 'content_block_start': {
      const blockType = parsed.content_block?.type;
      if (blockType === 'thinking') {
        thinkingIndices.add(parsed.index);
        return null;
      }
      parsed.index = adjustIndex(parsed.index, thinkingIndices);
      break;
    }
    case 'content_block_delta': {
      if (thinkingIndices.has(parsed.index)) return null;
      parsed.index = adjustIndex(parsed.index, thinkingIndices);
      break;
    }
    case 'content_block_stop': {
      if (thinkingIndices.has(parsed.index)) return null;
      parsed.index = adjustIndex(parsed.index, thinkingIndices);
      break;
    }
    case 'message_start': {
      // Safety: filter thinking from initial message content (usually empty)
      if (Array.isArray(parsed.message?.content)) {
        parsed.message.content = parsed.message.content.filter(
          (b) => b.type !== 'thinking'
        );
      }
      break;
    }
    default:
      // message_delta, message_stop, ping, error — pass through
      return eventText;
  }

  return `event: ${eventType}\ndata: ${JSON.stringify(parsed)}`;
}

function adjustIndex(index, thinkingIndices) {
  let offset = 0;
  for (const ti of thinkingIndices) {
    if (ti < index) offset++;
  }
  return index - offset;
}

// ── Non-streaming (JSON) handler ─────────────────────────────────────────
function handleJSON(id, proxyRes, res) {
  const chunks = [];
  proxyRes.on('data', (chunk) => chunks.push(chunk));
  proxyRes.on('end', () => {
    const raw = Buffer.concat(chunks).toString();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not valid JSON — pass through
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.end(raw);
      return;
    }

    // Filter thinking blocks from content array
    let stripped = 0;
    if (Array.isArray(parsed.content)) {
      const before = parsed.content.length;
      parsed.content = parsed.content.filter((b) => b.type !== 'thinking');
      stripped = before - parsed.content.length;
    }

    if (stripped > 0) {
      console.log(`  #${id} stripped ${stripped} thinking blocks (non-streaming)`);
    }

    const filtered = JSON.stringify(parsed);
    const responseHeaders = { ...proxyRes.headers };
    responseHeaders['content-length'] = Buffer.byteLength(filtered).toString();
    res.writeHead(proxyRes.statusCode, responseHeaders);
    res.end(filtered);
  });

  proxyRes.on('error', (err) => {
    console.error(`  #${id} JSON response error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: err.message } }));
  });
}

// ── Start ────────────────────────────────────────────────────────────────
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Thinking-strip proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`Upstream: ${UPSTREAM_URL}`);
  console.log('');
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\nReceived ${sig}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
