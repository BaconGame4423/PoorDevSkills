#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: review-runner.sh --type <type> --target <file> --feature-dir <dir> --project-dir <dir>
#
# Drives the full review loop in bash (Ralph Wiggum pattern):
#   1. Setup: resolve personas, depth, log
#   2. Loop: dispatch personas → aggregate → check convergence → fix → repeat
#   3. Exit: converged or max iterations reached
#
# No eval. dispatch-step.sh is called directly. Per-persona timeout.
#
# stdout: JSONL progress events
# exit code: 0=converged, 1=error, 2=not converged (max iterations), 3=rate-limit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"
# shellcheck source=retry-helpers.sh
source "$SCRIPT_DIR/retry-helpers.sh"

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

# --- Read config ---

CONFIG=$(read_config "$PROJECT_DIR")
IDLE_TIMEOUT=$(json_get_or "$CONFIG" '.polling.idle_timeout' '120')
PERSONA_TIMEOUT=$(json_get_or "$CONFIG" '.polling.max_timeout' '300')

# Override with step_timeouts if configured for this review type
_st=$(echo "$CONFIG" | jq -r --arg s "$REVIEW_TYPE" '.polling.step_timeouts[$s].max_timeout // empty' 2>/dev/null)
[[ -n "$_st" && "$_st" != "null" ]] && PERSONA_TIMEOUT="$_st"
_si=$(echo "$CONFIG" | jq -r --arg s "$REVIEW_TYPE" '.polling.step_timeouts[$s].idle_timeout // empty' 2>/dev/null)
[[ -n "$_si" && "$_si" != "null" ]] && IDLE_TIMEOUT="$_si"

# --- Step 0: Setup ---

echo "{\"review\":\"$REVIEW_TYPE\",\"status\":\"setup\"}"

SETUP=$(bash "$SCRIPT_DIR/review-setup.sh" \
  --type "$REVIEW_TYPE" \
  --target "$TARGET_FILE" \
  --feature-dir "$FEATURE_DIR" \
  --project-dir "$PROJECT_DIR")

MAX_ITER=$(json_get "$SETUP" '.max_iterations')
NEXT_ID=$(json_get "$SETUP" '.next_id')
LOG_PATH=$(json_get "$SETUP" '.log_path')
ID_PREFIX=$(json_get "$SETUP" '.id_prefix')
DEPTH=$(json_get "$SETUP" '.depth')

echo "{\"review\":\"$REVIEW_TYPE\",\"status\":\"initialized\",\"depth\":\"$DEPTH\",\"max_iterations\":$MAX_ITER}"

# --- Main loop ---

ITER=0
CONVERGED=false
FINAL_VERDICT=""

