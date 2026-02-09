#!/usr/bin/env bash
#
# Pipeline state management for workflow-state.yaml
#
# Usage:
#   pipeline-state.sh init <feature-dir> [--mode auto] [--confirm]
#   pipeline-state.sh get <feature-dir>
#   pipeline-state.sh update <feature-dir> <step-id> <status> [--summary "..."] [--artifacts a,b,c] [--verdict GO] [--iterations N]
#   pipeline-state.sh next <feature-dir>
#   pipeline-state.sh set-mode <feature-dir> <mode>
#   pipeline-state.sh set-steps <feature-dir> '<json-array>'
#   pipeline-state.sh set-type <feature-dir> <feature|bugfix>
#   pipeline-state.sh status <feature-dir>
#
# Requires: yq (https://github.com/mikefarah/yq)

set -e

# --- Dependency check ---
if ! command -v yq &>/dev/null; then
    echo "ERROR: 'yq' is required but not installed." >&2
    echo "Install: https://github.com/mikefarah/yq#install" >&2
    exit 1
fi

# --- Resolve paths ---
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
REPO_ROOT="$(get_repo_root)"
TEMPLATE="$REPO_ROOT/.poor-dev/templates/workflow-state-template.yaml"

# --- Helpers ---
state_file() {
    echo "$1/workflow-state.yaml"
}

require_state() {
    local sf
    sf="$(state_file "$1")"
    if [[ ! -f "$sf" ]]; then
        echo "ERROR: workflow-state.yaml not found in $1" >&2
        exit 1
    fi
    echo "$sf"
}

# flock wrapper for safe concurrent YAML writes
yq_write() {
    local sf="$1"; shift
    local lockfile="${sf}.lock"
    (
        flock -w 10 200 || { echo "ERROR: Could not acquire lock on $lockfile" >&2; return 1; }
        yq "$@" "$sf"
    ) 200>"$lockfile"
}

# --- Subcommands ---

cmd_init() {
    local feature_dir="$1"; shift
    local mode="auto"
    local confirm="true"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --mode)    mode="$2"; shift 2 ;;
            --confirm) confirm="true"; shift ;;
            --no-confirm) confirm="false"; shift ;;
            *) echo "ERROR: Unknown option '$1' for init" >&2; exit 1 ;;
        esac
    done

    if [[ ! -f "$TEMPLATE" ]]; then
        echo "ERROR: Template not found: $TEMPLATE" >&2
        exit 1
    fi

    local sf
    sf="$(state_file "$feature_dir")"

    # Copy template
    cp "$TEMPLATE" "$sf"

    # Derive feature metadata
    local dir_basename
    dir_basename="$(basename "$feature_dir")"
    local branch_name
    branch_name="$(get_current_branch)"
    local created
    created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # Populate feature block
    yq_write "$sf" -i ".feature.name = \"$dir_basename\""
    yq_write "$sf" -i ".feature.branch = \"$branch_name\""
    yq_write "$sf" -i ".feature.dir = \"$feature_dir\""
    yq_write "$sf" -i ".feature.created = \"$created\""

    # Set pipeline mode
    yq_write "$sf" -i ".pipeline.mode = \"$mode\""
    yq_write "$sf" -i ".pipeline.confirm = $confirm"

    # Populate context paths
    yq_write "$sf" -i ".context.spec_file = \"$feature_dir/spec.md\""
    yq_write "$sf" -i ".context.plan_file = \"$feature_dir/plan.md\""
    yq_write "$sf" -i ".context.tasks_file = \"$feature_dir/tasks.md\""
    yq_write "$sf" -i ".context.bug_report_file = \"\""
    yq_write "$sf" -i ".context.investigation_file = \"\""
    yq_write "$sf" -i ".context.fix_plan_file = \"\""

    echo "$sf"
}

cmd_get() {
    local sf
    sf="$(require_state "$1")"
    yq -o=json '.' "$sf"
}

