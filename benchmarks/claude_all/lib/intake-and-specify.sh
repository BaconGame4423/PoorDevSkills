#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: intake-and-specify.sh --flow <flow> --project-dir <dir> <<< "user input"
#
# Combines intake + specify into a single synchronous operation.
# Returns spec content for user review before pipeline continues.
#
# Processing:
#   1. Idempotency: skip branch/feature_dir creation if already exists
#   2. intake.sh --setup-only → branch, feature_dir
#   3. pipeline-state.sh init → state initialization
#   4. If spec.md exists and non-empty → skip dispatch (resume support)
#   5. compose-prompt.sh + dispatch-step.sh → specify execution
#   6. extract-output.sh → save spec.md
#   7. pipeline-state.sh complete-step specify
#
# stdin: user input text
# stdout: JSON { "branch": "...", "feature_dir": "...", "spec_content": "..." }
# exit code: 0=success, 1=error, 3=rate-limit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"
trap cleanup_temp_files EXIT INT TERM

# --- Parse arguments ---

FLOW=""
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow)        FLOW="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *)             die "Unknown argument: $1" ;;
  esac
done

: "${FLOW:?--flow is required}"
: "${PROJECT_DIR:?--project-dir is required}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

# --- Read input from stdin ---

INPUT_FILE=$(make_temp "intake-input")
if [[ ! -t 0 ]]; then
  cat > "$INPUT_FILE"
else
  die "No input provided on stdin"
fi

if [[ ! -s "$INPUT_FILE" ]]; then
  die "Empty input"
fi

# --- Read config ---

CONFIG=$(read_config "$PROJECT_DIR")
IDLE_TIMEOUT=$(json_get_or "$CONFIG" '.polling.idle_timeout' '300')
MAX_TIMEOUT=$(json_get_or "$CONFIG" '.polling.max_timeout' '600')

# --- Step 1: Setup (idempotent) ---

# Check if we're already on a feature branch with an existing feature_dir
CURRENT_BRANCH=$(cd "$PROJECT_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
PREFIX=""
FEATURE_DIR=""
BRANCH=""

if [[ -n "$CURRENT_BRANCH" && "$CURRENT_BRANCH" =~ ^([0-9]+)- ]]; then
  PREFIX="${BASH_REMATCH[1]}"
  EXISTING_FD=$(cd "$PROJECT_DIR" && ls -d "specs/${PREFIX}-"* 2>/dev/null | head -1 || true)
  if [[ -n "$EXISTING_FD" ]]; then
    FEATURE_DIR="$EXISTING_FD"
    BRANCH="$CURRENT_BRANCH"
  fi
fi

if [[ -z "$FEATURE_DIR" ]]; then
  # New setup via intake.sh
  SETUP_RESULT=$(bash "$SCRIPT_DIR/intake.sh" --flow "$FLOW" --project-dir "$PROJECT_DIR" --setup-only --input-file "$INPUT_FILE")
  BRANCH=$(echo "$SETUP_RESULT" | grep '"event":"setup_complete"' | jq -r '.branch' 2>/dev/null || \
           echo "$SETUP_RESULT" | grep '"event":"branch_created"' | jq -r '.branch' 2>/dev/null || true)
  FEATURE_DIR=$(echo "$SETUP_RESULT" | grep '"event":"setup_complete"' | jq -r '.feature_dir' 2>/dev/null || \
                echo "$SETUP_RESULT" | grep '"event":"branch_created"' | jq -r '.feature_dir' 2>/dev/null || true)

  if [[ -z "$BRANCH" || -z "$FEATURE_DIR" ]]; then
    die "Failed to create branch/feature_dir from intake.sh"
  fi
else
  # Existing setup - ensure input is saved
  cp "$INPUT_FILE" "$PROJECT_DIR/$FEATURE_DIR/input.txt" 2>/dev/null || true
fi

FD="$PROJECT_DIR/$FEATURE_DIR"

# --- Step 2: Initialize pipeline state ---

STATE_FILE="$FD/pipeline-state.json"
if [[ ! -f "$STATE_FILE" ]]; then
  # Get pipeline steps for flow
  case "$FLOW" in
    feature)  STEPS='["specify","suggest","plan","planreview","tasks","tasksreview","implement","architecturereview","qualityreview","phasereview"]' ;;
    bugfix)   STEPS='["bugfix"]' ;;
    roadmap)  STEPS='["concept","goals","milestones","roadmap"]' ;;
    discovery-init) STEPS='["discovery"]' ;;
    discovery-rebuild) STEPS='["rebuildcheck"]' ;;
    investigation) STEPS='["investigate"]' ;;
    *) die "Unknown flow: $FLOW" ;;
  esac
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "$FLOW" "$STEPS" > /dev/null
fi

# --- Step 3: Check if spec already exists (resume support) ---

