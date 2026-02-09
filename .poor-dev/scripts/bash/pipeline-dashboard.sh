#!/usr/bin/env bash
#
# Pipeline Dashboard — runs in tmux window 0
#
# Usage:
#   pipeline-dashboard.sh <feature-dir> [--pipe-fd <fd>]
#
# Reads workflow-state.yaml and renders a live dashboard with:
#   - Feature info, overall progress bar
#   - Step table with status icons
#   - Last/Next step summary
#   - Confirmation prompt between steps
#
# Communicates with pipeline-cli.sh via a named pipe for user actions.

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pipeline-ui.sh"
source "$SCRIPT_DIR/common.sh"

FEATURE_DIR=""
PIPE_FD=""
CONTROL_PIPE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --pipe-fd) PIPE_FD="$2"; shift 2 ;;
        --control-pipe) CONTROL_PIPE="$2"; shift 2 ;;
        *) FEATURE_DIR="$1"; shift ;;
    esac
done

if [[ -z "$FEATURE_DIR" ]]; then
    echo "Usage: pipeline-dashboard.sh <feature-dir> [--control-pipe <path>]" >&2
    exit 1
fi

STATE_FILE="$FEATURE_DIR/workflow-state.yaml"
CONFIG_FILE="$(get_repo_root)/.poor-dev/pipeline-config.yaml"
START_TIME="$(date +%s)"

# Send action to orchestrator via control pipe
send_action() {
    local action="$1"
    if [[ -n "$CONTROL_PIPE" && -p "$CONTROL_PIPE" ]]; then
        echo "$action" > "$CONTROL_PIPE"
    fi
}

# Read pipeline config for step model/runtime
get_step_config() {
    local step_id="$1"
    local field="$2"  # model | runtime
    local val=""

    if [[ -f "$CONFIG_FILE" ]]; then
        val="$(yq ".steps.$step_id.$field // \"\"" "$CONFIG_FILE" 2>/dev/null)"
    fi

    if [[ -z "$val" || "$val" == "null" ]]; then
        val="$(yq ".defaults.$field // \"\"" "$CONFIG_FILE" 2>/dev/null)"
    fi

    echo "$val"
}

# Format runtime/model string for display
format_runtime() {
    local step_id="$1"
    local runtime model
    runtime="$(get_step_config "$step_id" "runtime")"
    model="$(get_step_config "$step_id" "model")"

    if [[ -n "$runtime" && -n "$model" ]]; then
        echo "$runtime/$model"
    elif [[ -n "$model" ]]; then
        echo "$model"
    else
        echo "—"
    fi
}

# Calculate overall progress percentage
calc_progress() {
    local step_count completed=0
    step_count="$(yq '.pipeline.steps | length' "$STATE_FILE")"

    for (( i=0; i<step_count; i++ )); do
        local s
        s="$(yq ".pipeline.steps[$i].status" "$STATE_FILE")"
        if [[ "$s" == "completed" || "$s" == "skipped" ]]; then
            ((completed++))
        fi
    done

    if (( step_count > 0 )); then
        echo $(( completed * 100 / step_count ))
    else
        echo 0
    fi
}

