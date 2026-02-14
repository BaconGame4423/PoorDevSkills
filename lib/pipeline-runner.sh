#!/usr/bin/env bash
set -euo pipefail
# Usage: pipeline-runner.sh --flow <flow> --feature-dir <dir> --branch <branch> --project-dir <dir> [--completed step1,step2] [--summary "feature summary"]
#
# Runs the full pipeline sequentially, dispatching each step via dispatch-step.sh.
#
# stdout: JSONL (one JSON object per step event)
# exit code: 0=all complete, 1=error, 2=NO-GO pause, 3=rate-limit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Parse arguments ---

FLOW=""
FEATURE_DIR=""
BRANCH=""
PROJECT_DIR=""
COMPLETED_CSV=""
SUMMARY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow)       FLOW="$2";        shift 2 ;;
    --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
    --branch)     BRANCH="$2";      shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --completed)  COMPLETED_CSV="$2"; shift 2 ;;
    --summary)    SUMMARY="$2";     shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --- Validate required arguments ---

if [[ -z "$FLOW" || -z "$FEATURE_DIR" || -z "$BRANCH" || -z "$PROJECT_DIR" ]]; then
  echo '{"error":"Missing required arguments: --flow, --feature-dir, --branch, --project-dir"}' >&2
  exit 1
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
FD="$PROJECT_DIR/$FEATURE_DIR"

# --- Pipeline step lookup ---

get_pipeline_steps() {
  local flow="$1"
  case "$flow" in
    feature)
      echo "suggest plan planreview tasks tasksreview implement architecturereview qualityreview phasereview"
      ;;
    bugfix)
      echo "bugfix"
      ;;
    roadmap)
      echo "concept goals milestones roadmap"
      ;;
    discovery-init)
      echo "discovery"
      ;;
    discovery-rebuild)
      echo "rebuildcheck"
      ;;
    investigation)
      echo "investigate"
      ;;
    *)
      echo "Error: Unknown flow '$flow'" >&2
      return 1
      ;;
  esac
}

# --- Build completed set from CSV + pipeline-state.json ---

declare -A COMPLETED_SET

# From --completed argument
if [[ -n "$COMPLETED_CSV" ]]; then
  IFS=',' read -ra CSV_STEPS <<< "$COMPLETED_CSV"
  for s in "${CSV_STEPS[@]}"; do
    s=$(echo "$s" | xargs)  # trim whitespace
    [[ -n "$s" ]] && COMPLETED_SET["$s"]=1
  done
fi

# From pipeline-state.json (resume detection)
STATE_FILE="$FD/pipeline-state.json"
if [[ -f "$STATE_FILE" ]]; then
  while IFS= read -r s; do
    [[ -n "$s" ]] && COMPLETED_SET["$s"]=1
  done < <(jq -r '.completed[]?' "$STATE_FILE" 2>/dev/null || true)
fi

# --- Read config for timeouts ---

CONFIG_FILE="$PROJECT_DIR/.poor-dev/config.json"
if [[ -f "$CONFIG_FILE" ]]; then
  IDLE_TIMEOUT=$(jq -r '.polling.idle_timeout // 120' "$CONFIG_FILE")
  MAX_TIMEOUT=$(jq -r '.polling.max_timeout // 600' "$CONFIG_FILE")
else
  IDLE_TIMEOUT=120
  MAX_TIMEOUT=600
fi

# --- Context arguments per step ---

context_args_for_step() {
  local step="$1"
  local fd="$2"
  local args=""

  case "$step" in
    suggest)
      [[ -f "$fd/spec.md" ]] && args="--context spec=$fd/spec.md"
      ;;
    plan)
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      [[ -f "$fd/suggestions.yaml" ]] && args="$args --context suggestions=$fd/suggestions.yaml"
      ;;
    planreview|planreview-*)
      [[ -f "$fd/plan.md" ]] && args="$args --context plan=$fd/plan.md"
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      ;;
    tasks)
      [[ -f "$fd/plan.md" ]] && args="$args --context plan=$fd/plan.md"
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      ;;
    tasksreview|tasksreview-*)
      [[ -f "$fd/tasks.md" ]] && args="$args --context tasks=$fd/tasks.md"
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      [[ -f "$fd/plan.md" ]] && args="$args --context plan=$fd/plan.md"
      ;;
    implement)
      [[ -f "$fd/tasks.md" ]] && args="$args --context tasks=$fd/tasks.md"
      [[ -f "$fd/plan.md" ]] && args="$args --context plan=$fd/plan.md"
      ;;
    architecturereview*|qualityreview*|phasereview*)
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      [[ -f "$fd/review-log.yaml" ]] && args="$args --context review_log=$fd/review-log.yaml"
      ;;
    bugfix)
      [[ -f "$fd/bug-report.md" ]] && args="$args --context bug_report=$fd/bug-report.md"
      ;;
    concept|goals|milestones|roadmap)
      [[ -f "$fd/spec.md" ]] && args="$args --context spec=$fd/spec.md"
      ;;
  esac

  echo "$args"
}

