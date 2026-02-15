#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Usage: intake.sh --flow <flow> --project-dir <dir> [--input-file <file>]
#
# Reads user input from stdin (heredoc) or --input-file, then:
#   1. Generates short-name from input text
#   2. Creates branch + feature directory via branch-setup.sh
#   3. Saves input to feature_dir/input.txt
#   4. Launches pipeline-runner.sh (including specify) in background
#
# stdin: user input text (via heredoc)
# stdout: JSONL progress events
# exit code: 0=complete, 1=error

# --- Argument parsing ---

FLOW=""
INPUT_FILE=""
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow)        FLOW="$2"; shift 2 ;;
    --input-file)  INPUT_FILE="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *)             echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
: "${FLOW:?--flow is required}"

# --- Read user input from stdin or --input-file ---

TEMP_INPUT="/tmp/poor-dev-intake-input-$$.txt"
if [[ -n "$INPUT_FILE" && -f "$INPUT_FILE" ]]; then
  cp "$INPUT_FILE" "$TEMP_INPUT"
elif [[ ! -t 0 ]]; then
  cat > "$TEMP_INPUT"
else
  echo '{"event":"error","reason":"No input provided (use stdin or --input-file)"}' >&2
  exit 1
fi

if [[ ! -s "$TEMP_INPUT" ]]; then
  echo '{"event":"error","reason":"Empty input"}' >&2
  rm -f "$TEMP_INPUT"
  exit 1
fi

INPUT=$(cat "$TEMP_INPUT")
echo '{"event":"intake_started","flow":"'"$FLOW"'"}'

# --- 1. Short-name generation ---

SHORT_NAME=$(echo "$INPUT" | sed 's/[^a-zA-Z0-9 ]//g' | \
  awk '{for(i=1;i<=NF&&i<=4;i++) printf "%s%s",$i,(i<4&&i<NF?"-":"")}' | \
  tr '[:upper:]' '[:lower:]' | cut -c1-30)

# Fallback for non-ASCII input (e.g., all Japanese)
if [[ -z "$SHORT_NAME" ]]; then
  SHORT_NAME="${FLOW}-$(date +%H%M%S)"
fi

# --- 2. Branch creation (must run in project directory) ---

cd "$PROJECT_DIR"

BRANCH_STDERR="/tmp/poor-dev-branch-stderr-$$.txt"
BRANCH_RESULT=$(bash "$SCRIPT_DIR/branch-setup.sh" "$SHORT_NAME" 2>"$BRANCH_STDERR") || {
  BRANCH_ERR=$(cat "$BRANCH_STDERR" 2>/dev/null || true)
  echo '{"event":"branch_error","output":'"$(echo "$BRANCH_ERR" | jq -R -s '.')"'}'
  rm -f "$TEMP_INPUT" "$BRANCH_STDERR"
  exit 1
}
rm -f "$BRANCH_STDERR"
BRANCH=$(echo "$BRANCH_RESULT" | jq -r '.branch')
FEATURE_DIR=$(echo "$BRANCH_RESULT" | jq -r '.feature_dir')
FD="$PROJECT_DIR/$FEATURE_DIR"
echo '{"event":"branch_created","branch":"'"$BRANCH"'","feature_dir":"'"$FEATURE_DIR"'"}'

# --- 3. Save input to feature directory ---

cp "$TEMP_INPUT" "$FD/input.txt" && rm -f "$TEMP_INPUT"

# --- 4. Pipeline runner (background) ---
#
# pipeline-runner.sh runs the full pipeline including specify as the first step.
# It can take 30-60+ minutes to complete. Running it synchronously would exceed
# the bash tool timeout in TUI-based LLM environments (opencode, claude).
# Instead, we launch it in the background and return immediately so the calling
# model can poll pipeline-state.json for progress.

PIPELINE_LOG="$FD/pipeline.log"
PIPELINE_PID_FILE="$FD/pipeline.pid"

echo '{"event":"pipeline","status":"starting"}'

nohup bash "$SCRIPT_DIR/pipeline-runner.sh" \
  --flow "$FLOW" \
  --feature-dir "$FEATURE_DIR" \
  --branch "$BRANCH" \
  --project-dir "$PROJECT_DIR" \
  --input-file "$FD/input.txt" \
  --summary "$INPUT" > "$PIPELINE_LOG" 2>&1 &
PIPELINE_PID=$!
echo "$PIPELINE_PID" > "$PIPELINE_PID_FILE"

echo '{"event":"pipeline","status":"background","pid":'"$PIPELINE_PID"',"feature_dir":"'"$FEATURE_DIR"'","log":"'"$PIPELINE_LOG"'"}'
echo '{"event":"intake_complete","feature_dir":"'"$FEATURE_DIR"'","branch":"'"$BRANCH"'"}'
exit 0