cmd_update() {
    local feature_dir="$1"; shift
    local step_id="$1"; shift
    local status="$1"; shift

    local summary="" artifacts="" verdict="" iterations=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --summary)    summary="$2"; shift 2 ;;
            --artifacts)  artifacts="$2"; shift 2 ;;
            --verdict)    verdict="$2"; shift 2 ;;
            --iterations) iterations="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option '$1' for update" >&2; exit 1 ;;
        esac
    done

    local sf
    sf="$(require_state "$feature_dir")"

    # Find step index
    local idx
    idx="$(yq ".pipeline.steps | to_entries | .[] | select(.value.id == \"$step_id\") | .key" "$sf")"

    if [[ -z "$idx" ]]; then
        echo "ERROR: Step '$step_id' not found in pipeline" >&2
        exit 1
    fi

    # Update status
    yq_write "$sf" -i ".pipeline.steps[$idx].status = \"$status\""

    # Update current_step when marking in_progress or completed
    if [[ "$status" == "in_progress" || "$status" == "completed" ]]; then
        yq_write "$sf" -i ".pipeline.current_step = \"$step_id\""
    fi

    # Optional fields
    if [[ -n "$summary" ]]; then
        yq_write "$sf" -i ".last_step_summary = \"$summary\""
    fi
    if [[ -n "$artifacts" ]]; then
        # Convert comma-separated list to yaml array
        local arr_expr="["
        IFS=',' read -ra ARTS <<< "$artifacts"
        for i in "${!ARTS[@]}"; do
            [[ $i -gt 0 ]] && arr_expr+=","
            arr_expr+="\"${ARTS[$i]}\""
        done
        arr_expr+="]"
        yq_write "$sf" -i ".pipeline.steps[$idx].artifacts = $arr_expr"
    fi
    if [[ -n "$verdict" ]]; then
        yq_write "$sf" -i ".pipeline.steps[$idx].verdict = \"$verdict\""
    fi
    if [[ -n "$iterations" ]]; then
        yq_write "$sf" -i ".pipeline.steps[$idx].iterations = $iterations"
    fi

    echo "OK"
}

cmd_next() {
    local sf
    sf="$(require_state "$1")"

    local current
    current="$(yq '.pipeline.current_step' "$sf")"

    # Get ordered step ids
    local step_count
    step_count="$(yq '.pipeline.steps | length' "$sf")"

    local found_current=false
    for (( i=0; i<step_count; i++ )); do
        local sid
        sid="$(yq ".pipeline.steps[$i].id" "$sf")"

        if $found_current; then
            local sstatus
            sstatus="$(yq ".pipeline.steps[$i].status" "$sf")"
            local conditional
            conditional="$(yq ".pipeline.steps[$i].conditional // false" "$sf")"

            # Skip conditional steps that are already skipped
            if [[ "$conditional" == "true" && "$sstatus" == "skipped" ]]; then
                continue
            fi

            # Return this step (either non-conditional, or conditional+pending)
            echo "$sid"
            return 0
        fi

        if [[ "$sid" == "$current" ]]; then
            found_current=true
        fi
    done

    # If we exhausted all steps, pipeline is done
    echo "done"
}

cmd_set_mode() {
    local feature_dir="$1"
    local mode="$2"

    if [[ "$mode" != "auto" && "$mode" != "manual" && "$mode" != "paused" ]]; then
        echo "ERROR: Invalid mode '$mode'. Must be: auto, manual, paused" >&2
        exit 1
    fi

    local sf
    sf="$(require_state "$feature_dir")"
    yq_write "$sf" -i ".pipeline.mode = \"$mode\""
    echo "OK"
}

cmd_set_steps() {
    local feature_dir="$1"
    local steps_json="$2"
    local sf
    sf="$(require_state "$feature_dir")"
    yq_write "$sf" -i ".pipeline.steps = $steps_json"
    echo "OK"
}

cmd_set_type() {
    local feature_dir="$1"
    local type="$2"
    if [[ "$type" != "feature" && "$type" != "bugfix" && "$type" != "roadmap" ]]; then
        echo "ERROR: Invalid type '$type'. Must be: feature, bugfix, roadmap" >&2
        exit 1
    fi
    local sf
    sf="$(require_state "$feature_dir")"
    yq_write "$sf" -i ".feature.type = \"$type\""
    echo "OK"
}