# Draw the full dashboard
draw_dashboard() {
    local width
    width="$(get_term_width)"
    if (( width > 72 )); then width=72; fi
    if (( width < 40 )); then width=40; fi

    local feature_name branch mode
    feature_name="$(yq '.feature.name // ""' "$STATE_FILE")"
    branch="$(yq '.feature.branch // ""' "$STATE_FILE")"
    mode="$(yq '.pipeline.mode // "auto"' "$STATE_FILE")"

    local now elapsed_str
    now="$(date +%s)"
    elapsed_str="$(format_time $((now - START_TIME)))"

    local pct
    pct="$(calc_progress)"

    screen_clear

    # Top border
    draw_border_top "$width"
    draw_bordered_empty "$width"

    # Title
    draw_bordered_line "$width" "$(printf "%b◆ poor-dev pipeline%b" "$C_TITLE" "$C_RESET")"
    draw_bordered_empty "$width"

    # Feature info
    draw_bordered_line "$width" "$(printf "Feature : %s" "$feature_name")"
    draw_bordered_line "$width" "$(printf "Branch  : %s" "$branch")"
    draw_bordered_line "$width" "$(printf "Config  : .poor-dev/pipeline-config.yaml")"
    draw_bordered_empty "$width"

    # Progress bar
    local bar_width=$((width - 16))
    local bar_str
    bar_str="$(draw_progress_bar "$pct" "$bar_width")"
    draw_bordered_line "$width" "$(printf "Overall  %s" "$bar_str")"
    draw_bordered_empty "$width"

    # Separator
    draw_border_mid "$width"
    draw_bordered_empty "$width"

    # Step table header
    draw_bordered_line "$width" "$(printf "%-4s %-16s %-18s %-12s %-6s" "#" "Step" "Runtime" "Status" "Time")"
    draw_bordered_line "$width" "$(printf "%-4s %-16s %-18s %-12s %-6s" "──" "──────────────" "────────────────" "──────────" "─────")"

    # Step rows
    local step_count
    step_count="$(yq '.pipeline.steps | length' "$STATE_FILE")"

    for (( i=0; i<step_count; i++ )); do
        local sid sstatus runtime_str status_str time_str
        sid="$(yq ".pipeline.steps[$i].id" "$STATE_FILE")"
        sstatus="$(yq ".pipeline.steps[$i].status" "$STATE_FILE")"
        runtime_str="$(format_runtime "$sid")"

        status_str="$(draw_status_icon "$sstatus")"
        time_str="—"

        # Show time for completed/in_progress steps if available
        if [[ "$sstatus" == "in_progress" ]]; then
            time_str="$(format_time $((now - START_TIME)))"
        fi

        # Build line without ANSI for padding
        local line_raw
        line_raw="$(printf "%-4s %-16s %-18s" "$((i+1))" "$sid" "$runtime_str")"

        draw_bordered_line "$width" "$(printf "%s %s" "$line_raw" "$status_str")"
    done

    draw_bordered_empty "$width"

    # Separator
    draw_border_mid "$width"

    # Summary section
    local last_summary next_step
    last_summary="$(yq '.last_step_summary // ""' "$STATE_FILE")"
    local current_step
    current_step="$(yq '.pipeline.current_step // ""' "$STATE_FILE")"

    # Find next pending step
    next_step=""
    for (( i=0; i<step_count; i++ )); do
        local ss
        ss="$(yq ".pipeline.steps[$i].status" "$STATE_FILE")"
        if [[ "$ss" == "pending" ]]; then
            next_step="$(yq ".pipeline.steps[$i].id" "$STATE_FILE")"
            break
        fi
    done

    if [[ -n "$last_summary" && "$last_summary" != "null" ]]; then
        draw_bordered_line "$width" "$(printf "Last: %s" "$last_summary")"
    fi
    if [[ -n "$next_step" ]]; then
        local next_rt
        next_rt="$(format_runtime "$next_step")"
        draw_bordered_line "$width" "$(printf "Next: %s (%s)" "$next_step" "$next_rt")"
    fi
    draw_bordered_line "$width" "$(printf "Elapsed: %s" "$elapsed_str")"

    # Bottom border
    draw_border_bottom "$width"

    # Status bar
    draw_status_bar "$branch" "$elapsed_str"
}

# Draw confirmation prompt between steps
draw_confirm_prompt() {
    local completed_step="$1"
    local next_step="$2"
    local elapsed_str="$3"
    local summary="$4"

    local width
    width="$(get_term_width)"
    if (( width > 72 )); then width=72; fi
    if (( width < 40 )); then width=40; fi

    local pct
    pct="$(calc_progress)"

    screen_clear

    draw_border_top "$width"

    # Completed step summary
    draw_bordered_line "$width" "$(printf "%b✓ %s completed%b%*s%s" "$C_DONE" "$completed_step" "$C_RESET" 20 "" "$elapsed_str")"
    draw_bordered_empty "$width"

    if [[ -n "$summary" && "$summary" != "null" ]]; then
        draw_bordered_line "$width" "$(printf "Summary: %s" "$summary")"
        draw_bordered_empty "$width"
    fi

    # Progress bar
    local bar_width=$((width - 16))
    local bar_str
    bar_str="$(draw_progress_bar "$pct" "$bar_width")"
    draw_bordered_line "$width" "$(printf "Overall  %s" "$bar_str")"
    draw_bordered_empty "$width"

    draw_border_mid "$width"

    if [[ -n "$next_step" && "$next_step" != "done" ]]; then
        local next_rt
        next_rt="$(format_runtime "$next_step")"
        draw_bordered_line "$width" "$(printf "Next: %s (%s)" "$next_step" "$next_rt")"
        draw_bordered_empty "$width"
        draw_bordered_line "$width" "$(printf "  %b▸ Enter%b   continue" "$C_KEY" "$C_RESET")"
        draw_bordered_line "$width" "$(printf "    %bs%b       skip → next" "$C_KEY" "$C_RESET")"
        draw_bordered_line "$width" "$(printf "    %bm%b       add message to next step" "$C_KEY" "$C_RESET")"
        draw_bordered_line "$width" "$(printf "    %bq%b       quit pipeline" "$C_KEY" "$C_RESET")"
        draw_bordered_empty "$width"
        draw_bordered_line "$width" "$(printf "❯ _")"
    else
        draw_bordered_line "$width" "$(printf "%b✓ Pipeline complete!%b" "$C_DONE" "$C_RESET")"
    fi

    draw_border_bottom "$width"
}

