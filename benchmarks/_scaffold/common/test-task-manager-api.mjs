#!/usr/bin/env node

// test-task-manager-api.mjs
// Automated test script for Task Manager API benchmark validation.
// Usage: node test-task-manager-api.mjs <project-dir>

import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CANDIDATE_PORTS = [3000, 3001, 8080];
const CANDIDATE_TASK_PATHS = ["/api/tasks", "/tasks", "/api/v1/tasks"];
const CANDIDATE_AUTH_PATHS = ["/api/auth", "/auth", "/api/v1/auth"];
const SERVER_START_TIMEOUT_MS = 10_000;
const SERVER_POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @type {import("node:child_process").ChildProcess | null} */
let serverProcess = null;

function killServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 2000);
  }
}

process.on("exit", killServer);
process.on("SIGINT", () => { killServer(); process.exit(1); });
process.on("SIGTERM", () => { killServer(); process.exit(1); });
process.on("uncaughtException", (err) => {
  process.stderr.write(`Uncaught exception: ${err.message}\n`);
  killServer();
  process.exit(1);
});

/**
 * Fetch with timeout via AbortController.
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} [options]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOpts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wait until a TCP port responds to an HTTP request.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function waitForPort(port) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetchWithTimeout(`http://localhost:${port}/`, { timeoutMs: 2000 });
      return true;
    } catch {
      // Connection refused or timeout — keep polling
    }
    await new Promise((r) => setTimeout(r, SERVER_POLL_INTERVAL_MS));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

/** @type {Array<{ name: string; passed: boolean; error?: string }>} */
const results = [];

/**
 * Extract task ID from an API response body, handling common field name variations.
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
function extractTaskId(body) {
  const raw = body.id || body.taskId || body.task_id || (body.task && body.task.id) || "";
  return String(raw);
}

/**
 * Register a test result.
 * @param {string} name
 * @param {boolean} passed
 * @param {string} [error]
 */
function record(name, passed, error) {
  const entry = { name, passed };
  if (!passed && error) entry.error = error;
  results.push(entry);
}

/**
 * Run a single test case, catching all errors.
 * @param {string} name
 * @param {() => Promise<void>} fn
 */
