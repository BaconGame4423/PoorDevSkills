#!/usr/bin/env bash
set -euo pipefail
# Usage: pipeline-runner.sh --flow <flow> --feature-dir <dir> --branch <branch> --project-dir <dir> [--completed step1,step2] [--summary "feature summary"] [--next]
#
# Runs the full pipeline sequentially, dispatching each step via dispatch-step.sh.
#
# stdout: JSONL (one JSON object per step event)
# exit code: 0=all complete, 1=error, 2=NO-GO pause, 3=rate-limit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=retry-helpers.sh
source "$SCRIPT_DIR/retry-helpers.sh"

# --- Safe git wrapper (prevents parent repo fallthrough) ---

_safe_git() {
  local dir="$1"; shift
  if [[ ! -d "$dir/.git" ]]; then
    echo "{\"warning\":\"git skipped: no .git in $dir\"}" >&2
    return 1
  fi
  git -C "$dir" "$@"
}

# --- Cleanup trap ---

cleanup_temp_files() {
  rm -f /tmp/poor-dev-result-*-$$.json 2>/dev/null || true
  rm -f /tmp/poor-dev-prompt-*-$$.txt 2>/dev/null || true
  rm -f /tmp/poor-dev-phase-scope-*-$$.txt 2>/dev/null || true
  rm -f /tmp/poor-dev-pipeline-ctx-*-$$.txt 2>/dev/null || true
}
trap cleanup_temp_files EXIT INT TERM

# --- Parse arguments ---

FLOW=""
FEATURE_DIR=""
BRANCH=""
PROJECT_DIR=""
COMPLETED_CSV=""
SUMMARY=""
INPUT_FILE=""
NEXT_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow)       FLOW="$2";        shift 2 ;;
    --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
    --branch)     BRANCH="$2";      shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --completed)  COMPLETED_CSV="$2"; shift 2 ;;
    --summary)    SUMMARY="$2";     shift 2 ;;
    --input-file) INPUT_FILE="$2";  shift 2 ;;
    --next)       NEXT_MODE=true;   shift ;;
    --resume)     shift ;;  # no-op: resume is automatic via pipeline-state.json
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --- Validate required arguments ---

if [[ -z "$FLOW" || -z "$FEATURE_DIR" || -z "$BRANCH" || -z "$PROJECT_DIR" ]]; then
  echo '{"error":"Missing required arguments: --flow, --feature-dir, --branch, --project-dir"}' >&2
  exit 1
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

# --- Validate .git exists (prevent parent repo fallthrough) ---
if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo '{"error":"FATAL: .git not found in project_dir. Aborting to prevent parent repo fallthrough.","project_dir":"'"$PROJECT_DIR"'"}'
  exit 1
fi

FD="$PROJECT_DIR/$FEATURE_DIR"

# --- Pipeline step lookup ---

get_pipeline_steps() {
  local flow="$1"
  case "$flow" in
    feature)
      echo "specify suggest plan planreview tasks tasksreview implement architecturereview qualityreview phasereview"
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

  # Clear any pending approval on resume
  PENDING_STATUS=$(jq -r '.status // "active"' "$STATE_FILE" 2>/dev/null || true)
  if [[ "$PENDING_STATUS" == "awaiting-approval" ]]; then
    bash "$SCRIPT_DIR/pipeline-state.sh" clear-approval "$FD" > /dev/null
  fi
fi

# implement が既に完了済みの場合（レジューム時）、後続レビューで impl ファイルを消さない
IMPLEMENT_COMPLETED=false
[[ -n "${COMPLETED_SET[implement]:-}" ]] && IMPLEMENT_COMPLETED=true

# --- Read config for timeouts ---

CONFIG_FILE="$PROJECT_DIR/.poor-dev/config.json"
if [[ -f "$CONFIG_FILE" ]]; then
  IDLE_TIMEOUT=$(jq -r '.polling.idle_timeout // 120' "$CONFIG_FILE")
  MAX_TIMEOUT=$(jq -r '.polling.max_timeout // 600' "$CONFIG_FILE")
else
  IDLE_TIMEOUT=120
  MAX_TIMEOUT=600
fi