cmd_status() {
    local sf
    sf="$(require_state "$1")"

    local feature_name branch mode
    feature_name="$(yq '.feature.name' "$sf")"
    branch="$(yq '.feature.branch' "$sf")"
    mode="$(yq '.pipeline.mode' "$sf")"

    local step_count
    step_count="$(yq '.pipeline.steps | length' "$sf")"

    local completed=0 total="$step_count"
    for (( i=0; i<step_count; i++ )); do
        local s
        s="$(yq ".pipeline.steps[$i].status" "$sf")"
        if [[ "$s" == "completed" || "$s" == "skipped" ]]; then
            ((completed++))
        fi
    done

    local pct=0
    if (( total > 0 )); then
        pct=$(( completed * 100 / total ))
    fi

    printf "Feature : %s\n" "$feature_name"
    printf "Branch  : %s\n" "$branch"
    printf "Mode    : %s\n" "$mode"
    printf "Progress: %d/%d (%d%%)\n\n" "$completed" "$total" "$pct"

    printf "%-4s %-20s %-12s\n" "#" "Step" "Status"
    printf "%-4s %-20s %-12s\n" "──" "──────────────────" "──────────"

    for (( i=0; i<step_count; i++ )); do
        local sid sstatus icon
        sid="$(yq ".pipeline.steps[$i].id" "$sf")"
        sstatus="$(yq ".pipeline.steps[$i].status" "$sf")"

        case "$sstatus" in
            completed) icon="✓" ;;
            in_progress) icon="⠹" ;;
            pending) icon="◌" ;;
            skipped) icon="○" ;;
            failed) icon="✗" ;;
            *) icon="?" ;;
        esac

        printf "%-4s %-20s %s %s\n" "$((i+1))" "$sid" "$icon" "$sstatus"
    done
}

# --- Main dispatch ---

SUBCOMMAND="${1:-}"
if [[ -z "$SUBCOMMAND" ]]; then
    echo "Usage: pipeline-state.sh <init|get|update|next|set-mode|set-steps|set-type|status> <feature-dir> [options]" >&2
    exit 1
fi
shift

case "$SUBCOMMAND" in
    init)
        if [[ $# -lt 1 ]]; then
            echo "Usage: pipeline-state.sh init <feature-dir> [--mode auto] [--confirm]" >&2
            exit 1
        fi
        cmd_init "$@"
        ;;
    get)
        if [[ $# -lt 1 ]]; then
            echo "Usage: pipeline-state.sh get <feature-dir>" >&2
            exit 1
        fi
        cmd_get "$1"
        ;;
    update)
        if [[ $# -lt 3 ]]; then
            echo "Usage: pipeline-state.sh update <feature-dir> <step-id> <status> [--summary ...] [--artifacts ...] [--verdict ...] [--iterations N]" >&2
            exit 1
        fi
        cmd_update "$@"
        ;;
    next)
        if [[ $# -lt 1 ]]; then
            echo "Usage: pipeline-state.sh next <feature-dir>" >&2
            exit 1
        fi
        cmd_next "$1"
        ;;
    set-mode)
        if [[ $# -lt 2 ]]; then
            echo "Usage: pipeline-state.sh set-mode <feature-dir> <mode>" >&2
            exit 1
        fi
        cmd_set_mode "$1" "$2"
        ;;
    set-steps)
        if [[ $# -lt 2 ]]; then
            echo "Usage: pipeline-state.sh set-steps <feature-dir> '<json-array>'" >&2
            exit 1
        fi
        cmd_set_steps "$1" "$2"
        ;;
    set-type)
        if [[ $# -lt 2 ]]; then
            echo "Usage: pipeline-state.sh set-type <feature-dir> <feature|bugfix>" >&2
            exit 1
        fi
        cmd_set_type "$1" "$2"
        ;;
    status)
        if [[ $# -lt 1 ]]; then
            echo "Usage: pipeline-state.sh status <feature-dir>" >&2
            exit 1
        fi
        cmd_status "$1"
        ;;
    *)
        echo "ERROR: Unknown subcommand '$SUBCOMMAND'" >&2
        echo "Usage: pipeline-state.sh <init|get|update|next|set-mode|set-steps|set-type|status> <feature-dir> [options]" >&2
        exit 1
        ;;
esac
