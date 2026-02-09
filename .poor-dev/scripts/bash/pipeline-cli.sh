#!/usr/bin/env bash
#
# Pipeline CLI Orchestrator
# Manages tmux sessions and coordinates step execution via claude -p / opencode run.
#
# Usage (called by poor-dev-cli entrypoint):
#   pipeline-cli.sh --description "desc" [--runtime R] [--model M] [--config C]
#                   [--from STEP] [--feature-dir DIR] [--no-confirm]
#
# Each pipeline step runs in its own tmux window as an independent process.
# Dashboard occupies window 0.

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/pipeline-ui.sh"

REPO_ROOT="$(get_repo_root)"
STATE_SCRIPT="$SCRIPT_DIR/pipeline-state.sh"
DASHBOARD_SCRIPT="$SCRIPT_DIR/pipeline-dashboard.sh"

# --- Configuration ---
DESCRIPTION=""
OPT_RUNTIME=""
OPT_MODEL=""
CONFIG_FILE="$REPO_ROOT/.poor-dev/pipeline-config.yaml"
FROM_STEP=""
FEATURE_DIR=""
NO_CONFIRM=false
SESSION_NAME=""
CONTROL_PIPE=""

# Step ordering (matches workflow-state-template.yaml)
ALL_STEPS=(triage specify clarify plan planreview tasks tasksreview architecturereview implement qualityreview phasereview)

# Step arguments mapping
declare -A STEP_ARGS_MAP

# --- Parse arguments ---
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --description) DESCRIPTION="$2"; shift 2 ;;
            --runtime) OPT_RUNTIME="$2"; shift 2 ;;
            --model) OPT_MODEL="$2"; shift 2 ;;
            --config) CONFIG_FILE="$2"; shift 2 ;;
            --from) FROM_STEP="$2"; shift 2 ;;
            --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
            --no-confirm) NO_CONFIRM=true; shift ;;
            *) echo "ERROR: Unknown option '$1'" >&2; exit 1 ;;
        esac
    done
}

# --- Config helpers ---
get_config_default() {
    local field="$1"
    if [[ -f "$CONFIG_FILE" ]]; then
        yq ".defaults.$field // \"\"" "$CONFIG_FILE" 2>/dev/null | grep -v '^null$' || echo ""
    else
        echo ""
    fi
}

get_step_runtime() {
    local step="$1"

    # CLI override first
    if [[ -n "$OPT_RUNTIME" ]]; then
        echo "$OPT_RUNTIME"
        return
    fi

    # Step-specific config
    if [[ -f "$CONFIG_FILE" ]]; then
        local val
        val="$(yq ".steps.$step.runtime // \"\"" "$CONFIG_FILE" 2>/dev/null)"
        if [[ -n "$val" && "$val" != "null" ]]; then
            echo "$val"
            return
        fi
    fi

    # Default from config
    local def
    def="$(get_config_default "runtime")"
    echo "${def:-claude}"
}

get_step_model() {
    local step="$1"

    # CLI override first
    if [[ -n "$OPT_MODEL" ]]; then
        echo "$OPT_MODEL"
        return
    fi

    # Step-specific config
    if [[ -f "$CONFIG_FILE" ]]; then
        local val
        val="$(yq ".steps.$step.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
        if [[ -n "$val" && "$val" != "null" ]]; then
            echo "$val"
            return
        fi
    fi

    # Default from config
    local def
    def="$(get_config_default "model")"
    echo "${def:-sonnet}"
}

get_max_budget() {
    local val
    val="$(get_config_default "max_budget_usd")"
    echo "${val:-5.0}"
}

get_confirm_setting() {
    if $NO_CONFIRM; then
        echo "false"
        return
    fi
    local val
    val="$(get_config_default "confirm")"
    echo "${val:-true}"
}

