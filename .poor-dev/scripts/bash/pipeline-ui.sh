#!/usr/bin/env bash
#
# Pipeline UI rendering library
# Provides drawing primitives: borders, progress bars, spinners, status icons, colors.
# Detects gum availability and falls back to pure ANSI rendering.

# --- Color constants (ANSI 256) ---
C_DONE="\033[38;5;82m"       # Soft green
C_RUNNING="\033[38;5;87m"    # Cyan
C_PENDING="\033[38;5;245m"   # Grey
C_SKIPPED="\033[38;5;240m"   # Dim grey
C_FAILED="\033[38;5;203m"    # Soft red
C_BAR_FILL="\033[38;5;75m"   # Blue
C_BAR_EMPTY="\033[38;5;236m" # Dark grey
C_BORDER="\033[38;5;141m"    # Purple
C_TITLE="\033[1;37m"         # White bold
C_KEY="\033[38;5;214m"       # Yellow
C_RESET="\033[0m"

# --- Border characters (rounded Unicode) ---
B_TL="╭" B_TR="╮" B_BL="╰" B_BR="╯" B_H="─" B_V="│" B_MID_L="├" B_MID_R="┤"

# --- Spinner frames (Braille dots) ---
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
SPINNER_IDX=0

# --- Progress bar sub-character precision ---
BAR_CHARS=("" "▏" "▎" "▍" "▌" "▋" "▊" "▉" "█")

# --- gum detection ---
HAS_GUM=false
if command -v gum &>/dev/null; then
    HAS_GUM=true
fi

# --- Terminal dimensions ---
get_term_width() {
    local w
    w="$(tput cols 2>/dev/null)" || w=80
    echo "$w"
}

get_term_height() {
    local h
    h="$(tput lines 2>/dev/null)" || h=24
    echo "$h"
}

# --- Drawing functions ---

# Print a colored string
# Usage: colorize "$COLOR_CODE" "text"
colorize() {
    printf "%b%s%b" "$1" "$2" "$C_RESET"
}

# Draw a horizontal border line
# Usage: draw_hline <width> [left_char] [right_char] [fill_char]
draw_hline() {
    local width="$1"
    local left="${2:-$B_TL}"
    local right="${3:-$B_TR}"
    local fill="${4:-$B_H}"

    printf "%b%s" "$C_BORDER" "$left"
    local inner=$((width - 2))
    for (( i=0; i<inner; i++ )); do
        printf "%s" "$fill"
    done
    printf "%s%b\n" "$right" "$C_RESET"
}

# Draw top border
# Usage: draw_border_top <width>
draw_border_top() { draw_hline "$1" "$B_TL" "$B_TR" "$B_H"; }

# Draw bottom border
# Usage: draw_border_bottom <width>
draw_border_bottom() { draw_hline "$1" "$B_BL" "$B_BR" "$B_H"; }

# Draw middle separator
# Usage: draw_border_mid <width>
draw_border_mid() { draw_hline "$1" "$B_MID_L" "$B_MID_R" "$B_H"; }