# --- Prerequisite check ---

check_prerequisites() {
  local step="$1"
  local fd="$2"

  case "$step" in
    plan)
      if [[ ! -f "$fd/spec.md" ]]; then
        echo "missing prerequisite: spec.md"
        return 1
      fi
      ;;
    tasks)
      if [[ ! -f "$fd/plan.md" || ! -f "$fd/spec.md" ]]; then
        echo "missing prerequisite: plan.md and/or spec.md"
        return 1
      fi
      ;;
    implement)
      if [[ ! -f "$fd/tasks.md" || ! -f "$fd/spec.md" ]]; then
        echo "missing prerequisite: tasks.md and/or spec.md"
        return 1
      fi
      ;;
  esac
  return 0
}

# --- Conditional step markers ---

CONDITIONAL_STEPS="bugfix rebuildcheck"

is_conditional() {
  local step="$1"
  echo "$CONDITIONAL_STEPS" | tr ' ' '\n' | grep -qx "$step"
}

# --- Review steps ---

REVIEW_STEPS="planreview tasksreview architecturereview qualityreview phasereview"

is_review() {
  local step="$1"
  echo "$REVIEW_STEPS" | tr ' ' '\n' | grep -qx "$step"
}

# --- Rate limit detection ---

check_rate_limit() {
  local log_dir="${HOME}/.local/share/opencode/log"
  if [[ -d "$log_dir" ]]; then
    local latest_log
    latest_log=$(ls -t "$log_dir"/*.log 2>/dev/null | head -1)
    if [[ -n "$latest_log" ]]; then
      local count
      count=$(grep -c "Rate limit\|rate_limit\|rate limit" "$latest_log" 2>/dev/null || echo 0)
      echo "$count"
      return
    fi
  fi
  echo "0"
}

# --- Post-implement source protection ---

protect_sources() {
  local protected_files
  protected_files=$(git diff --name-only HEAD 2>/dev/null || true)
  if [[ -n "$protected_files" ]]; then
    local to_restore=""
    while IFS= read -r f; do
      case "$f" in
        agents/*|commands/*|lib/poll-dispatch.sh|.poor-dev/*|.opencode/command/*|.opencode/agents/*|.claude/agents/*|.claude/commands/*)
          to_restore="$to_restore $f"
          ;;
      esac
    done <<< "$protected_files"
    if [[ -n "$to_restore" ]]; then
      # shellcheck disable=SC2086
      git checkout HEAD -- $to_restore 2>/dev/null || true
      echo '{"warning":"Protected files were modified by implement step and have been restored","files":"'"$(echo "$to_restore" | xargs)"'"}'
    fi
  fi
}

# ============================================================
# Main dispatch loop
# ============================================================

PIPELINE_STEPS=$(get_pipeline_steps "$FLOW") || exit 1

# Initialize pipeline state
STEPS_JSON=$(echo "$PIPELINE_STEPS" | tr ' ' '\n' | jq -R . | jq -s .)
if [[ ! -f "$STATE_FILE" ]]; then
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "$FLOW" "$STEPS_JSON" > /dev/null
fi

STEP_COUNT=0
TOTAL_STEPS=$(echo "$PIPELINE_STEPS" | wc -w)

for STEP in $PIPELINE_STEPS; do
  STEP_COUNT=$((STEP_COUNT + 1))

  # Skip completed steps
  if [[ -n "${COMPLETED_SET[$STEP]:-}" ]]; then
    echo "{\"step\":\"$STEP\",\"status\":\"skipped\",\"reason\":\"already completed\"}"
    continue
  fi

  # Prerequisite check
  PREREQ_ERROR=$(check_prerequisites "$STEP" "$FD" 2>&1) || {
    echo "{\"step\":\"$STEP\",\"error\":\"$PREREQ_ERROR\"}"
    exit 1
  }

  echo "{\"step\":\"$STEP\",\"status\":\"starting\",\"progress\":\"$STEP_COUNT/$TOTAL_STEPS\"}"

  # --- Compose prompt ---

  PROMPT_FILE="/tmp/poor-dev-prompt-${STEP}-$$.txt"
  COMMAND_FILE="$PROJECT_DIR/commands/poor-dev.${STEP}.md"

  # Fallback to .opencode/command/ if commands/ not found
  if [[ ! -f "$COMMAND_FILE" ]]; then
    COMMAND_FILE="$PROJECT_DIR/.opencode/command/poor-dev.${STEP}.md"
  fi

  if [[ ! -f "$COMMAND_FILE" ]]; then
    echo "{\"step\":\"$STEP\",\"error\":\"Command file not found: poor-dev.${STEP}.md\"}"
    exit 1
  fi

  # Build compose-prompt args
  COMPOSE_ARGS=(
    "$COMMAND_FILE"
    "$PROMPT_FILE"
    --header non_interactive
  )

  # Add context
  CONTEXT_ARGS=$(context_args_for_step "$STEP" "$FD")
  if [[ -n "$CONTEXT_ARGS" ]]; then
    # shellcheck disable=SC2206
    COMPOSE_ARGS+=($CONTEXT_ARGS)
  fi

  # Add feature_dir and branch as inline context
  if [[ -n "$FEATURE_DIR" ]]; then
    # Create a temp context file with pipeline metadata
    PIPELINE_CTX="/tmp/poor-dev-pipeline-ctx-${STEP}-$$.txt"
    cat > "$PIPELINE_CTX" <<CTX_EOF
- FEATURE_DIR: ${FEATURE_DIR}
- BRANCH: ${BRANCH}
- Feature: ${SUMMARY}
- Step: ${STEP} (${STEP_COUNT}/${TOTAL_STEPS})
CTX_EOF
    COMPOSE_ARGS+=(--context pipeline="$PIPELINE_CTX")
  fi

  bash "$SCRIPT_DIR/compose-prompt.sh" "${COMPOSE_ARGS[@]}"

  # --- Dispatch ---

  RESULT=""
  RESULT=$(bash "$SCRIPT_DIR/dispatch-step.sh" "$STEP" "$PROJECT_DIR" "$PROMPT_FILE" "$IDLE_TIMEOUT" "$MAX_TIMEOUT" 2>&1) || {
    DISPATCH_EXIT=$?

    # Rate limit check
    RATE_COUNT=$(check_rate_limit)
    if [[ "$RATE_COUNT" -gt 0 ]]; then
      bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "rate-limited" "Rate limit at step $STEP" > /dev/null
      echo "{\"step\":\"$STEP\",\"status\":\"rate-limited\",\"rate_limit_count\":$RATE_COUNT}"
      rm -f "$PROMPT_FILE" "${PIPELINE_CTX:-/dev/null}" 2>/dev/null || true
      exit 3
    fi

    echo "{\"step\":\"$STEP\",\"status\":\"error\",\"exit_code\":$DISPATCH_EXIT,\"result\":$(echo "$RESULT" | jq -R -s '.')}"
    rm -f "$PROMPT_FILE" "${PIPELINE_CTX:-/dev/null}" 2>/dev/null || true
    exit 1
  }

  # Cleanup temp files
  rm -f "$PROMPT_FILE" "${PIPELINE_CTX:-/dev/null}" 2>/dev/null || true

  # --- Parse result ---

  VERDICT=$(echo "$RESULT" | jq -r '.verdict // empty' 2>/dev/null || true)
  ERRORS=$(echo "$RESULT" | jq -r '.errors | length' 2>/dev/null || echo "0")
  TIMEOUT_TYPE=$(echo "$RESULT" | jq -r '.timeout_type // "none"' 2>/dev/null || true)

  # Check for errors in result
  if [[ "$ERRORS" -gt 0 ]]; then
    echo "{\"step\":\"$STEP\",\"status\":\"error\",\"result\":$RESULT}"
    exit 1
  fi

  if [[ "$TIMEOUT_TYPE" != "none" ]]; then
    echo "{\"step\":\"$STEP\",\"status\":\"timeout\",\"timeout_type\":\"$TIMEOUT_TYPE\",\"result\":$RESULT}"
    exit 1
  fi

  # --- Conditional step processing ---

  if is_conditional "$STEP"; then
    OUTPUT_FILE="/tmp/poor-dev-output-${STEP}-$$.txt"

    case "$STEP" in
      bugfix)
        SCALE=$(grep -oP '\[SCALE: \K[A-Z]+' "$OUTPUT_FILE" 2>/dev/null | head -1 || true)
        RECLASSIFY=$(grep -oP '\[RECLASSIFY: \K[A-Z]+' "$OUTPUT_FILE" 2>/dev/null | head -1 || true)

        if [[ "$RECLASSIFY" == "FEATURE" ]]; then
          echo "{\"step\":\"$STEP\",\"status\":\"reclassify\",\"target\":\"feature\"}"
          bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "paused" "Reclassified as feature" > /dev/null
          exit 2
        elif [[ "$SCALE" == "SMALL" ]]; then
          NEW_PIPELINE='["bugfix","planreview","implement","qualityreview","phasereview"]'
          bash "$SCRIPT_DIR/pipeline-state.sh" set-variant "$FD" "bugfix-small" '{"scale":"SMALL"}' > /dev/null
          bash "$SCRIPT_DIR/pipeline-state.sh" set-pipeline "$FD" "$NEW_PIPELINE" > /dev/null
          PIPELINE_STEPS="bugfix planreview implement qualityreview phasereview"
          TOTAL_STEPS=$(echo "$PIPELINE_STEPS" | wc -w)
        elif [[ "$SCALE" == "LARGE" ]]; then
          NEW_PIPELINE='["bugfix","plan","planreview","tasks","tasksreview","implement","architecturereview","qualityreview","phasereview"]'
          bash "$SCRIPT_DIR/pipeline-state.sh" set-variant "$FD" "bugfix-large" '{"scale":"LARGE"}' > /dev/null
          bash "$SCRIPT_DIR/pipeline-state.sh" set-pipeline "$FD" "$NEW_PIPELINE" > /dev/null
          PIPELINE_STEPS="bugfix plan planreview tasks tasksreview implement architecturereview qualityreview phasereview"
          TOTAL_STEPS=$(echo "$PIPELINE_STEPS" | wc -w)
        fi
        ;;
      rebuildcheck)
        REBUILD_VERDICT=$(grep -oP '\[VERDICT: \K[A-Z]+' "$OUTPUT_FILE" 2>/dev/null | head -1 || true)

        if [[ "$REBUILD_VERDICT" == "REBUILD" ]]; then
          NEW_PIPELINE='["rebuildcheck","harvest","plan","planreview","tasks","tasksreview","implement","architecturereview","qualityreview","phasereview"]'
          bash "$SCRIPT_DIR/pipeline-state.sh" set-variant "$FD" "discovery-rebuild" '{"verdict":"REBUILD"}' > /dev/null
          bash "$SCRIPT_DIR/pipeline-state.sh" set-pipeline "$FD" "$NEW_PIPELINE" > /dev/null
          PIPELINE_STEPS="rebuildcheck harvest plan planreview tasks tasksreview implement architecturereview qualityreview phasereview"
          TOTAL_STEPS=$(echo "$PIPELINE_STEPS" | wc -w)
        elif [[ "$REBUILD_VERDICT" == "CONTINUE" ]]; then
          bash "$SCRIPT_DIR/pipeline-state.sh" set-variant "$FD" "discovery-continue" '{"verdict":"CONTINUE"}' > /dev/null
          bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "paused" "CONTINUE verdict" > /dev/null
          echo "{\"step\":\"$STEP\",\"status\":\"paused\",\"verdict\":\"CONTINUE\"}"
          exit 0
        fi
        ;;
    esac
  fi

  # --- Review verdict handling ---

  if is_review "$STEP" && [[ -n "$VERDICT" ]]; then
    case "$VERDICT" in
      GO)
        # Continue
        ;;
      CONDITIONAL)
        echo "{\"step\":\"$STEP\",\"status\":\"conditional\",\"verdict\":\"CONDITIONAL\"}"
        # Continue with warning
        ;;
      NO-GO)
        bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "paused" "NO-GO verdict at $STEP" > /dev/null
        echo "{\"action\":\"pause\",\"step\":\"$STEP\",\"reason\":\"NO-GO verdict\"}"
        exit 2
        ;;
    esac
  fi

  # --- Post-implement source protection ---

  if [[ "$STEP" == "implement" ]]; then
    PROTECTION_RESULT=$(protect_sources)
    if [[ -n "$PROTECTION_RESULT" ]]; then
      echo "$PROTECTION_RESULT"
    fi
  fi

  # --- Update state ---

  bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "$STEP" > /dev/null

  # --- Gate check ---

  if [[ -f "$CONFIG_FILE" ]]; then
    GATE=$(jq -r ".gates[\"after-${STEP}\"] // empty" "$CONFIG_FILE" 2>/dev/null || true)
    if [[ -n "$GATE" ]]; then
      echo "{\"action\":\"gate\",\"step\":\"$STEP\",\"gate\":\"after-${STEP}\"}"
      exit 0
    fi
  fi

  echo "{\"step\":\"$STEP\",\"status\":\"complete\",\"progress\":\"$STEP_COUNT/$TOTAL_STEPS\",\"result\":$RESULT}"
done

# All steps complete
bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "completed" > /dev/null 2>&1 || true
echo "{\"status\":\"pipeline_complete\",\"flow\":\"$FLOW\",\"steps_completed\":$STEP_COUNT}"
exit 0