# --- tmux management ---
setup_tmux() {
    SESSION_NAME="poor-dev-$(date +%s)"
    CONTROL_PIPE="/tmp/${SESSION_NAME}-control"
    mkfifo "$CONTROL_PIPE" 2>/dev/null || true

    # Create tmux session with a shell (dashboard starts later when FEATURE_DIR is available)
    tmux new-session -d -s "$SESSION_NAME" -n "dashboard"

    # Start dashboard now if FEATURE_DIR is available (--from mode)
    if [[ -n "$FEATURE_DIR" && -f "$FEATURE_DIR/workflow-state.yaml" ]]; then
        tmux send-keys -t "$SESSION_NAME:dashboard" \
            "bash '$DASHBOARD_SCRIPT' '$FEATURE_DIR' --control-pipe '$CONTROL_PIPE'" Enter
    fi

    # Configure status bar
    tmux set-option -t "$SESSION_NAME" status on
    tmux set-option -t "$SESSION_NAME" status-style "bg=colour235,fg=colour245"
    tmux set-option -t "$SESSION_NAME" status-left \
        "#[fg=colour214] ⌨ p:pause s:skip q:quit m:msg ←→:tab #[fg=colour245]|"

    local branch_info=""
    if [[ -n "$FEATURE_DIR" && -f "$FEATURE_DIR/workflow-state.yaml" ]]; then
        branch_info="$(yq '.feature.branch // ""' "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null || echo '')"
    fi
    tmux set-option -t "$SESSION_NAME" status-right \
        "#[fg=colour245]| #[fg=colour82]$branch_info"

    echo "$SESSION_NAME"
}

create_worker_window() {
    local step="$1"
    local step_num="$2"
    local window_name="${step}"

    tmux new-window -t "$SESSION_NAME" -n "$window_name"
    echo "$window_name"
}

update_window_name() {
    local window_name="$1"
    local status_icon="$2"
    tmux rename-window -t "$SESSION_NAME:$window_name" "${window_name}${status_icon}" 2>/dev/null || true
}

# --- Runtime invocation ---
invoke_runtime() {
    local runtime="$1"
    local model="$2"
    local step="$3"
    local args="$4"
    local max_budget
    max_budget="$(get_max_budget)"

    local skill_prompt
    if [[ -n "$args" ]]; then
        skill_prompt="Use the Skill tool to invoke /poor-dev.$step with args '$args'"
    else
        skill_prompt="Use the Skill tool to invoke /poor-dev.$step"
    fi

    case "$runtime" in
        claude)
            claude -p \
                --model "$model" \
                --dangerously-skip-permissions \
                --session-id "$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || date +%s%N)" \
                --max-budget-usd "$max_budget" \
                "$skill_prompt" 2>&1
            ;;
        opencode)
            opencode run \
                --model "$model" \
                "/poor-dev.$step $args" 2>&1
            ;;
        *)
            echo "ERROR: Unknown runtime '$runtime'" >&2
            return 1
            ;;
    esac
}

# --- Step execution ---
run_step() {
    local step="$1"
    local args="${2:-}"
    local step_num="$3"
    local total_steps="$4"
    local runtime model exit_code

    runtime="$(get_step_runtime "$step")"
    model="$(get_step_model "$step")"

    # Update state to in_progress
    "$STATE_SCRIPT" update "$FEATURE_DIR" "$step" "in_progress" 2>/dev/null || true

    # Create worker window
    local window_name
    window_name="$(create_worker_window "$step" "$step_num")"

    # Run in the tmux worker window
    local log_file="/tmp/${SESSION_NAME}-${step}.log"
    tmux send-keys -t "$SESSION_NAME:$window_name" \
        "bash -c '$(printf '%q' "$DASHBOARD_SCRIPT") --worker-header $(printf '%q' "$step") $(printf '%q' "$step_num") $(printf '%q' "$total_steps") && $(printf '%q' "$(build_invoke_cmd "$runtime" "$model" "$step" "$args")") 2>&1 | tee $(printf '%q' "$log_file"); echo \"\$?\" > /tmp/${SESSION_NAME}-${step}.exit'" Enter

    # Wait for completion
    local max_wait=3600  # 1 hour max per step
    local waited=0
    local exit_file="/tmp/${SESSION_NAME}-${step}.exit"

    while [[ ! -f "$exit_file" ]] && (( waited < max_wait )); do
        sleep 2
        ((waited += 2))

        # Check for control pipe messages
        if [[ -p "$CONTROL_PIPE" ]]; then
            local action=""
            read -t 0.1 action < "$CONTROL_PIPE" 2>/dev/null || true
            case "$action" in
                quit) cleanup_and_exit 0 ;;
                pause)
                    echo "PAUSED" > "/tmp/${SESSION_NAME}-paused"
                    ;;
            esac
        fi
    done

    # Read exit code
    exit_code=1
    if [[ -f "$exit_file" ]]; then
        exit_code="$(cat "$exit_file")"
        rm -f "$exit_file"
    fi

    # Verify step completion
    if [[ "$exit_code" -ne 0 ]]; then
        handle_step_failure "$step" "$exit_code" "$args" "$step_num" "$total_steps"
        return $?
    fi

    # Verify state file was updated
    local step_status
    step_status="$(yq ".pipeline.steps[] | select(.id == \"$step\") | .status" "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"

    case "$step_status" in
        completed|skipped)
            update_window_name "$window_name" "✓"
            return 0
            ;;
        *)
            # Exit code 0 but state not updated — partial failure
            handle_partial_failure "$step" "$step_status"
            return 1
            ;;
    esac
}

