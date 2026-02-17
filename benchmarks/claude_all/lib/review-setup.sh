#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: review-setup.sh --type <review_type> --target <target_file> --feature-dir <dir> --project-dir <dir>
#
# Initializes a review session:
#   1. Resolves CLI/model for each persona + fixer via config-resolver.sh
#   2. Calculates review depth from git diff stats
#   3. Initializes review-log.yaml and computes next_id
#
# stdout: JSON {
#   depth, max_iterations, next_id, log_path,
#   personas: [{ name, cli, model, agent_name }],
#   fixer: { cli, model, agent_name }
# }
# exit code: 0=success, 1=error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"

# --- Parse arguments ---

REVIEW_TYPE=""
TARGET_FILE=""
FEATURE_DIR=""
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)        REVIEW_TYPE="$2"; shift 2 ;;
    --target)      TARGET_FILE="$2"; shift 2 ;;
    --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *)             die "Unknown argument: $1" ;;
  esac
done

: "${REVIEW_TYPE:?--type is required}"
: "${TARGET_FILE:?--target is required}"
: "${FEATURE_DIR:?--feature-dir is required}"
: "${PROJECT_DIR:?--project-dir is required}"

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
FD="$PROJECT_DIR/$FEATURE_DIR"

# --- Determine personas for review type ---

get_personas() {
  local review_type="$1"
  case "$review_type" in
    planreview)
      echo "planreview-pm planreview-critical planreview-risk planreview-value"
      ;;
    tasksreview)
      echo "tasksreview-junior tasksreview-senior tasksreview-techlead tasksreview-devops"
      ;;
    architecturereview)
      echo "architecturereview-architect architecturereview-performance architecturereview-security architecturereview-sre"
      ;;
    qualityreview)
      echo "qualityreview-code qualityreview-qa qualityreview-security qualityreview-testdesign"
      ;;
    phasereview)
      echo "phasereview-qa phasereview-ux phasereview-regression phasereview-docs"
      ;;
    *)
      die "Unknown review type: $review_type"
      ;;
  esac
}

PERSONAS=$(get_personas "$REVIEW_TYPE")

# --- Resolve CLI/model for each persona ---

CONFIG_PATH="$PROJECT_DIR/.poor-dev/config.json"
CONFIG=$(read_config "$PROJECT_DIR")

PERSONAS_JSON="[]"
for persona in $PERSONAS; do
  RESOLVED=$(bash "$SCRIPT_DIR/config-resolver.sh" "$persona" ${CONFIG_PATH:+"$CONFIG_PATH"} 2>/dev/null || echo '{"cli":"claude","model":"sonnet"}')
  CLI=$(json_get "$RESOLVED" '.cli')
  MODEL=$(json_get "$RESOLVED" '.model')

  PERSONAS_JSON=$(echo "$PERSONAS_JSON" | jq \
    --arg name "$persona" \
    --arg cli "$CLI" \
    --arg model "$MODEL" \
    --arg agent_name "$persona" \
    '. + [{ name: $name, cli: $cli, model: $model, agent_name: $agent_name }]')
done

# Resolve fixer
FIXER_RESOLVED=$(bash "$SCRIPT_DIR/config-resolver.sh" "fixer" ${CONFIG_PATH:+"$CONFIG_PATH"} 2>/dev/null || echo '{"cli":"claude","model":"sonnet"}')
FIXER_CLI=$(json_get "$FIXER_RESOLVED" '.cli')
FIXER_MODEL=$(json_get "$FIXER_RESOLVED" '.model')

# --- Calculate review depth ---

DIFF_STATS=""
DEPTH="standard"
MAX_ITERATIONS=3

if command -v git > /dev/null 2>&1; then
  DIFF_STATS=$(cd "$PROJECT_DIR" && git diff --stat HEAD 2>/dev/null || true)
  if [[ -n "$DIFF_STATS" ]]; then
    FILES_CHANGED=$(echo "$DIFF_STATS" | tail -1 | grep -oP '\d+ file' | grep -oP '\d+' || echo "0")
    INSERTIONS=$(echo "$DIFF_STATS" | tail -1 | grep -oP '\d+ insertion' | grep -oP '\d+' || echo "0")
    DELETIONS=$(echo "$DIFF_STATS" | tail -1 | grep -oP '\d+ deletion' | grep -oP '\d+' || echo "0")

    TOTAL_CHANGES=$((INSERTIONS + DELETIONS))

    if [[ "$TOTAL_CHANGES" -gt 500 || "$FILES_CHANGED" -gt 20 ]]; then
      DEPTH="deep"
      MAX_ITERATIONS=5
    elif [[ "$TOTAL_CHANGES" -lt 50 && "$FILES_CHANGED" -lt 5 ]]; then
      DEPTH="light"
      MAX_ITERATIONS=2
    fi
  fi
fi

# Override from config
CONFIG_DEPTH=$(json_get_or "$CONFIG" '.review_depth' 'auto')
if [[ "$CONFIG_DEPTH" != "auto" ]]; then
  DEPTH="$CONFIG_DEPTH"
  case "$DEPTH" in
    deep)     MAX_ITERATIONS=5 ;;
    standard) MAX_ITERATIONS=3 ;;
    light)    MAX_ITERATIONS=2 ;;
  esac
fi

# --- Initialize review-log.yaml ---

LOG_PATH="$FD/review-log-${REVIEW_TYPE}.yaml"
NEXT_ID=1

if [[ -f "$LOG_PATH" ]]; then
  # Find highest existing ID
  MAX_ID=$(grep -oP '[A-Z]+(\d+)' "$LOG_PATH" 2>/dev/null | grep -oP '\d+' | sort -n | tail -1 || echo "0")
  NEXT_ID=$((MAX_ID + 1))
fi

# Derive ID prefix from review type
case "$REVIEW_TYPE" in
  planreview)          ID_PREFIX="PR" ;;
  tasksreview)         ID_PREFIX="TR" ;;
  architecturereview)  ID_PREFIX="AR" ;;
  qualityreview)       ID_PREFIX="QR" ;;
  phasereview)         ID_PREFIX="PH" ;;
  *)                   ID_PREFIX="RV" ;;
esac

# --- Output ---

jq -n \
  --arg depth "$DEPTH" \
  --argjson max_iterations "$MAX_ITERATIONS" \
  --argjson next_id "$NEXT_ID" \
  --arg log_path "$LOG_PATH" \
  --arg id_prefix "$ID_PREFIX" \
  --argjson personas "$PERSONAS_JSON" \
  --arg fixer_cli "$FIXER_CLI" \
  --arg fixer_model "$FIXER_MODEL" \
  --arg review_type "$REVIEW_TYPE" \
  '{
    depth: $depth,
    max_iterations: $max_iterations,
    next_id: $next_id,
    log_path: $log_path,
    id_prefix: $id_prefix,
    review_type: $review_type,
    personas: $personas,
    fixer: { cli: $fixer_cli, model: $fixer_model, agent_name: "review-fixer" }
  }'
