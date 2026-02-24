#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# pipeline-state.json 検索（feature dir 内） — TS helper が作成した正規フォーマットのみ有効
HAS_VALID_PIPELINE=false
while IFS= read -r state_file; do
  # TS helper (FilePipelineStateManager.init()) は必ず flow フィールドを設定する
  # (src/lib/pipeline-state.ts L72-87: flow は init() の必須引数)
  if jq -e '.flow' "$state_file" >/dev/null 2>&1; then
    HAS_VALID_PIPELINE=true
    break
  fi
done < <(find "$CWD/features" -name "pipeline-state.json" -maxdepth 3 2>/dev/null)

if [[ "$HAS_VALID_PIPELINE" == "false" ]]; then
  if [[ "$FILE_PATH" =~ \.(html|js|jsx|ts|tsx|css|py|vue|svelte)$ ]]; then
    if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "BLOCKED: pipeline-state.json が見つかりません。実装ファイルの直接書き込みは禁止です。Core Loop (node .poor-dev/dist/bin/poor-dev-next.js) を実行してパイプラインを開始してください。"
        }
      }'
      exit 0
    fi
  fi
fi
exit 0