build_invoke_cmd() {
    local runtime="$1" model="$2" step="$3" args="$4"
    local max_budget
    max_budget="$(get_max_budget)"

    local skill_prompt
    if [[ -n "$args" ]]; then
        skill_prompt="Use the Skill tool to invoke /poor-dev.$step with args '${args//\'/\'\\\'\'}'"
    else
        skill_prompt="Use the Skill tool to invoke /poor-dev.$step"
    fi

    case "$runtime" in
        claude)
            printf 'claude -p --model %q --dangerously-skip-permissions --max-budget-usd %q %q' \
                "$model" "$max_budget" "$skill_prompt"
            ;;
        opencode)
            printf 'opencode run --model %q %q' \
                "$model" "/poor-dev.$step $args"
            ;;
    esac
}

# --- Error handling ---
handle_step_failure() {
    local step="$1" exit_code="$2" args="$3" step_num="$4" total_steps="$5"
    local retries=0 max_retries=3
    local delays=(5 15 45)

    while (( retries < max_retries )); do
        echo "Step '$step' failed (exit $exit_code). Retry $((retries+1))/$max_retries in ${delays[$retries]}s..." >&2
        sleep "${delays[$retries]}"
        ((retries++))

        # Update state back to pending for retry
        "$STATE_SCRIPT" update "$FEATURE_DIR" "$step" "in_progress" 2>/dev/null || true

        local runtime model
        runtime="$(get_step_runtime "$step")"
        model="$(get_step_model "$step")"
        local log_file="/tmp/${SESSION_NAME}-${step}-retry${retries}.log"
        local exit_file="/tmp/${SESSION_NAME}-${step}.exit"
        rm -f "$exit_file"

        local window_name="${step}"
        tmux send-keys -t "$SESSION_NAME:$window_name" \
            "bash -c '$(printf '%q' "$(build_invoke_cmd "$runtime" "$model" "$step" "$args")") 2>&1 | tee $(printf '%q' "$log_file"); echo \"\$?\" > $(printf '%q' "$exit_file")'" Enter

        # Wait for retry
        local waited=0
        while [[ ! -f "$exit_file" ]] && (( waited < 3600 )); do
            sleep 2
            ((waited += 2))
        done

        exit_code=1
        if [[ -f "$exit_file" ]]; then
            exit_code="$(cat "$exit_file")"
            rm -f "$exit_file"
        fi

        if [[ "$exit_code" -eq 0 ]]; then
            local step_status
            step_status="$(yq ".pipeline.steps[] | select(.id == \"$step\") | .status" "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"
            if [[ "$step_status" == "completed" || "$step_status" == "skipped" ]]; then
                return 0
            fi
        fi
    done

    # All retries exhausted — mark failed and prompt user
    "$STATE_SCRIPT" update "$FEATURE_DIR" "$step" "failed" 2>/dev/null || true
    update_window_name "$step" "✗"

    prompt_failure_action "$step"
}

handle_partial_failure() {
    local step="$1" status="$2"
    echo "WARNING: Step '$step' exited 0 but state is '$status' (expected completed/skipped)" >&2
    "$STATE_SCRIPT" update "$FEATURE_DIR" "$step" "failed" \
        --summary "Partial failure: exit 0 but state=$status" 2>/dev/null || true
    update_window_name "$step" "✗"
    prompt_failure_action "$step"
}

prompt_failure_action() {
    local step="$1"

    # Switch to dashboard and show prompt
    tmux select-window -t "$SESSION_NAME:dashboard"

    echo ""
    printf "%b✗ Step '%s' failed after retries.%b\n" "$C_FAILED" "$step" "$C_RESET"
    echo ""
    printf "  %b[r]%b retry   %b[s]%b skip   %b[q]%b quit\n" \
        "$C_KEY" "$C_RESET" "$C_KEY" "$C_RESET" "$C_KEY" "$C_RESET"

    while true; do
        read -rsn1 choice
        case "$choice" in
            r|R) return 1 ;;  # Will be caught by caller to retry
            s|S)
                "$STATE_SCRIPT" update "$FEATURE_DIR" "$step" "skipped" 2>/dev/null || true
                update_window_name "$step" "○"
                return 0
                ;;
            q|Q) cleanup_and_exit 1 ;;
        esac
    done
}