# --- Step-specific timeout resolution ---
resolve_step_timeout() {
  local step="$1" field="$2" default="$3"
  if [[ -f "$CONFIG_FILE" ]]; then
    local val
    val=$(jq -r --arg s "$step" --arg f "$field" \
      '.polling.step_timeouts[$s][$f] // empty' "$CONFIG_FILE" 2>/dev/null)
    if [[ -n "$val" && "$val" != "null" ]]; then echo "$val"; return; fi
  fi
  echo "$default"
}

# --- Context arguments per step ---

context_args_for_step() {
  local step="$1"
  local fd="$2"
  local args=""

  case "$step" in
    specify)
      [[ -f "$fd/input.txt" ]] && args="--context input=$fd/input.txt"
      ;;
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
      # レビュータイプ別ログがあれば使用、なければ旧形式にフォールバック
      local _rl="$fd/review-log-${step}.yaml"
      [[ ! -f "$_rl" ]] && _rl="$fd/review-log.yaml"
      [[ -f "$_rl" ]] && args="$args --context review_log=$_rl"
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
    suggest)
      if [[ ! -f "$fd/spec.md" ]]; then
        echo "missing prerequisite: spec.md"
        return 1
      fi
      ;;
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
  local project_dir="${1:-$PROJECT_DIR}"
  local protected_files
  protected_files=$(_safe_git "$project_dir" diff --name-only HEAD 2>/dev/null || true)
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
      _safe_git "$project_dir" checkout HEAD -- $to_restore 2>/dev/null || true
      echo '{"warning":"Protected files were modified by implement step and have been restored","files":"'"$(echo "$to_restore" | xargs)"'"}'
    fi
  fi
}

# --- Validate no implementation files leaked from non-implement steps ---

IMPL_EXTENSIONS="html htm js ts jsx tsx mjs cjs css scss sass less py rb go rs java kt swift c cpp h sql vue svelte"