# Wait for user input at confirmation prompt
# Returns: "continue" | "skip" | "quit" | "msg:MESSAGE"
wait_for_confirm() {
    while true; do
        read_key 0.5
        case "$REPLY" in
            "") continue ;;
            q|Q) echo "quit"; return ;;
            s|S) echo "skip"; return ;;
            m|M)
                cursor_show
                printf "\n  Message: "
                local msg
                read -r msg
                cursor_hide
                echo "msg:$msg"
                return
                ;;
            "") echo "continue"; return ;;  # Enter key
        esac
    done
}

# --- Main dashboard modes ---

# Mode: live dashboard (refreshes while steps run)
mode_live() {
    cursor_hide
    trap 'cursor_show; exit 0' EXIT INT TERM

    while true; do
        draw_dashboard
        spinner_advance

        # Check for keypress
        read_key 0.08
        case "$REPLY" in
            q|Q) send_action "quit"; break ;;
            p|P) send_action "pause" ;;
            "") ;;
        esac

        # Small sleep between data refreshes
        sleep 0.08
    done

    cursor_show
}

# Mode: confirmation prompt
mode_confirm() {
    local completed_step="$1"
    local next_step="$2"
    local summary="$3"

    local now elapsed_str
    now="$(date +%s)"
    elapsed_str="$(format_time $((now - START_TIME)))"

    cursor_hide
    trap 'cursor_show; exit 0' EXIT INT TERM

    draw_confirm_prompt "$completed_step" "$next_step" "$elapsed_str" "$summary"

    local result
    result="$(wait_for_confirm)"

    cursor_show
    send_action "$result"
    echo "$result"
}

# Mode: worker header (displayed in worker windows)
mode_worker_header() {
    local step_id="$1"
    local step_num="$2"
    local total_steps="$3"

    local runtime_str elapsed_str
    runtime_str="$(format_runtime "$step_id")"
    local now
    now="$(date +%s)"
    elapsed_str="$(format_time $((now - START_TIME)))"

    local width
    width="$(get_term_width)"
    if (( width > 80 )); then width=80; fi

    local header
    header="$(printf " [%s/%s] %s " "$step_num" "$total_steps" "$step_id")"
    local right
    right="$(printf " %s ─── $(spinner_char) %s " "$runtime_str" "$elapsed_str")"

    draw_hline "$width" "$B_TL" "$B_TR" "$B_H"
    printf "%b%s%b%s%*s%s%b%s%b\n" \
        "$C_BORDER" "$B_V" "$C_RESET" \
        "$header" \
        $((width - ${#header} - ${#right} - 2)) "" \
        "$right" \
        "$C_BORDER" "$B_V" "$C_RESET"
    draw_hline "$width" "$B_BL" "$B_BR" "$B_H"
}

# --- Dispatch ---
MODE="${1:-}"
case "$MODE" in
    --live)
        shift
        FEATURE_DIR="${FEATURE_DIR:-$1}"
        mode_live
        ;;
    --confirm)
        shift
        mode_confirm "${1:-}" "${2:-}" "${3:-}"
        ;;
    --worker-header)
        shift
        mode_worker_header "${1:-}" "${2:-}" "${3:-}"
        ;;
    *)
        # Default: live dashboard mode
        mode_live
        ;;
esac