# --- Triage bootstrap ---
bootstrap_triage() {
    local runtime model max_budget
    runtime="$(get_step_runtime "triage")"
    model="$(get_step_model "triage")"
    max_budget="$(get_max_budget)"

    # Mark triage as in_progress (but we need to init state first after triage creates the branch)
    # For triage, we invoke directly since no feature dir exists yet
    local skill_prompt="Use the Skill tool to invoke /poor-dev.triage with args '$DESCRIPTION'"

    local triage_log="/tmp/${SESSION_NAME}-triage.log"
    local triage_exit="/tmp/${SESSION_NAME}-triage.exit"

    # Create triage window
    tmux new-window -t "$SESSION_NAME" -n "triage"
    tmux send-keys -t "$SESSION_NAME:triage" \
        "bash -c '$(printf '%q' "$(build_invoke_cmd "$runtime" "$model" "triage" "$DESCRIPTION")") 2>&1 | tee $(printf '%q' "$triage_log"); echo \"\$?\" > $(printf '%q' "$triage_exit")'" Enter

    # Wait for triage completion
    local waited=0
    while [[ ! -f "$triage_exit" ]] && (( waited < 3600 )); do
        sleep 2
        ((waited += 2))
    done

    local exit_code=1
    if [[ -f "$triage_exit" ]]; then
        exit_code="$(cat "$triage_exit")"
        rm -f "$triage_exit"
    fi

    if [[ "$exit_code" -ne 0 ]]; then
        echo "ERROR: Triage step failed with exit code $exit_code" >&2
        return 1
    fi

    # Detect feature dir from git branch
    local branch
    branch="$(git branch --show-current 2>/dev/null || echo "")"

    if [[ -z "$branch" || "$branch" == "main" || "$branch" == "master" ]]; then
        echo "ERROR: Triage did not create a feature branch" >&2
        return 1
    fi

    # Find the feature directory
    local detected_dir
    detected_dir="$(find_feature_dir_by_prefix "$REPO_ROOT" "$branch")"

    if [[ ! -d "$detected_dir" ]]; then
        echo "ERROR: Feature directory not found after triage: $detected_dir" >&2
        return 1
    fi

    FEATURE_DIR="$detected_dir"

    # Set pipeline mode to manual (orchestrator controls progression)
    "$STATE_SCRIPT" set-mode "$FEATURE_DIR" manual &>/dev/null || true

    update_window_name "triage" "✓"
    echo "$FEATURE_DIR"
}