while [[ $ITER -lt $MAX_ITER ]]; do
  ITER=$((ITER + 1))
  echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"starting\"}"

  # --- Step 1: Dispatch personas in parallel ---

  OUTPUT_DIR=$(mktemp -d "/tmp/review-personas-$$.XXXXXX")
  PIDS=()
  PERSONA_NAMES=()

  PERSONA_COUNT=$(echo "$SETUP" | jq '.personas | length')
  for ((i=0; i<PERSONA_COUNT; i++)); do
    PERSONA_NAME=$(echo "$SETUP" | jq -r ".personas[$i].name")
    PERSONA_CLI=$(echo "$SETUP" | jq -r ".personas[$i].cli")
    PERSONA_MODEL=$(echo "$SETUP" | jq -r ".personas[$i].model")

    # Compose prompt for persona
    PROMPT_FILE="/tmp/poor-dev-prompt-${PERSONA_NAME}-$$.txt"
    COMMAND_FILE=""

    # Find command file (variant support)
    CMD_VARIANT=$(json_get_or "$CONFIG" '.command_variant' '')
    if [[ -n "$CMD_VARIANT" ]]; then
      for candidate in \
        "$PROJECT_DIR/commands/poor-dev.${PERSONA_NAME}-${CMD_VARIANT}.md" \
        "$PROJECT_DIR/.opencode/command/poor-dev.${PERSONA_NAME}-${CMD_VARIANT}.md"; do
        [[ -f "$candidate" ]] && COMMAND_FILE="$candidate" && break
      done
    fi

    if [[ -z "$COMMAND_FILE" ]]; then
      for candidate in \
        "$PROJECT_DIR/commands/poor-dev.${PERSONA_NAME}.md" \
        "$PROJECT_DIR/.opencode/command/poor-dev.${PERSONA_NAME}.md"; do
        [[ -f "$candidate" ]] && COMMAND_FILE="$candidate" && break
      done
    fi

    if [[ -z "$COMMAND_FILE" ]]; then
      echo "{\"review\":\"$REVIEW_TYPE\",\"warning\":\"Command file not found for $PERSONA_NAME, skipping\"}"
      continue
    fi

    # Build context for persona
    COMPOSE_ARGS=(
      "$COMMAND_FILE"
      "$PROMPT_FILE"
      --header non_interactive
    )

    # Add target file/directory as context
    if [[ -f "$TARGET_FILE" ]]; then
      COMPOSE_ARGS+=(--context "target=$TARGET_FILE")
    elif [[ -d "$TARGET_FILE" ]]; then
      # ディレクトリターゲット: 実装ファイルを個別に追加（最大 20 件）
      local impl_files
      impl_files=$(find "$TARGET_FILE" -maxdepth 3 \( -name "*.html" -o -name "*.js" -o -name "*.ts" -o -name "*.css" -o -name "*.py" \) -type f -not -path '*/node_modules/*' -not -path '*/_runs/*' 2>/dev/null || true)
      local impl_idx=0
      while IFS= read -r impl_file; do
        [[ -z "$impl_file" ]] && continue
        impl_idx=$((impl_idx + 1))
        [[ $impl_idx -gt 20 ]] && break
        COMPOSE_ARGS+=(--context "impl_${impl_idx}=$impl_file")
      done <<< "$impl_files"
    fi

    # Add spec as context
    [[ -f "$FD/spec.md" ]] && COMPOSE_ARGS+=(--context "spec=$FD/spec.md")

    # Add review log as context (for iteration awareness)
    [[ -f "$LOG_PATH" ]] && COMPOSE_ARGS+=(--context "review_log=$LOG_PATH")

    bash "$SCRIPT_DIR/compose-prompt.sh" "${COMPOSE_ARGS[@]}" 2>/dev/null || true

    if [[ ! -f "$PROMPT_FILE" ]]; then
      echo "{\"review\":\"$REVIEW_TYPE\",\"warning\":\"Failed to compose prompt for $PERSONA_NAME\"}"
      continue
    fi

    # Dispatch in background with per-persona timeout (max_retries=1)
    RESULT_FILE="$OUTPUT_DIR/${PERSONA_NAME}-result.json"
    (
      dispatch_with_retry "$PERSONA_NAME" "$PROJECT_DIR" "$PROMPT_FILE" \
        "$IDLE_TIMEOUT" "$PERSONA_TIMEOUT" "$RESULT_FILE" 1 > /dev/null 2>&1

      # Copy output file to output dir for aggregation
      PERSONA_OUTPUT=$(ls -t /tmp/poor-dev-output-${PERSONA_NAME}-*.txt 2>/dev/null | head -1 || true)
      if [[ -n "$PERSONA_OUTPUT" && -f "$PERSONA_OUTPUT" ]]; then
        cp "$PERSONA_OUTPUT" "$OUTPUT_DIR/${PERSONA_NAME}.txt"
      fi
      rm -f "$PROMPT_FILE"
    ) &
    PIDS+=($!)
    PERSONA_NAMES+=("$PERSONA_NAME")
  done

  # Wait for all personas with individual exit code tracking
  FAILED_COUNT=0
  for ((i=0; i<${#PIDS[@]}; i++)); do
    if ! wait "${PIDS[$i]}" 2>/dev/null; then
      FAILED_COUNT=$((FAILED_COUNT + 1))
      echo "{\"review\":\"$REVIEW_TYPE\",\"persona\":\"${PERSONA_NAMES[$i]}\",\"status\":\"failed\"}"
    fi
  done

  # All personas failed → possible rate limit
  if [[ "$FAILED_COUNT" -eq "${#PIDS[@]}" && "${#PIDS[@]}" -gt 0 ]]; then
    echo "{\"review\":\"$REVIEW_TYPE\",\"status\":\"all-failed\",\"possible_rate_limit\":true}"
    rm -rf "$OUTPUT_DIR"
    exit 3
  fi

  echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"personas_complete\",\"succeeded\":$((${#PIDS[@]} - FAILED_COUNT)),\"failed\":$FAILED_COUNT}"

  # --- Step 2: Aggregate ---

  AGG=$(bash "$SCRIPT_DIR/review-aggregate.sh" \
    --output-dir "$OUTPUT_DIR" \
    --log "$LOG_PATH" \
    --id-prefix "$ID_PREFIX" \
    --next-id "$NEXT_ID" \
    --review-type "$REVIEW_TYPE")

  TOTAL=$(json_get "$AGG" '.total')
  COUNT_C=$(json_get "$AGG" '.C')
  COUNT_H=$(json_get "$AGG" '.H')
  NEXT_ID=$(json_get "$AGG" '.next_id')
  ISSUES_FILE=$(json_get "$AGG" '.issues_file')
  CONVERGED_VAL=$(json_get "$AGG" '.converged')
  VERDICTS=$(json_get "$AGG" '.verdicts')

  echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"aggregated\",\"total\":$TOTAL,\"C\":$COUNT_C,\"H\":$COUNT_H,\"verdicts\":\"$VERDICTS\"}"

  # --- Step 3: Update log ---

  FIXED_IDS=""
  bash "$SCRIPT_DIR/review-log-update.sh" \
    --log "$LOG_PATH" \
    --issues-file "$ISSUES_FILE" \
    --verdicts "$VERDICTS" \
    --iteration "$ITER" \
    ${FIXED_IDS:+--fixed "$FIXED_IDS"} > /dev/null

  # --- Step 4: Convergence check ---

  if [[ "$CONVERGED_VAL" == "true" ]]; then
    CONVERGED=true
    FINAL_VERDICT="GO"
    echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"converged\",\"verdict\":\"GO\"}"
    rm -rf "$OUTPUT_DIR"
    break
  fi

  # Last iteration → not converged
  if [[ $ITER -ge $MAX_ITER ]]; then
    if [[ "$COUNT_C" -gt 0 ]]; then
      FINAL_VERDICT="NO-GO"
    else
      FINAL_VERDICT="CONDITIONAL"
    fi
    echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"max_iterations\",\"verdict\":\"$FINAL_VERDICT\"}"
    rm -rf "$OUTPUT_DIR"
    break
  fi

  # --- Step 5: Fix issues ---

  echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"status\":\"fixing\",\"issues\":$TOTAL}"

  FIXER_CLI=$(json_get "$SETUP" '.fixer.cli')
  FIXER_MODEL=$(json_get "$SETUP" '.fixer.model')

  # Build fixer prompt
  FIX_PROMPT_FILE="/tmp/poor-dev-prompt-fixer-$$.txt"

  # Find fixer command file
  FIX_CMD_FILE=""
  for candidate in \
    "$PROJECT_DIR/commands/poor-dev.review-fixer.md" \
    "$PROJECT_DIR/.opencode/command/poor-dev.review-fixer.md"; do
    [[ -f "$candidate" ]] && FIX_CMD_FILE="$candidate" && break
  done

  if [[ -n "$FIX_CMD_FILE" ]]; then
    COMPOSE_ARGS=(
      "$FIX_CMD_FILE"
      "$FIX_PROMPT_FILE"
      --header non_interactive
    )
    [[ -f "$ISSUES_FILE" ]] && COMPOSE_ARGS+=(--context "issues=$ISSUES_FILE")
    [[ -f "$TARGET_FILE" ]] && COMPOSE_ARGS+=(--context "target=$TARGET_FILE")
    [[ -f "$FD/spec.md" ]] && COMPOSE_ARGS+=(--context "spec=$FD/spec.md")

    bash "$SCRIPT_DIR/compose-prompt.sh" "${COMPOSE_ARGS[@]}" 2>/dev/null || true

    if [[ -f "$FIX_PROMPT_FILE" ]]; then
      FIX_RESULT_FILE="/tmp/poor-dev-result-fixer-$$.json"
      dispatch_with_retry "fixer" "$PROJECT_DIR" "$FIX_PROMPT_FILE" \
        "$IDLE_TIMEOUT" "$PERSONA_TIMEOUT" "$FIX_RESULT_FILE" 1 > /dev/null 2>&1 || {
        echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"warning\":\"fixer dispatch failed\"}"
      }
      rm -f "$FIX_PROMPT_FILE" "$FIX_RESULT_FILE"

      # Track fixed issues for next iteration's log
      FIXED_IDS=$(cut -d'|' -f1 "$ISSUES_FILE" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)
    fi
  else
    echo "{\"review\":\"$REVIEW_TYPE\",\"iteration\":$ITER,\"warning\":\"fixer command file not found\"}"
  fi

  rm -rf "$OUTPUT_DIR"
done

# --- Final output ---

EXIT_CODE=0
case "$FINAL_VERDICT" in
  GO)          EXIT_CODE=0 ;;
  CONDITIONAL) EXIT_CODE=0 ;;
  NO-GO)       EXIT_CODE=2 ;;
esac

echo "{\"review\":\"$REVIEW_TYPE\",\"status\":\"complete\",\"verdict\":\"$FINAL_VERDICT\",\"iterations\":$ITER,\"converged\":$CONVERGED}"
exit $EXIT_CODE
