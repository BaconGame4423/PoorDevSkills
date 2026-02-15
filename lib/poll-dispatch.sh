#!/usr/bin/env bash
set -euo pipefail
# Usage: poll-dispatch.sh <command_file> <output_file> <progress_file> <idle_timeout> <max_timeout>
#
# Polls a dispatched command outside the orchestrator's context window.
# Extracts progress markers incrementally and outputs a JSON summary on completion.
#
# stdout (JSON):
#   { "exit_code": N, "elapsed": N, "timeout_type": "none"|"idle"|"max",
#     "verdict": "GO"|"CONDITIONAL"|"NO-GO"|null,
#     "errors": [...], "clarifications": [...] }

COMMAND_FILE="$1"
OUTPUT_FILE="$2"
PROGRESS_FILE="$3"
IDLE_TIMEOUT="${4:-120}"
MAX_TIMEOUT="${5:-600}"

# Validate inputs
if [ ! -f "$COMMAND_FILE" ]; then
  echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Command file not found: '"$COMMAND_FILE"'"],"clarifications":[]}' >&2
  exit 1
fi

# Validate: command file must contain a known dispatch CLI keyword
FIRST_CMD=$(grep -m1 -oE '\b(opencode|claude|cat)\b' "$COMMAND_FILE" || true)
if [ -z "$FIRST_CMD" ]; then
  echo '{"exit_code":1,"elapsed":0,"timeout_type":"none","verdict":null,"errors":["Dispatch command must start with opencode, claude, or cat"],"clarifications":[]}' >&2
  exit 1
fi

# Initialize output files
: > "$OUTPUT_FILE"
: > "$PROGRESS_FILE"

# Execute command (stdout/stderr → output_file)
env -u CLAUDECODE bash "$COMMAND_FILE" > "$OUTPUT_FILE" 2>&1 &
PID=$!

ELAPSED=0
IDLE=0
LAST_SIZE=0
OUTPUT_STARTED=false
TIMEOUT_TYPE="none"
MARKER_COUNT=0

# Use inotifywait for event-driven monitoring if available, else fall back to sleep
HAS_INOTIFYWAIT=false
if command -v inotifywait >/dev/null 2>&1; then
  HAS_INOTIFYWAIT=true
fi

while kill -0 "$PID" 2>/dev/null; do
  # Event-driven or sleep-based wait
  if [ "$HAS_INOTIFYWAIT" = true ]; then
    inotifywait -t "$((IDLE_TIMEOUT < 5 ? IDLE_TIMEOUT : 5))" -e modify "$OUTPUT_FILE" 2>/dev/null || true
  else
    sleep 1
  fi
  ELAPSED=$((ELAPSED + 1))

  CURRENT_SIZE=$(wc -c < "$OUTPUT_FILE" 2>/dev/null || echo 0)
  if [ "$CURRENT_SIZE" -gt "$LAST_SIZE" ]; then
    OUTPUT_STARTED=true
    IDLE=0

    # Incremental scan: only read new bytes for markers
    NEW_CONTENT=$(tail -c +$((LAST_SIZE + 1)) "$OUTPUT_FILE" 2>/dev/null || true)
    if [ -n "$NEW_CONTENT" ]; then
      NEW_MARKERS=$(echo "$NEW_CONTENT" | grep -oP '\[(PROGRESS|REVIEW-PROGRESS): [^\]]*\]' || true)
      if [ -n "$NEW_MARKERS" ]; then
        echo "$NEW_MARKERS" >> "$PROGRESS_FILE"
        MARKER_COUNT=$((MARKER_COUNT + $(echo "$NEW_MARKERS" | wc -l)))
      fi
    fi

    LAST_SIZE=$CURRENT_SIZE
  else
    IDLE=$((IDLE + 1))
  fi

  # Idle timeout (only after output has started)
  if [ "$OUTPUT_STARTED" = true ] && [ "$IDLE" -ge "$IDLE_TIMEOUT" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
    TIMEOUT_TYPE="idle"
    break
  fi

  # Max timeout
  if [ "$ELAPSED" -ge "$MAX_TIMEOUT" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
    TIMEOUT_TYPE="max"
    break
  fi
done

# Get exit code
if [ "$TIMEOUT_TYPE" = "none" ]; then
  wait "$PID" 2>/dev/null
  EXIT_CODE=$?
else
  EXIT_CODE=124
fi

# Extract results from output_file (only the needed fields, not full content)
VERDICT=$(tail -80 "$OUTPUT_FILE" | grep -oP '^v: \K(GO|CONDITIONAL|NO-GO)' | tail -1 || true)

# Use subshells to avoid pipefail issues when grep finds no matches
# Filter template false positives: instruction text "[ERROR: description]" and
# YAML example placeholders containing angle brackets "<...>"
ERRORS_RAW=$(grep -oP '\[ERROR: [^\]]*\]' "$OUTPUT_FILE" 2>/dev/null || true)
if [ -n "$ERRORS_RAW" ]; then
  ERRORS_RAW=$(echo "$ERRORS_RAW" | grep -vE '<[^>]+>|^\[ERROR: description\]$' || true)
fi
if [ -n "$ERRORS_RAW" ]; then
  ERRORS=$(echo "$ERRORS_RAW" | jq -R -s 'split("\n") | map(select(. != ""))')
else
  ERRORS='[]'
fi

CLARIFICATIONS_RAW=$(grep -oP '\[NEEDS CLARIFICATION: [^\]]*\]' "$OUTPUT_FILE" 2>/dev/null || true)
if [ -n "$CLARIFICATIONS_RAW" ]; then
  CLARIFICATIONS_RAW=$(echo "$CLARIFICATIONS_RAW" | grep -vE '<[^>]+>|^\[NEEDS CLARIFICATION: question\]$' || true)
fi
if [ -n "$CLARIFICATIONS_RAW" ]; then
  CLARIFICATIONS=$(echo "$CLARIFICATIONS_RAW" | jq -R -s 'split("\n") | map(select(. != ""))')
else
  CLARIFICATIONS='[]'
fi

# Output JSON summary
jq -n \
  --argjson exit_code "$EXIT_CODE" \
  --argjson elapsed "$ELAPSED" \
  --arg timeout_type "$TIMEOUT_TYPE" \
  --arg verdict "${VERDICT:-}" \
  --argjson errors "$ERRORS" \
  --argjson clarifications "$CLARIFICATIONS" \
  '{exit_code: $exit_code, elapsed: $elapsed, timeout_type: $timeout_type,
    verdict: (if $verdict == "" then null else $verdict end),
    errors: $errors, clarifications: $clarifications}'
