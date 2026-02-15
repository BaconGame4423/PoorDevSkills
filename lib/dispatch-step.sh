#!/usr/bin/env bash
set -euo pipefail
# Usage: dispatch-step.sh <step> <project_dir> <prompt_file> [idle_timeout] [max_timeout] [result_file]
#
# Wraps a single dispatch cycle:
#   1. Resolves CLI/model via config-resolver.sh
#   2. Generates dispatch command file with correct working directory
#   3. Executes via poll-dispatch.sh
#   4. Passes through JSON summary on stdout
#
# stdout: poll-dispatch.sh JSON summary (transparent passthrough)
# exit code: poll-dispatch.sh exit code (transparent passthrough)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STEP="${1:?Usage: dispatch-step.sh <step> <project_dir> <prompt_file> [idle_timeout] [max_timeout]}"
PROJECT_DIR="${2:?Usage: dispatch-step.sh <step> <project_dir> <prompt_file> [idle_timeout] [max_timeout]}"
PROMPT_FILE="${3:?Usage: dispatch-step.sh <step> <project_dir> <prompt_file> [idle_timeout] [max_timeout]}"
IDLE_TIMEOUT="${4:-120}"
MAX_TIMEOUT="${5:-600}"
RESULT_FILE="${6:-}"

# Resolve to absolute paths
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
PROMPT_FILE="$(cd "$(dirname "$PROMPT_FILE")" && pwd)/$(basename "$PROMPT_FILE")"

# --- Validate inputs ---

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Project directory not found: '"$PROJECT_DIR"'"],"clarifications":[]}' >&2
  exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Prompt file not found: '"$PROMPT_FILE"'"],"clarifications":[]}' >&2
  exit 1
fi

# --- Resolve CLI/model ---

CONFIG_PATH="$PROJECT_DIR/.poor-dev/config.json"
if [[ ! -f "$CONFIG_PATH" ]]; then
  CONFIG_PATH=""
fi

RESOLVED=$(bash "$SCRIPT_DIR/config-resolver.sh" "$STEP" ${CONFIG_PATH:+"$CONFIG_PATH"})
CLI=$(echo "$RESOLVED" | jq -r '.cli')
MODEL=$(echo "$RESOLVED" | jq -r '.model')

if [[ -z "$CLI" || "$CLI" == "null" ]]; then
  echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Failed to resolve CLI for step: '"$STEP"'"],"clarifications":[]}' >&2
  exit 1
fi

# --- Generate command file ---

CMD_FILE="/tmp/poor-dev-cmd-${STEP}-$$.sh"
OUTPUT_FILE="/tmp/poor-dev-output-${STEP}-$$.txt"
PROGRESS_FILE="/tmp/poor-dev-progress-${STEP}-$$.txt"

case "$CLI" in
  opencode)
    cat > "$CMD_FILE" <<CMDEOF
#!/usr/bin/env bash
cd "$PROJECT_DIR" && opencode run --model "$MODEL" --format json "\$(cat "$PROMPT_FILE")"
CMDEOF
    ;;
  claude)
    cat > "$CMD_FILE" <<CMDEOF
#!/usr/bin/env bash
cd "$PROJECT_DIR" && cat "$PROMPT_FILE" | env -u CLAUDECODE claude -p --model "$MODEL" --no-session-persistence --output-format text
CMDEOF
    ;;
  *)
    echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Unknown CLI: '"$CLI"'"],"clarifications":[]}' >&2
    exit 1
    ;;
esac

chmod +x "$CMD_FILE"

# --- Execute via poll-dispatch.sh ---

bash "$SCRIPT_DIR/poll-dispatch.sh" "$CMD_FILE" "$OUTPUT_FILE" "$PROGRESS_FILE" "$IDLE_TIMEOUT" "$MAX_TIMEOUT" "$STEP" "$RESULT_FILE"
EXIT_CODE=$?

# Cleanup temp files (output/progress are consumed by caller if needed)
rm -f "$CMD_FILE"

exit $EXIT_CODE