# --- Validate --from prerequisites ---
validate_from_step() {
    local from_step="$1"

    if [[ ! -f "$FEATURE_DIR/workflow-state.yaml" ]]; then
        echo "ERROR: workflow-state.yaml not found in $FEATURE_DIR. Cannot use --from." >&2
        exit 1
    fi

    # Verify steps before from_step are completed/skipped
    local step_count
    step_count="$(yq '.pipeline.steps | length' "$FEATURE_DIR/workflow-state.yaml")"
    local found=false

    for (( i=0; i<step_count; i++ )); do
        local sid sstatus
        sid="$(yq ".pipeline.steps[$i].id" "$FEATURE_DIR/workflow-state.yaml")"
        sstatus="$(yq ".pipeline.steps[$i].status" "$FEATURE_DIR/workflow-state.yaml")"

        if [[ "$sid" == "$from_step" ]]; then
            found=true
            # If this step is in_progress, reset to pending for re-execution
            if [[ "$sstatus" == "in_progress" ]]; then
                "$STATE_SCRIPT" update "$FEATURE_DIR" "$sid" "pending" 2>/dev/null || true
            fi
            break
        fi

        # Steps before from_step must be completed or skipped
        if [[ "$sstatus" != "completed" && "$sstatus" != "skipped" ]]; then
            echo "ERROR: Step '$sid' is '$sstatus' — must be completed/skipped before resuming from '$from_step'" >&2
            exit 1
        fi
    done

    if ! $found; then
        echo "ERROR: Step '$from_step' not found in pipeline" >&2
        exit 1
    fi
}

# --- Cleanup ---
cleanup_and_exit() {
    local code="${1:-0}"

    # Remove control pipe
    rm -f "$CONTROL_PIPE" 2>/dev/null || true

    # Clean up temp files
    rm -f /tmp/${SESSION_NAME}-*.exit 2>/dev/null || true
    rm -f /tmp/${SESSION_NAME}-paused 2>/dev/null || true

    if [[ "$code" -eq 0 ]]; then
        echo ""
        printf "%b✓ Pipeline completed successfully.%b\n" "$C_DONE" "$C_RESET"
    else
        echo ""
        printf "%bPipeline stopped. Resume with: ./poor-dev-cli --from <step> --feature-dir %s%b\n" \
            "$C_PENDING" "$FEATURE_DIR" "$C_RESET"
    fi

    exit "$code"
}