validate_no_impl_files() {
  local fd="$1" step="$2"
  local found_files=""
  for ext in $IMPL_EXTENSIONS; do
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      # Skip infrastructure/tooling directories
      case "$f" in */lib/*|*/node_modules/*|*/_runs/*|*/commands/*|*/agents/*) continue ;; esac
      found_files="$found_files $f"
    done < <(find "$fd" -maxdepth 3 -name "*.${ext}" -type f 2>/dev/null)
  done
  if [[ -n "$found_files" ]]; then
    for f in $found_files; do rm -f "$f"; done
    local basenames
    basenames=$(echo "$found_files" | xargs -n1 basename 2>/dev/null | xargs)
    echo "{\"warning\":\"Step '$step' generated impl files — deleted\",\"files\":\"$basenames\"}"
  fi
}

# --- Parse phases from tasks.md ---

parse_tasks_phases() {
  local tasks_file="$1"
  if [[ ! -f "$tasks_file" ]]; then
    return
  fi
  local line_num=0
  local prev_phase_num="" prev_phase_name="" prev_start=""
  while IFS= read -r line; do
    line_num=$((line_num + 1))
    if [[ "$line" =~ ^##[[:space:]]+Phase[[:space:]]+([0-9]+):[[:space:]]*(.*) ]]; then
      local phase_num="${BASH_REMATCH[1]}"
      local phase_name="${BASH_REMATCH[2]}"
      # Close previous phase
      if [[ -n "$prev_phase_num" ]]; then
        printf '%s\t%s\t%s\t%s\n' "$prev_phase_num" "$prev_phase_name" "$prev_start" "$((line_num - 1))"
      fi
      prev_phase_num="$phase_num"
      prev_phase_name="$phase_name"
      prev_start="$line_num"
    fi
  done < "$tasks_file"
  # Close last phase
  if [[ -n "$prev_phase_num" ]]; then
    printf '%s\t%s\t%s\t%s\n' "$prev_phase_num" "$prev_phase_name" "$prev_start" "$line_num"
  fi
}

# --- Update implement phase state in pipeline-state.json ---

update_implement_phase_state() {
  local state_file="$1" phase="$2"
  if [[ ! -f "$state_file" ]]; then
    return
  fi
  local updated
  updated=$(jq --arg phase "$phase" '
    .implement_phases_completed = ((.implement_phases_completed // []) + [$phase] | unique)
  ' "$state_file")
  echo "$updated" | jq '.' > "$state_file"
}

# --- Dispatch implement in phase-split mode ---

dispatch_implement_phases() {
  local fd="$1" project_dir="$2" feature_dir="$3" branch="$4" summary="$5" step_count="$6" total_steps="$7"
  local tasks_file="$fd/tasks.md"

  # Parse phases
  local phases
  phases=$(parse_tasks_phases "$tasks_file")

  # Fallback: no phases found → return 1 to signal caller to use single dispatch
  if [[ -z "$phases" ]]; then
    echo "{\"implement\":\"fallback\",\"reason\":\"no phases found in tasks.md\"}"
    return 1
  fi

  local phase_count
  phase_count=$(echo "$phases" | wc -l)
  echo "{\"implement\":\"phase-split\",\"phase_count\":$phase_count}"

  # Read completed phases from pipeline-state.json
  local completed_phases=""
  if [[ -f "$STATE_FILE" ]]; then
    completed_phases=$(jq -r '.implement_phases_completed[]?' "$STATE_FILE" 2>/dev/null || true)
  fi

  local phase_idx=0
  while IFS=$'\t' read -r phase_num phase_name start_line end_line; do
    phase_idx=$((phase_idx + 1))
    local phase_key="phase_${phase_num}"

    # Resume: skip already completed phases
    if echo "$completed_phases" | grep -qx "$phase_key" 2>/dev/null; then
      echo "{\"phase\":$phase_num,\"name\":\"$phase_name\",\"status\":\"skipped\",\"reason\":\"already completed\"}"
      continue
    fi

    echo "{\"phase\":$phase_num,\"name\":\"$phase_name\",\"status\":\"starting\",\"progress\":\"$phase_idx/$phase_count\"}"

    # --- Compose prompt with Phase Scope Directive ---
    local prompt_file="/tmp/poor-dev-prompt-implement-phase${phase_num}-$$.txt"
    local command_file=""
    local cmd_variant=""
    if [[ -f "$CONFIG_FILE" ]]; then
      cmd_variant=$(jq -r '.command_variant // ""' "$CONFIG_FILE" 2>/dev/null || true)
    fi
    if [[ -n "$cmd_variant" ]]; then
      for candidate in \
        "$project_dir/commands/poor-dev.implement-${cmd_variant}.md" \
        "$project_dir/.opencode/command/poor-dev.implement-${cmd_variant}.md"; do
        [[ -f "$candidate" ]] && command_file="$candidate" && break
      done
    fi
    if [[ -z "$command_file" ]]; then
      for candidate in \
        "$project_dir/commands/poor-dev.implement.md" \
        "$project_dir/.opencode/command/poor-dev.implement.md"; do
        [[ -f "$candidate" ]] && command_file="$candidate" && break
      done
    fi
    if [[ -z "$command_file" ]]; then
      echo "{\"implement\":\"error\",\"reason\":\"implement command file not found\"}"
      return 1
    fi

    # Build compose-prompt args
    local compose_args=(
      "$command_file"
      "$prompt_file"
      --header non_interactive
    )

    # Add standard context for implement
    [[ -f "$fd/tasks.md" ]] && compose_args+=(--context "tasks=$fd/tasks.md")
    [[ -f "$fd/plan.md" ]] && compose_args+=(--context "plan=$fd/plan.md")

    # Create Phase Scope Directive context file
    local phase_ctx="/tmp/poor-dev-phase-scope-${phase_num}-$$.txt"
    cat > "$phase_ctx" <<PHASE_EOF
## Phase Scope Directive
You are executing ONLY Phase ${phase_num}: ${phase_name}.
- Execute ONLY the uncompleted tasks (- [ ]) under "## Phase ${phase_num}:"
- Do NOT execute tasks from other phases
- Mark completed tasks with [X] in tasks.md
PHASE_EOF
    compose_args+=(--context "phase_scope=$phase_ctx")

    # Pipeline metadata context
    local pipeline_ctx="/tmp/poor-dev-pipeline-ctx-implement-phase${phase_num}-$$.txt"
    cat > "$pipeline_ctx" <<CTX_EOF
- FEATURE_DIR: ${feature_dir}
- BRANCH: ${branch}
- Feature: ${summary}
- Step: implement phase ${phase_num}/${phase_count} (${step_count}/${total_steps})
CTX_EOF
    compose_args+=(--context "pipeline=$pipeline_ctx")

    bash "$SCRIPT_DIR/compose-prompt.sh" "${compose_args[@]}"

    # --- Dispatch with retry ---
    local pre_phase_head
    pre_phase_head=$(_safe_git "$project_dir" rev-parse HEAD 2>/dev/null || echo "")

    # Pre-retry hook for implement: clean uncommitted changes
    _impl_phase_pre_retry() {
      _safe_git "$project_dir" checkout -- . 2>/dev/null || true
      _safe_git "$project_dir" clean -fd --exclude='specs/' 2>/dev/null || true
    }

    local impl_result_file="/tmp/poor-dev-result-implement-phase${phase_num}-$$.json"
    local impl_idle impl_max
    impl_idle=$(resolve_step_timeout "implement" "idle_timeout" "$IDLE_TIMEOUT")
    impl_max=$(resolve_step_timeout "implement" "max_timeout" "$MAX_TIMEOUT")
    dispatch_with_retry "implement" "$project_dir" "$prompt_file" \
      "$impl_idle" "$impl_max" "$impl_result_file" "" "_impl_phase_pre_retry" || {
      local dispatch_exit=$?
      local result=""
      if [[ -f "$impl_result_file" ]]; then
        result=$(cat "$impl_result_file")
      fi
      : "${result:={}}"
      rm -f "$prompt_file" "$phase_ctx" "$pipeline_ctx" "$impl_result_file" 2>/dev/null || true

      local rate_count
      rate_count=$(check_rate_limit)
      if [[ "$rate_count" -gt 0 ]]; then
        bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$fd" "rate-limited" "Rate limit at implement phase $phase_num" > /dev/null
        echo "{\"phase\":$phase_num,\"status\":\"rate-limited\",\"rate_limit_count\":$rate_count}"
        exit 3
      fi
      echo "{\"phase\":$phase_num,\"status\":\"error\",\"exit_code\":$dispatch_exit,\"result\":$(echo "$result" | jq -R -s '.')}"
      exit 1
    }

    # Read result from file + cleanup temp files
    local result=""
    if [[ -f "$impl_result_file" ]]; then
      result=$(cat "$impl_result_file")
    fi
    : "${result:={}}"
    rm -f "$prompt_file" "$phase_ctx" "$pipeline_ctx" "$impl_result_file" 2>/dev/null || true

    # Post-phase source protection
    local protection_result
    protection_result=$(protect_sources "$project_dir")
    if [[ -n "$protection_result" ]]; then
      echo "$protection_result"
    fi

    # Post-phase file generation check
    local phase_files=""
    if [[ -n "$pre_phase_head" ]]; then
      phase_files=$(_safe_git "$project_dir" diff --name-only "$pre_phase_head" HEAD 2>/dev/null || true)
    fi
    local uncommitted
    uncommitted=$(_safe_git "$project_dir" diff --name-only 2>/dev/null || true)
    uncommitted="${uncommitted}$(printf '\n')$(_safe_git "$project_dir" diff --name-only --cached 2>/dev/null || true)"
    phase_files="${phase_files}${uncommitted}"
    phase_files=$(echo "$phase_files" | grep -vE '^$|^(agents/|commands/|lib/|\.poor-dev/|\.opencode/|\.claude/)' | sort -u || true)
    if [[ -z "$phase_files" ]]; then
      echo "{\"phase\":$phase_num,\"warning\":\"no new files detected after phase completion\"}"
    fi

    # Commit phase artifacts to protect from subsequent retry cleanup
    if [[ -n "$phase_files" ]]; then
      _safe_git "$project_dir" add -A 2>/dev/null || true
      _safe_git "$project_dir" reset HEAD -- agents/ commands/ lib/ .poor-dev/ .opencode/ .claude/ 2>/dev/null || true
      if ! _safe_git "$project_dir" commit -m "implement: phase ${phase_num} - ${phase_name}" --no-verify 2>/dev/null; then
        echo "{\"phase\":$phase_num,\"warning\":\"git commit failed for phase ${phase_num}, artifacts remain uncommitted\"}"
      fi
    fi

    # Update phase state
    update_implement_phase_state "$STATE_FILE" "$phase_key"

    echo "{\"phase\":$phase_num,\"name\":\"$phase_name\",\"status\":\"complete\",\"progress\":\"$phase_idx/$phase_count\"}"
  done <<< "$phases"

  return 0
}

# ============================================================
# Main dispatch loop
# ============================================================

# Resolve pipeline steps: prefer saved pipeline in state file, fallback to flow default
PIPELINE_STEPS=""
if [[ -f "$STATE_FILE" ]]; then
  PIPELINE_TYPE=$(jq -r '.pipeline | type' "$STATE_FILE" 2>/dev/null || echo "null")
  if [[ "$PIPELINE_TYPE" == "array" ]]; then
    PIPELINE_LEN=$(jq -r '.pipeline | length' "$STATE_FILE" 2>/dev/null || echo "0")
    if [[ "$PIPELINE_LEN" -gt 0 ]]; then
      PIPELINE_STEPS=$(jq -r '.pipeline[]' "$STATE_FILE" 2>/dev/null | tr '\n' ' ' || true)
    fi
  fi
fi
if [[ -z "$PIPELINE_STEPS" ]]; then
  PIPELINE_STEPS=$(get_pipeline_steps "$FLOW") || exit 1
fi

# Initialize pipeline state
STEPS_JSON=$(echo "$PIPELINE_STEPS" | tr ' ' '\n' | jq -R . | jq -s .)
if [[ ! -f "$STATE_FILE" ]]; then
  bash "$SCRIPT_DIR/pipeline-state.sh" init "$FD" "$FLOW" "$STEPS_JSON" > /dev/null
fi

STEP_COUNT=0
TOTAL_STEPS=$(echo "$PIPELINE_STEPS" | wc -w)

# --next: restrict to the next incomplete step only
if [[ "$NEXT_MODE" == "true" ]]; then
  FOUND_NEXT=false
  NEXT_STEP_NUM=0
  for CANDIDATE in $PIPELINE_STEPS; do
    NEXT_STEP_NUM=$((NEXT_STEP_NUM + 1))
    if [[ -z "${COMPLETED_SET[$CANDIDATE]:-}" ]]; then
      PIPELINE_STEPS="$CANDIDATE"
      STEP_COUNT=$((NEXT_STEP_NUM - 1))
      FOUND_NEXT=true
      break
    fi
  done
  if [[ "$FOUND_NEXT" != "true" ]]; then
    # All steps completed
    bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "completed" > /dev/null 2>&1 || true
    echo '{"status":"pipeline_complete","flow":"'"$FLOW"'","steps_completed":'"$TOTAL_STEPS"'}'
    exit 0
  fi
fi

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

  # Warn if unresolved clarifications exist
  if [[ "$STEP" == "suggest" ]] && [[ -f "$FD/pending-clarifications.json" ]]; then
    echo "{\"step\":\"$STEP\",\"warning\":\"unresolved clarifications exist in pending-clarifications.json\"}"
  fi

  echo "{\"step\":\"$STEP\",\"status\":\"starting\",\"progress\":\"$STEP_COUNT/$TOTAL_STEPS\"}"

  # --- L3: Pre-implement validation + Phase-split dispatch ---

  if [[ "$STEP" == "implement" ]]; then
    # L3: Clean up any impl files leaked from prior steps (skip on phase-split resume)
    _impl_completed=""
    if [[ -f "$STATE_FILE" ]]; then
      _impl_completed=$(jq -r '.implement_phases_completed[]?' "$STATE_FILE" 2>/dev/null || true)
    fi
    if [[ -z "$_impl_completed" ]]; then
      IMPL_CLEANUP=$(validate_no_impl_files "$FD" "pre-implement")
      if [[ -n "$IMPL_CLEANUP" ]]; then
        echo "$IMPL_CLEANUP"
      fi
    fi

    # Attempt phase-split dispatch
    if dispatch_implement_phases "$FD" "$PROJECT_DIR" "$FEATURE_DIR" "$BRANCH" "$SUMMARY" "$STEP_COUNT" "$TOTAL_STEPS"; then
      # Phase-split succeeded — run post-implement protection and mark complete
      PROTECTION_RESULT=$(protect_sources "$PROJECT_DIR")
      if [[ -n "$PROTECTION_RESULT" ]]; then
        echo "$PROTECTION_RESULT"
      fi
      bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "$STEP" > /dev/null
      IMPLEMENT_COMPLETED=true
      echo "{\"step\":\"$STEP\",\"status\":\"step_complete\",\"progress\":\"$STEP_COUNT/$TOTAL_STEPS\",\"mode\":\"phase-split\"}"
      continue
    fi
    # Fallback: no phases found — continue to single dispatch below
    echo "{\"step\":\"$STEP\",\"status\":\"fallback\",\"reason\":\"no phases in tasks.md\"}"
  fi

  # --- Review step: bash-driven mode (review_mode=bash) ---

  if is_review "$STEP"; then
    REVIEW_MODE="llm"
    if [[ -f "$CONFIG_FILE" ]]; then
      REVIEW_MODE=$(jq -r '.review_mode // "llm"' "$CONFIG_FILE" 2>/dev/null || echo "llm")
    fi

    if [[ "$REVIEW_MODE" == "bash" ]]; then
      # Determine target file for review
      REVIEW_TARGET=""
      case "$STEP" in
        planreview)          REVIEW_TARGET="$FD/plan.md" ;;
        tasksreview)         REVIEW_TARGET="$FD/tasks.md" ;;
        architecturereview)  REVIEW_TARGET="$FD" ;;
        qualityreview)       REVIEW_TARGET="$FD" ;;
        phasereview)         REVIEW_TARGET="$FD" ;;
      esac

      echo "{\"step\":\"$STEP\",\"status\":\"review-bash\",\"mode\":\"bash\"}"
      REVIEW_RESULT=$(bash "$SCRIPT_DIR/review-runner.sh" \
        --type "$STEP" \
        --target "${REVIEW_TARGET:-$FD}" \
        --feature-dir "$FEATURE_DIR" \
        --project-dir "$PROJECT_DIR" 2>&1) || {
        REVIEW_EXIT=$?
        echo "$REVIEW_RESULT"

        if [[ $REVIEW_EXIT -eq 3 ]]; then
          bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "rate-limited" "Rate limit at review $STEP" > /dev/null
          exit 3
        elif [[ $REVIEW_EXIT -eq 2 ]]; then
          bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "paused" "NO-GO verdict at $STEP" > /dev/null
          echo "{\"action\":\"pause\",\"step\":\"$STEP\",\"reason\":\"NO-GO verdict\"}"
          exit 2
        else
          echo "{\"step\":\"$STEP\",\"warning\":\"review-runner.sh exited with code $REVIEW_EXIT\"}"
        fi
      }
      echo "$REVIEW_RESULT"

      bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "$STEP" > /dev/null
      echo "{\"step\":\"$STEP\",\"status\":\"step_complete\",\"progress\":\"$STEP_COUNT/$TOTAL_STEPS\",\"mode\":\"bash\"}"
      continue
    fi
  fi

  # --- Resolve command file (variant support) ---

  PROMPT_FILE="/tmp/poor-dev-prompt-${STEP}-$$.txt"
  COMMAND_FILE=""

  # Check for command_variant in config
  CMD_VARIANT=""
  if [[ -f "$CONFIG_FILE" ]]; then
    CMD_VARIANT=$(jq -r '.command_variant // ""' "$CONFIG_FILE" 2>/dev/null || true)
  fi

  # Variant resolution chain:
  # 1. commands/poor-dev.${STEP}-${variant}.md (if variant set)
  # 2. .opencode/command/poor-dev.${STEP}-${variant}.md (if variant set)
  # 3. commands/poor-dev.${STEP}.md (fallback)
  # 4. .opencode/command/poor-dev.${STEP}.md (fallback)
  if [[ -n "$CMD_VARIANT" ]]; then
    for candidate in \
      "$PROJECT_DIR/commands/poor-dev.${STEP}-${CMD_VARIANT}.md" \
      "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}-${CMD_VARIANT}.md"; do
      if [[ -f "$candidate" ]]; then
        COMMAND_FILE="$candidate"
        break
      fi
    done
  fi

  if [[ -z "$COMMAND_FILE" ]]; then
    for candidate in \
      "$PROJECT_DIR/commands/poor-dev.${STEP}.md" \
      "$PROJECT_DIR/.opencode/command/poor-dev.${STEP}.md"; do
      if [[ -f "$candidate" ]]; then
        COMMAND_FILE="$candidate"
        break
      fi
    done
  fi

  if [[ -z "$COMMAND_FILE" ]]; then
    echo "{\"step\":\"$STEP\",\"error\":\"Command file not found: poor-dev.${STEP}.md\"}"
    exit 1
  fi

  # Build compose-prompt args
  COMPOSE_ARGS=(
    "$COMMAND_FILE"
    "$PROMPT_FILE"
    --header non_interactive
  )

  # specify step needs readonly header
  if [[ "$STEP" == "specify" ]]; then
    COMPOSE_ARGS+=(--header readonly)
  fi

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

  # --- Dispatch with retry ---

  RESULT_FILE="/tmp/poor-dev-result-${STEP}-$$.json"
  STEP_IDLE=$(resolve_step_timeout "$STEP" "idle_timeout" "$IDLE_TIMEOUT")
  STEP_MAX=$(resolve_step_timeout "$STEP" "max_timeout" "$MAX_TIMEOUT")

  # implement step: add pre-retry hook for git cleanup
  MAIN_PRE_RETRY_HOOK=""
  if [[ "$STEP" == "implement" ]]; then
    _main_impl_pre_retry() {
      _safe_git "$PROJECT_DIR" checkout -- . 2>/dev/null || true
      _safe_git "$PROJECT_DIR" clean -fd --exclude='specs/' 2>/dev/null || true
    }
    MAIN_PRE_RETRY_HOOK="_main_impl_pre_retry"
  fi

  dispatch_with_retry "$STEP" "$PROJECT_DIR" "$PROMPT_FILE" \
    "$STEP_IDLE" "$STEP_MAX" "$RESULT_FILE" "" "$MAIN_PRE_RETRY_HOOK" || {
    DISPATCH_EXIT=$?
    RESULT=""
    if [[ -f "$RESULT_FILE" ]]; then
      RESULT=$(cat "$RESULT_FILE")
    fi
    : "${RESULT:={}}"
    rm -f "$PROMPT_FILE" "$RESULT_FILE" "${PIPELINE_CTX:-/dev/null}" 2>/dev/null || true

    # Rate limit check
    RATE_COUNT=$(check_rate_limit)
    if [[ "$RATE_COUNT" -gt 0 ]]; then
      bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "rate-limited" "Rate limit at step $STEP" > /dev/null
      echo "{\"step\":\"$STEP\",\"status\":\"rate-limited\",\"rate_limit_count\":$RATE_COUNT}"
      exit 3
    fi

    echo "{\"step\":\"$STEP\",\"status\":\"error\",\"exit_code\":$DISPATCH_EXIT,\"result\":$(echo "$RESULT" | jq -R -s '.')}"
    exit 1
  }

  # Read result from file
  RESULT=""
  if [[ -f "$RESULT_FILE" ]]; then
    RESULT=$(cat "$RESULT_FILE")
  fi
  : "${RESULT:={}}"
  rm -f "$PROMPT_FILE" "$RESULT_FILE" "${PIPELINE_CTX:-/dev/null}" 2>/dev/null || true

  # --- Post-step: extract output to artifact files ---

  STEP_OUTPUT=$(ls -t /tmp/poor-dev-output-${STEP}-*.txt 2>/dev/null | head -1 || true)
  if [[ -n "$STEP_OUTPUT" && -f "$STEP_OUTPUT" ]]; then
    SAVE_TO=""
    case "$STEP" in
      specify)  SAVE_TO="$FD/spec.md" ;;
      suggest)  SAVE_TO="$FD/suggestions.yaml" ;;
      plan)     SAVE_TO="$FD/plan.md" ;;
      tasks)    SAVE_TO="$FD/tasks.md" ;;
    esac

    if [[ -n "$SAVE_TO" ]]; then
      EXTRACT_RESULT=$(bash "$SCRIPT_DIR/extract-output.sh" "$STEP_OUTPUT" "$SAVE_TO" 2>/dev/null || true)
      if [[ -z "$EXTRACT_RESULT" ]] || echo "$EXTRACT_RESULT" | jq -e '.error' > /dev/null 2>&1; then
        echo "{\"step\":\"$STEP\",\"status\":\"error\",\"reason\":\"output extraction failed\",\"detail\":$(echo "$EXTRACT_RESULT" | jq -R -s '.')}"
        exit 1
      fi
    fi
  fi

  # Validate critical artifacts
  if [[ "$STEP" == "specify" ]]; then
    if [[ ! -f "$FD/spec.md" ]] || [[ ! -s "$FD/spec.md" ]]; then
      echo "{\"step\":\"specify\",\"status\":\"error\",\"reason\":\"spec.md not extracted\"}"
      exit 1
    fi
  fi

  # Post-tasks: validate format
  if [[ "$STEP" == "tasks" && -f "$FD/tasks.md" ]]; then
    TASKS_VALIDATE=$(bash "$SCRIPT_DIR/tasks-validate.sh" "$FD/tasks.md" 2>/dev/null || true)
    if [[ -n "$TASKS_VALIDATE" ]]; then
      TASKS_VALID=$(echo "$TASKS_VALIDATE" | jq -r '.valid' 2>/dev/null || true)
      if [[ "$TASKS_VALID" == "false" ]]; then
        echo "{\"step\":\"tasks\",\"warning\":\"tasks.md format validation failed\",\"validation\":$TASKS_VALIDATE}"
      fi
    fi
  fi

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
    OUTPUT_FILE=$(ls -t /tmp/poor-dev-output-${STEP}-*.txt 2>/dev/null | head -1 || true)

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
    PROTECTION_RESULT=$(protect_sources "$PROJECT_DIR")
    if [[ -n "$PROTECTION_RESULT" ]]; then
      echo "$PROTECTION_RESULT"
    fi
    IMPLEMENT_COMPLETED=true
  fi

  # --- L2: Post-step impl file validation (non-implement steps) ---

  if [[ "$STEP" != "implement" ]] && [[ "$IMPLEMENT_COMPLETED" != "true" ]]; then
    IMPL_CLEANUP=$(validate_no_impl_files "$FD" "$STEP")
    if [[ -n "$IMPL_CLEANUP" ]]; then
      echo "$IMPL_CLEANUP"
    fi
  fi

  # --- Update state ---

  bash "$SCRIPT_DIR/pipeline-state.sh" complete-step "$FD" "$STEP" > /dev/null

  # --- Read auto_approve once per step ---
  AUTO_APPROVE="false"
  if [[ -f "$CONFIG_FILE" ]]; then
    AUTO_APPROVE=$(jq -r '.auto_approve // false' "$CONFIG_FILE" 2>/dev/null || echo "false")
  fi

  # --- Clarification gate (after specify) ---
  if [[ "$STEP" == "specify" ]]; then
    CLARIFICATIONS=$(echo "$RESULT" | jq -r '.clarifications | length' 2>/dev/null || echo "0")
    if [[ "$CLARIFICATIONS" -gt 0 ]]; then
      # Save clarifications atomically for orchestrator / /poor-dev.clarify
      echo "$RESULT" | jq '.clarifications' > "$FD/pending-clarifications.json.tmp"
      mv "$FD/pending-clarifications.json.tmp" "$FD/pending-clarifications.json"

      bash "$SCRIPT_DIR/pipeline-state.sh" set-approval "$FD" "clarification" "$STEP" > /dev/null
      echo ""
      echo "=== 仕様の確認事項 ==="
      echo "$RESULT" | jq -r '.clarifications[]' 2>/dev/null | sed 's/\[NEEDS CLARIFICATION: //;s/\]$//' | nl -ba
      echo ""
      echo "{\"step\":\"$STEP\",\"status\":\"awaiting-approval\",\"type\":\"clarification\"}"
      exit 2
    fi
  fi

  # --- Gate check ---

  if [[ -f "$CONFIG_FILE" ]]; then
    GATE=$(jq -r ".gates[\"after-${STEP}\"] // empty" "$CONFIG_FILE" 2>/dev/null || true)
    if [[ -n "$GATE" ]]; then
      if [[ "$AUTO_APPROVE" != "true" ]]; then
        bash "$SCRIPT_DIR/pipeline-state.sh" set-approval "$FD" "gate" "$STEP" > /dev/null
        echo "{\"action\":\"gate\",\"step\":\"$STEP\",\"gate\":\"after-${STEP}\"}"
        exit 2
      fi
    fi
  fi

  COMPLETED_COUNT=$(jq -r '.completed | length' "$STATE_FILE" 2>/dev/null || echo "$STEP_COUNT")
  echo "{\"step\":\"$STEP\",\"status\":\"step_complete\",\"progress\":\"$COMPLETED_COUNT/$TOTAL_STEPS\",\"result\":$RESULT}"
done

# --next mode: 1 ステップ実行済み。pipeline_complete は出さない。
# 次回 --next 呼び出し時に L499-503 が全完了を検知して pipeline_complete を出力する。
if [[ "$NEXT_MODE" == "true" ]]; then
  exit 0
fi

# All steps complete (full pipeline mode)
bash "$SCRIPT_DIR/pipeline-state.sh" set-status "$FD" "completed" > /dev/null 2>&1 || true
echo "{\"status\":\"pipeline_complete\",\"flow\":\"$FLOW\",\"steps_completed\":$STEP_COUNT}"
exit 0