# Draw a bordered line with content
# Usage: draw_bordered_line <width> "content"
draw_bordered_line() {
    local width="$1"
    local content="$2"
    local inner=$((width - 2))

    # Strip ANSI for length calculation
    local stripped
    stripped="$(printf "%b" "$content" | sed 's/\x1b\[[0-9;]*m//g')"
    local content_len=${#stripped}
    local padding=$((inner - content_len))
    if (( padding < 0 )); then padding=0; fi

    printf "%b%s%b %b" "$C_BORDER" "$B_V" "$C_RESET" "$content"
    printf "%*s" "$((padding - 1))" ""
    printf "%b%s%b\n" "$C_BORDER" "$B_V" "$C_RESET"
}

# Draw an empty bordered line
# Usage: draw_bordered_empty <width>
draw_bordered_empty() {
    draw_bordered_line "$1" ""
}

# Draw a progress bar
# Usage: draw_progress_bar <percent> <width>
#   percent: 0-100
#   width: total character width of the bar (excluding label)
draw_progress_bar() {
    local pct="$1"
    local width="$2"

    if (( pct < 0 )); then pct=0; fi
    if (( pct > 100 )); then pct=100; fi

    # Calculate filled portion with sub-character precision
    local filled_precise=$(( pct * width * 8 / 100 ))
    local full_blocks=$(( filled_precise / 8 ))
    local remainder=$(( filled_precise % 8 ))
    local empty_blocks=$(( width - full_blocks - (remainder > 0 ? 1 : 0) ))

    local bar=""
    # Full blocks
    for (( i=0; i<full_blocks; i++ )); do
        bar+="${BAR_CHARS[8]}"
    done
    # Partial block
    if (( remainder > 0 )); then
        bar+="${BAR_CHARS[$remainder]}"
    fi

    local empty=""
    for (( i=0; i<empty_blocks; i++ )); do
        empty+="░"
    done

    printf "%b%s%b%b%s%b %3d%%" "$C_BAR_FILL" "$bar" "$C_RESET" "$C_BAR_EMPTY" "$empty" "$C_RESET" "$pct"
}

# Get status icon with color
# Usage: draw_status_icon <status>
draw_status_icon() {
    local status="$1"
    case "$status" in
        completed) printf "%b✓ done%b" "$C_DONE" "$C_RESET" ;;
        in_progress) printf "%b%s running%b" "$C_RUNNING" "${SPINNER_FRAMES[$SPINNER_IDX]}" "$C_RESET" ;;
        pending) printf "%b◌ pending%b" "$C_PENDING" "$C_RESET" ;;
        skipped) printf "%b○ skipped%b" "$C_SKIPPED" "$C_RESET" ;;
        failed) printf "%b✗ failed%b" "$C_FAILED" "$C_RESET" ;;
        *) printf "%b? %s%b" "$C_PENDING" "$status" "$C_RESET" ;;
    esac
}

# Advance spinner to next frame
spinner_advance() {
    SPINNER_IDX=$(( (SPINNER_IDX + 1) % ${#SPINNER_FRAMES[@]} ))
}

# Get animated spinner character
# Usage: spinner_char
spinner_char() {
    printf "%b%s%b" "$C_RUNNING" "${SPINNER_FRAMES[$SPINNER_IDX]}" "$C_RESET"
}

# Format elapsed time
# Usage: format_time <seconds>
format_time() {
    local secs="$1"
    if (( secs < 0 )); then secs=0; fi
    local mins=$((secs / 60))
    local s=$((secs % 60))
    printf "%d:%02d" "$mins" "$s"
}

# Draw a table using gum (if available) or column fallback
# Usage: draw_table "header1,header2,..." "row1col1,row1col2,...\nrow2col1,..."
draw_table() {
    local header="$1"
    local rows="$2"

    if $HAS_GUM; then
        printf "%s\n%s" "$header" "$rows" | gum table --border.foreground="141"
    else
        printf "%s\n%s\n" "$header" "$rows" | column -t -s ','
    fi
}

# Draw the status bar (bottom of tmux or screen)
# Usage: draw_status_bar "branch_name" "elapsed"
draw_status_bar() {
    local branch="$1"
    local elapsed="$2"
    printf "  %b⌨%b  %bEnter%b:continue  %bp%b:pause  %bs%b:skip  %bq%b:quit  %bm%b:msg  %b←→%b:tab  | %s | %s" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$C_KEY" "$C_RESET" \
        "$branch" "$elapsed"
}

# Move cursor to position (for partial redraws)
# Usage: cursor_to <row> <col>
cursor_to() {
    tput cup "$1" "$2" 2>/dev/null
}

# Clear screen
screen_clear() {
    printf "\033[2J\033[H"
}

# Hide/show cursor
cursor_hide() { printf "\033[?25l"; }
cursor_show() { printf "\033[?25h"; }

# Read single keypress (non-blocking, timeout in seconds)
# Usage: read_key <timeout_seconds>
# Returns the key in $REPLY
read_key() {
    local timeout="${1:-0.1}"
    read -rsn1 -t "$timeout" REPLY 2>/dev/null || REPLY=""
}