# --- Main pipeline loop ---
run_pipeline() {
    local start_idx=0
    local step_count=${#ALL_STEPS[@]}
    local confirm_enabled
    confirm_enabled="$(get_confirm_setting)"

    # Determine starting point
    if [[ -n "$FROM_STEP" ]]; then
        for (( i=0; i<step_count; i++ )); do
            if [[ "${ALL_STEPS[$i]}" == "$FROM_STEP" ]]; then
                start_idx=$i
                break
            fi
        done
    fi

    # If starting from scratch, run triage first
    if [[ "$start_idx" -eq 0 && -z "$FROM_STEP" ]]; then
        echo "Starting triage..."
        local detected_dir
        detected_dir="$(bootstrap_triage)"
        if [[ $? -ne 0 ]]; then
            echo "ERROR: Triage failed" >&2
            cleanup_and_exit 1
        fi
        FEATURE_DIR="$detected_dir"
        start_idx=1  # Skip triage in the loop since we just ran it
    fi

    # Update tmux status bar with branch info
    local branch
    branch="$(yq '.feature.branch // ""' "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"
    tmux set-option -t "$SESSION_NAME" status-right \
        "#[fg=colour245]| #[fg=colour82]$branch" 2>/dev/null || true

    # Restart dashboard with correct feature dir
    tmux send-keys -t "$SESSION_NAME:dashboard" C-c
    sleep 0.5
    tmux send-keys -t "$SESSION_NAME:dashboard" \
        "bash '$DASHBOARD_SCRIPT' '$FEATURE_DIR' --control-pipe '$CONTROL_PIPE'" Enter

    # Execute steps
    for (( i=start_idx; i<step_count; i++ )); do
        local step="${ALL_STEPS[$i]}"

        # Check if step is conditional and should be skipped
        local conditional
        conditional="$(yq ".pipeline.steps[] | select(.id == \"$step\") | .conditional // false" \
            "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"
        local step_status
        step_status="$(yq ".pipeline.steps[] | select(.id == \"$step\") | .status" \
            "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"

        # Skip already completed/skipped steps
        if [[ "$step_status" == "completed" || "$step_status" == "skipped" ]]; then
            continue
        fi

        # Skip conditional steps that are marked as skipped
        if [[ "$conditional" == "true" && "$step_status" == "skipped" ]]; then
            continue
        fi

        # Get step arguments
        local step_args="${STEP_ARGS_MAP[$step]:-}"

        # Run the step
        printf "\n%b▸ Running step %d/%d: %s%b\n" "$C_RUNNING" "$((i+1))" "$step_count" "$step" "$C_RESET"

        if ! run_step "$step" "$step_args" "$((i+1))" "$step_count"; then
            # Step failed and user chose to skip via prompt_failure_action
            local post_status
            post_status="$(yq ".pipeline.steps[] | select(.id == \"$step\") | .status" \
                "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"
            if [[ "$post_status" != "skipped" ]]; then
                cleanup_and_exit 1
            fi
        fi

        # Check for pause flag
        if [[ -f "/tmp/${SESSION_NAME}-paused" ]]; then
            rm -f "/tmp/${SESSION_NAME}-paused"
            echo ""
            printf "%bPipeline paused after '%s'. Resume with: ./poor-dev-cli --from %s --feature-dir %s%b\n" \
                "$C_PENDING" "$step" "${ALL_STEPS[$((i+1))]:-done}" "$FEATURE_DIR" "$C_RESET"
            exit 0
        fi

        # Confirmation prompt (if enabled and not the last step)
        if [[ "$confirm_enabled" == "true" && $((i+1)) -lt "$step_count" ]]; then
            local next_step="${ALL_STEPS[$((i+1))]}"
            local summary
            summary="$(yq '.last_step_summary // ""' "$FEATURE_DIR/workflow-state.yaml" 2>/dev/null)"

            # Switch to dashboard for confirmation
            tmux select-window -t "$SESSION_NAME:dashboard"

            local result
            result="$(bash "$DASHBOARD_SCRIPT" "$FEATURE_DIR" --confirm "$step" "$next_step" "$summary")"

            case "$result" in
                continue) ;;  # proceed normally
                skip)
                    "$STATE_SCRIPT" update "$FEATURE_DIR" "$next_step" "skipped" 2>/dev/null || true
                    ;;
                quit)
                    cleanup_and_exit 0
                    ;;
                msg:*)
                    # Add message to next step args
                    local msg="${result#msg:}"
                    STEP_ARGS_MAP[$next_step]="${STEP_ARGS_MAP[$next_step]:-} $msg"
                    ;;
            esac
        fi
    done

    # Pipeline complete
    "$STATE_SCRIPT" set-mode "$FEATURE_DIR" "manual" 2>/dev/null || true

    tmux select-window -t "$SESSION_NAME:dashboard"
    cleanup_and_exit 0
}

# --- Entry point ---
main() {
    parse_args "$@"

    # Initialize step args map
    STEP_ARGS_MAP[triage]="$DESCRIPTION"
    STEP_ARGS_MAP[specify]=""
    STEP_ARGS_MAP[clarify]=""
    STEP_ARGS_MAP[plan]=""
    STEP_ARGS_MAP[planreview]=""
    STEP_ARGS_MAP[tasks]=""
    STEP_ARGS_MAP[tasksreview]=""
    STEP_ARGS_MAP[architecturereview]=""
    STEP_ARGS_MAP[implement]=""
    STEP_ARGS_MAP[qualityreview]=""
    STEP_ARGS_MAP[phasereview]=""

    # Validate --from usage
    if [[ -n "$FROM_STEP" ]]; then
        if [[ -z "$FEATURE_DIR" ]]; then
            # Try to detect from current branch
            local branch
            branch="$(get_current_branch)"
            FEATURE_DIR="$(find_feature_dir_by_prefix "$REPO_ROOT" "$branch")"
        fi
        validate_from_step "$FROM_STEP"
    fi

    # Setup tmux session
    setup_tmux

    # Trap for cleanup
    trap 'cleanup_and_exit 1' INT TERM

    # Attach to tmux and run pipeline
    # Run pipeline in background within tmux, then attach
    run_pipeline &
    local pipeline_pid=$!

    # Attach to the tmux session
    tmux attach-session -t "$SESSION_NAME"

    # Wait for pipeline to finish
    wait "$pipeline_pid" 2>/dev/null || true
}

main "$@"
