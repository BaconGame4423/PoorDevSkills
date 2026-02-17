#!/usr/bin/env bash
set -euo pipefail
# Usage: pipeline-state.sh <subcommand> <feature_dir> [args...]
#
# Manages pipeline-state.json in the given feature directory.
#
# Subcommands:
#   read                                  — Print pipeline-state.json (or {})
#   init <flow> <pipeline_steps_json>     — Create new pipeline-state.json
#   complete-step <step>                  — Add step to completed, advance current
#   set-status <status> [reason]          — Update status + pauseReason
#   set-variant <variant> <condition_json>— Set variant + condition
#   set-approval <type> <step>            — Set pendingApproval
#   clear-approval                        — Clear pendingApproval
#   set-pipeline <pipeline_steps_json>    — Replace remaining pipeline steps

if ! command -v jq >/dev/null 2>&1; then
  echo '{"error":"jq is required but not installed"}' >&2
  exit 1
fi

SUBCMD="${1:?Usage: pipeline-state.sh <subcommand> <feature_dir> [args...]}"
FEATURE_DIR="${2:?Usage: pipeline-state.sh <subcommand> <feature_dir> [args...]}"
shift 2

STATE_FILE="${FEATURE_DIR}/pipeline-state.json"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

read_state() {
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    echo '{}'
  fi
}

write_state() {
  mkdir -p "$FEATURE_DIR"
  echo "$1" | jq '.' > "$STATE_FILE"
}

case "$SUBCMD" in
  read)
    read_state
    ;;

  init)
    FLOW="${1:?init requires: <flow> <pipeline_steps_json>}"
    STEPS="${2:?init requires: <flow> <pipeline_steps_json>}"
    FIRST_STEP=$(echo "$STEPS" | jq -r '.[0] // empty')
    STATE=$(jq -n \
      --arg flow "$FLOW" \
      --argjson steps "$STEPS" \
      --arg current "$FIRST_STEP" \
      --arg now "$NOW" \
      '{
        flow: $flow,
        variant: null,
        pipeline: $steps,
        completed: [],
        current: $current,
        status: "active",
        pauseReason: null,
        condition: null,
        pendingApproval: null,
        updated: $now
      }')
    write_state "$STATE"
    echo "$STATE"
    ;;

  complete-step)
    STEP="${1:?complete-step requires: <step>}"
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --arg step "$STEP" \
      --arg now "$NOW" '
      .completed += [$step] |
      .completed |= unique |
      . as $root |
      (.pipeline // []) as $pipe |
      ([ $pipe[] | select(. as $s | ($root.completed | index($s)) == null) ] | .[0] // null) as $next |
      .current = $next |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  set-status)
    STATUS="${1:?set-status requires: <status> [reason]}"
    REASON="${2:-}"
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --arg status "$STATUS" \
      --arg reason "$REASON" \
      --arg now "$NOW" '
      .status = $status |
      .pauseReason = (if $reason == "" then null else $reason end) |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  set-variant)
    VARIANT="${1:?set-variant requires: <variant> <condition_json>}"
    CONDITION="${2:?set-variant requires: <variant> <condition_json>}"
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --arg variant "$VARIANT" \
      --argjson condition "$CONDITION" \
      --arg now "$NOW" '
      .variant = $variant |
      .condition = $condition |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  set-approval)
    TYPE="${1:?set-approval requires: <type> <step>}"
    STEP="${2:?set-approval requires: <type> <step>}"
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --arg type "$TYPE" \
      --arg step "$STEP" \
      --arg now "$NOW" '
      .status = "awaiting-approval" |
      .pauseReason = "\($type) at \($step)" |
      .pendingApproval = {"type": $type, "step": $step} |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  clear-approval)
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --arg now "$NOW" '
      .status = "active" |
      .pendingApproval = null |
      .pauseReason = null |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  set-pipeline)
    STEPS="${1:?set-pipeline requires: <pipeline_steps_json>}"
    STATE=$(read_state)
    STATE=$(echo "$STATE" | jq \
      --argjson steps "$STEPS" \
      --arg now "$NOW" '
      .pipeline = $steps |
      . as $root |
      ([ $steps[] | select(. as $s | ($root.completed | index($s)) == null) ] | .[0] // null) as $next |
      .current = $next |
      .updated = $now
    ')
    write_state "$STATE"
    echo "$STATE"
    ;;

  *)
    echo "Unknown subcommand: $SUBCMD" >&2
    echo "Valid: read, init, complete-step, set-status, set-variant, set-approval, clear-approval, set-pipeline" >&2
    exit 1
    ;;
esac