async function runTest(name, fn) {
  try {
    await fn();
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// Discovery: find the live base URL and path prefixes
// ---------------------------------------------------------------------------

/**
 * Try candidate ports and path prefixes to find the working server.
 * @returns {Promise<{ baseUrl: string; taskPath: string; authPath: string }>}
 */
async function discoverEndpoints() {
  let baseUrl = "";
  let taskPath = "";
  let authPath = "";

  // 1. Find which port responds
  for (const port of CANDIDATE_PORTS) {
    const alive = await waitForPort(port);
    if (alive) {
      baseUrl = `http://localhost:${port}`;
      break;
    }
  }
  if (!baseUrl) {
    throw new Error(
      `Server did not start on any candidate port (${CANDIDATE_PORTS.join(", ")}) within ${SERVER_START_TIMEOUT_MS}ms`
    );
  }

  // 2. Find task endpoint path — try a POST (create) and GET; accept anything that is not a 404
  for (const path of CANDIDATE_TASK_PATHS) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // Accept any status that is NOT 404 — even 401 means the route exists
      if (res.status !== 404) {
        taskPath = path;
        break;
      }
    } catch {
      // ignore
    }
  }
  if (!taskPath) {
    // Fallback to first candidate
    taskPath = CANDIDATE_TASK_PATHS[0];
  }

  // 3. Find auth endpoint path
  for (const path of CANDIDATE_AUTH_PATHS) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}${path}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "probe@test.com", password: "probe" }),
      });
      if (res.status !== 404) {
        authPath = path;
        break;
      }
    } catch {
      // ignore
    }
  }
  if (!authPath) {
    authPath = CANDIDATE_AUTH_PATHS[0];
  }

  return { baseUrl, taskPath, authPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // --- Validate arguments ---------------------------------------------------
  const projectDir = process.argv[2];
  if (!projectDir) {
    process.stderr.write("Usage: node test-task-manager-api.mjs <project-dir>\n");
    process.exit(1);
  }

  const absDir = resolve(projectDir);
  if (!existsSync(absDir)) {
    process.stderr.write(`Project directory does not exist: ${absDir}\n`);
    process.exit(1);
  }

  // --- npm install ----------------------------------------------------------
  const packageJsonPath = join(absDir, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      execSync("npm install --production", { cwd: absDir, stdio: "pipe", timeout: 60_000 });
    } catch (err) {
      process.stderr.write(`npm install failed: ${err.message}\n`);
    }
  }

  // --- Find server entry point ----------------------------------------------
  const serverCandidates = ["server.js", "index.js", "app.js", "src/server.js", "src/index.js", "src/app.js"];
  let serverEntry = "";
  for (const c of serverCandidates) {
    if (existsSync(join(absDir, c))) {
      serverEntry = c;
      break;
    }
  }
  if (!serverEntry) {
    // Check package.json "main" or "scripts.start"
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (pkg.main) serverEntry = pkg.main;
      else if (pkg.scripts?.start) {
        // Extract the node command target, e.g. "node src/server.js" -> "src/server.js"
        const match = pkg.scripts.start.match(/node\s+(\S+)/);
        if (match) serverEntry = match[1];
      }
    } catch {
      // ignore
    }
  }
  if (!serverEntry) {
    process.stderr.write("Could not find server entry point (server.js, index.js, app.js)\n");
    process.exit(1);
  }

  // --- Start server ---------------------------------------------------------
  serverProcess = spawn("node", [serverEntry], {
    cwd: absDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PORT: "3000", NODE_ENV: "test" },
  });

  serverProcess.on("error", (err) => {
    process.stderr.write(`Server process error: ${err.message}\n`);
  });

  // Capture stderr for diagnostics but do not print it unless needed
  let serverStderr = "";
  serverProcess.stderr.on("data", (chunk) => { serverStderr += chunk.toString(); });

  // --- Discover endpoints ---------------------------------------------------
  let baseUrl, taskPath, authPath;
  try {
    ({ baseUrl, taskPath, authPath } = await discoverEndpoints());
  } catch (err) {
    process.stderr.write(`Endpoint discovery failed: ${err.message}\n`);
    if (serverStderr) process.stderr.write(`Server stderr:\n${serverStderr}\n`);
    killServer();
    // Output empty results
    const output = { passed: 0, failed: 0, total: 0, details: [] };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Helper: build full URL for auth and task endpoints
  // -------------------------------------------------------------------------
  const authUrl = (path) => `${baseUrl}${authPath}${path}`;
  const taskUrl = (path = "") => `${baseUrl}${taskPath}${path}`;

  const uniqueEmail = `test_${Date.now()}@example.com`;
  const testPassword = "TestP@ss123";
  let accessToken = "";
  let refreshToken = "";
  let createdTaskId = "";

  // =========================================================================
  // AUTH TESTS (FR-001, FR-002, FR-003)
  // =========================================================================

  // --- Register new user ----------------------------------------------------
  await runTest("register new user", async () => {
    const res = await fetchWithTimeout(authUrl("/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueEmail, password: testPassword }),
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200 or 201 but got ${res.status}`);
    }
    record("register new user", true);
  });

  // --- Duplicate email registration -----------------------------------------
  await runTest("duplicate email registration", async () => {
    const res = await fetchWithTimeout(authUrl("/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueEmail, password: testPassword }),
    });
    if (res.status !== 409 && res.status !== 400) {
      throw new Error(`Expected 409 or 400 but got ${res.status}`);
    }
    record("duplicate email registration", true);
  });

  // --- Login success --------------------------------------------------------
  await runTest("login success", async () => {
    const res = await fetchWithTimeout(authUrl("/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueEmail, password: testPassword }),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    const body = await res.json();
    // Accept various token field names
    accessToken =
      body.accessToken || body.access_token || body.token || "";
    refreshToken =
      body.refreshToken || body.refresh_token || "";
    if (!accessToken) {
      throw new Error("Response missing access token field");
    }
    record("login success", true);
  });

  // --- Login wrong password -------------------------------------------------
  await runTest("login wrong password", async () => {
    const res = await fetchWithTimeout(authUrl("/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueEmail, password: "WrongP@ss999" }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401 but got ${res.status}`);
    }
    record("login wrong password", true);
  });

  // --- Token refresh --------------------------------------------------------
  await runTest("token refresh", async () => {
    // Some APIs use a dedicated /refresh endpoint, others use /token
    const refreshPaths = ["/refresh", "/token", "/refresh-token"];
    let refreshed = false;
    for (const rp of refreshPaths) {
      try {
        const payload = refreshToken
          ? { refreshToken, refresh_token: refreshToken }
          : {};
        const res = await fetchWithTimeout(authUrl(rp), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 200) {
          const body = await res.json();
          const newToken = body.accessToken || body.access_token || body.token || "";
          if (newToken) {
            accessToken = newToken;
            refreshed = true;
            break;
          }
        }
      } catch {
        // try next path
      }
    }
    if (!refreshed) {
      throw new Error("Token refresh failed on all candidate paths");
    }
    record("token refresh", true);
  });

  // =========================================================================
  // CRUD TESTS (FR-004, FR-005, FR-006)
  // =========================================================================

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  });

  // --- Create task ----------------------------------------------------------
  await runTest("create task", async () => {
    const res = await fetchWithTimeout(taskUrl(""), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: "Test Task",
        description: "Created by automated test",
        status: "todo",
        priority: "medium",
      }),
    });
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Expected 201 but got ${res.status}`);
    }
    const body = await res.json();
    createdTaskId = extractTaskId(body);
    if (!createdTaskId) {
      throw new Error("Response missing task ID");
    }
    record("create task", true);
  });

  // --- List tasks -----------------------------------------------------------
  await runTest("list tasks", async () => {
    const res = await fetchWithTimeout(taskUrl(""), {
      method: "GET",
      headers: authHeaders(),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    const body = await res.json();
    const tasks = Array.isArray(body) ? body : body.tasks || body.data || [];
    if (!Array.isArray(tasks)) {
      throw new Error("Response is not an array of tasks");
    }
    record("list tasks", true);
  });

  // --- Update task ----------------------------------------------------------
  await runTest("update task", async () => {
    if (!createdTaskId) throw new Error("No task ID from create step");
    const res = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ title: "Updated Task Title" }),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    record("update task", true);
  });

  // --- Status change (todo -> in-progress -> done) --------------------------
  await runTest("status change todo to in-progress", async () => {
    if (!createdTaskId) throw new Error("No task ID from create step");
    const res = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status: "in-progress" }),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    // Verify the update by fetching the task
    const getRes = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
      method: "GET",
      headers: authHeaders(),
    });
    if (getRes.status === 200) {
      const task = await getRes.json();
      const taskData = task.task || task;
      const status = taskData.status;
      if (status && status !== "in-progress") {
        throw new Error(`Expected status 'in-progress' but got '${status}'`);
      }
    }
    record("status change todo to in-progress", true);
  });

  await runTest("status change in-progress to done", async () => {
    if (!createdTaskId) throw new Error("No task ID from create step");
    const res = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status: "done" }),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    record("status change in-progress to done", true);
  });

  // --- Priority setting -----------------------------------------------------
  await runTest("priority setting", async () => {
    if (!createdTaskId) throw new Error("No task ID from create step");
    for (const priority of ["high", "low"]) {
      const res = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ priority }),
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200 setting priority '${priority}' but got ${res.status}`);
      }
    }
    record("priority setting", true);
  });

  // =========================================================================
  // SECURITY TESTS (FR-013, FR-014)
  // =========================================================================

  // --- SQL injection test ---------------------------------------------------
  await runTest("sql injection prevention", async () => {
    const sqliTitle = "' OR '1'='1";
    const createRes = await fetchWithTimeout(taskUrl(""), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: sqliTitle,
        description: "SQLi test",
        status: "todo",
        priority: "low",
      }),
    });
    // Accept either success (stored as literal string) or 400 (rejected)
    if (createRes.status === 201 || createRes.status === 200) {
      const body = await createRes.json();
      const taskId = extractTaskId(body);
      if (taskId) {
        // Verify stored value is the literal string, not interpreted as SQL
        const getRes = await fetchWithTimeout(taskUrl(`/${taskId}`), {
          method: "GET",
          headers: authHeaders(),
        });
        if (getRes.status === 200) {
          const task = await getRes.json();
          const taskData = task.task || task;
          const storedTitle = taskData.title;
          if (storedTitle !== sqliTitle) {
            throw new Error(
              `SQL injection: stored title '${storedTitle}' differs from input '${sqliTitle}'`
            );
          }
        }
        // Clean up the test task
        await fetchWithTimeout(taskUrl(`/${taskId}`), {
          method: "DELETE",
          headers: authHeaders(),
        }).catch(() => {});
      }
      record("sql injection prevention", true);
    } else if (createRes.status === 400 || createRes.status === 422) {
      // Server rejected the input — also acceptable
      record("sql injection prevention", true);
    } else {
      throw new Error(`Unexpected status ${createRes.status} for SQLi payload`);
    }
  });

  // --- Auth bypass test -----------------------------------------------------
  await runTest("auth bypass prevention", async () => {
    const res = await fetchWithTimeout(taskUrl(""), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // No Authorization header
    });
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`Expected 401 or 403 but got ${res.status}`);
    }
    record("auth bypass prevention", true);
  });

  // =========================================================================
  // FILTERING TESTS (FR-009)
  // =========================================================================

  // Create helper tasks for filtering
  const filterTaskIds = [];

  async function createFilterTask(title, status, priority) {
    const res = await fetchWithTimeout(taskUrl(""), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title, description: "Filter test", status, priority }),
    });
    if (res.status === 201 || res.status === 200) {
      const body = await res.json();
      const id = extractTaskId(body);
      if (id) filterTaskIds.push(id);
      return id;
    }
    return "";
  }

  // Pre-create tasks with known statuses and priorities for filtering tests
  await createFilterTask("Filter Todo High", "todo", "high");
  await createFilterTask("Filter Todo Low", "todo", "low");
  await createFilterTask("Filter Done High", "done", "high");

  // --- Status filter --------------------------------------------------------
  await runTest("filter by status", async () => {
    const res = await fetchWithTimeout(taskUrl("?status=todo"), {
      method: "GET",
      headers: authHeaders(),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    const body = await res.json();
    const tasks = Array.isArray(body) ? body : body.tasks || body.data || [];
    if (!Array.isArray(tasks)) {
      throw new Error("Response is not an array");
    }
    // Verify all returned tasks have status "todo"
    const nonTodo = tasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s !== "todo";
    });
    if (nonTodo.length > 0) {
      throw new Error(
        `Filter returned ${nonTodo.length} task(s) with non-todo status`
      );
    }
    record("filter by status", true);
  });

  // --- Priority filter ------------------------------------------------------
  await runTest("filter by priority", async () => {
    const res = await fetchWithTimeout(taskUrl("?priority=high"), {
      method: "GET",
      headers: authHeaders(),
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }
    const body = await res.json();
    const tasks = Array.isArray(body) ? body : body.tasks || body.data || [];
    if (!Array.isArray(tasks)) {
      throw new Error("Response is not an array");
    }
    const nonHigh = tasks.filter((t) => {
      const p = (t.priority || "").toLowerCase();
      return p !== "high";
    });
    if (nonHigh.length > 0) {
      throw new Error(
        `Filter returned ${nonHigh.length} task(s) with non-high priority`
      );
    }
    record("filter by priority", true);
  });

  // =========================================================================
  // DELETE TEST (FR-004)
  // =========================================================================

  await runTest("delete task", async () => {
    if (!createdTaskId) throw new Error("No task ID from create step");
    const res = await fetchWithTimeout(taskUrl(`/${createdTaskId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.status !== 200 && res.status !== 204) {
      throw new Error(`Expected 200 or 204 but got ${res.status}`);
    }
    record("delete task", true);
  });

  // =========================================================================
  // Cleanup filter tasks
  // =========================================================================
  for (const id of filterTaskIds) {
    await fetchWithTimeout(taskUrl(`/${id}`), {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {});
  }

  // =========================================================================
  // OUTPUT RESULTS
  // =========================================================================

  killServer();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const output = {
    passed,
    failed,
    total: results.length,
    details: results,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

main();
