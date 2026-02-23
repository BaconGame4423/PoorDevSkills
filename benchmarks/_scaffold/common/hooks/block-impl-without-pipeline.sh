#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# pipeline-state.json 検索（feature dir 内）
HAS_PIPELINE=false
if find "$CWD/features" -name "pipeline-state.json" -maxdepth 3 2>/dev/null | grep -q .; then
  HAS_PIPELINE=true
fi

if [[ "$HAS_PIPELINE" == "false" ]]; then
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