if [[ -f "$FD/spec.md" && -s "$FD/spec.md" ]]; then
  SPEC_CONTENT=$(cat "$FD/spec.md")
  # Check if specify is already completed
  COMPLETED=$(jq -r '.completed[]?' "$STATE_FILE" 2>/dev/null || true)
  if ! echo "$COMPLETED" | grep -qx "specify"; then
    bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "specify" > /dev/null
  fi
  jq -n \
    --arg branch "$BRANCH" \
    --arg feature_dir "$FEATURE_DIR" \
    --arg spec_content "$SPEC_CONTENT" \
    '{ branch: $branch, feature_dir: $feature_dir, spec_content: $spec_content, resumed: true }'
  exit 0
fi

# --- Step 4: Dispatch specify ---

PROMPT_FILE=$(make_temp "prompt-specify")

# Find command file
COMMAND_FILE="$PROJECT_DIR/commands/poor-dev.specify.md"
if [[ ! -f "$COMMAND_FILE" ]]; then
  COMMAND_FILE="$PROJECT_DIR/.opencode/command/poor-dev.specify.md"
fi

# Check for simple variant
VARIANT=$(json_get_or "$CONFIG" '.command_variant' '')
if [[ "$VARIANT" == "simple" ]]; then
  SIMPLE_CMD="$PROJECT_DIR/commands/poor-dev.specify-simple.md"
  if [[ ! -f "$SIMPLE_CMD" ]]; then
    SIMPLE_CMD="$PROJECT_DIR/.opencode/command/poor-dev.specify-simple.md"
  fi
  [[ -f "$SIMPLE_CMD" ]] && COMMAND_FILE="$SIMPLE_CMD"
fi

if [[ ! -f "$COMMAND_FILE" ]]; then
  die "Command file not found: poor-dev.specify.md"
fi

# Compose prompt
COMPOSE_ARGS=(
  "$COMMAND_FILE"
  "$PROMPT_FILE"
  --header non_interactive
  --header readonly
)
[[ -f "$FD/input.txt" ]] && COMPOSE_ARGS+=(--context "input=$FD/input.txt")

# Pipeline metadata
PIPELINE_CTX=$(make_temp "pipeline-ctx")
cat > "$PIPELINE_CTX" <<CTX_EOF
- FEATURE_DIR: ${FEATURE_DIR}
- BRANCH: ${BRANCH}
- Feature: $(head -1 "$INPUT_FILE")
- Step: specify (1/10)
CTX_EOF
COMPOSE_ARGS+=(--context "pipeline=$PIPELINE_CTX")

bash "$SCRIPT_DIR/compose-prompt.sh" "${COMPOSE_ARGS[@]}"

# Dispatch
RESULT_FILE=$(make_temp "result-specify")
bash "$SCRIPT_DIR/dispatch-step.sh" "specify" "$PROJECT_DIR" "$PROMPT_FILE" \
  "$IDLE_TIMEOUT" "$MAX_TIMEOUT" "$RESULT_FILE" || {
  DISPATCH_EXIT=$?

  # Rate limit check
  RATE_COUNT=0
  LOG_DIR="${HOME}/.local/share/opencode/log"
  if [[ -d "$LOG_DIR" ]]; then
    LATEST_LOG=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
    if [[ -n "$LATEST_LOG" ]]; then
      RATE_COUNT=$(grep -c "Rate limit\|rate_limit\|rate limit" "$LATEST_LOG" 2>/dev/null || echo 0)
    fi
  fi

  if [[ "$RATE_COUNT" -gt 0 ]]; then
    bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "rate-limited" "Rate limit at specify" > /dev/null
    echo "{\"error\":\"rate-limited\",\"step\":\"specify\"}"
    exit 3
  fi

  die "dispatch-step.sh failed with exit $DISPATCH_EXIT"
}

# --- Step 5: Extract spec output ---

# Find the output file created by dispatch-step.sh
SPEC_OUTPUT=$(ls -t /tmp/poor-dev-output-specify-*.txt 2>/dev/null | head -1 || true)
if [[ -z "$SPEC_OUTPUT" || ! -f "$SPEC_OUTPUT" ]]; then
  die "No specify output file found"
fi

EXTRACT_RESULT=$(bash "$SCRIPT_DIR/extract-output.sh" "$SPEC_OUTPUT" "$FD/spec.md") || {
  die "Failed to extract spec: $EXTRACT_RESULT"
}

# --- Step 6: Complete step ---

bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "specify" > /dev/null

# --- Output result ---

SPEC_CONTENT=$(cat "$FD/spec.md")
jq -n \
  --arg branch "$BRANCH" \
  --arg feature_dir "$FEATURE_DIR" \
  --arg spec_content "$SPEC_CONTENT" \
  '{ branch: $branch, feature_dir: $feature_dir, spec_content: $spec_content, resumed: false }'
