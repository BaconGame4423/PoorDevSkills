#!/usr/bin/env bash
# tmux dashboard ウィンドウ内で実行される入力プロンプト。
# Usage: pipeline-prompt.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-prompt.sh <desc_output_file>}"

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pipeline-ui.sh"

# --- Banner ---
printf "\n"
printf "  %b╭────────────────────────────────────╮%b\n" "$C_BORDER" "$C_RESET"
printf "  %b│%b  %b◆ poor-dev pipeline CLI%b            %b│%b\n" \
    "$C_BORDER" "$C_RESET" "$C_TITLE" "$C_RESET" "$C_BORDER" "$C_RESET"
printf "  %b╰────────────────────────────────────╯%b\n" "$C_BORDER" "$C_RESET"
printf "\n"

# --- Dependency check ---
printf "%bChecking dependencies...%b\n" "$C_RUNNING" "$C_RESET"

missing=()
command -v tmux &>/dev/null || missing+=("tmux (required)")
command -v yq &>/dev/null   || missing+=("yq (required)")

has_runtime=false
command -v claude &>/dev/null   && has_runtime=true
command -v opencode &>/dev/null && has_runtime=true
$has_runtime || missing+=("claude or opencode (at least one required)")

if command -v gum &>/dev/null; then
    printf "  %b✓%b gum\n" "$C_DONE" "$C_RESET"
else
    printf "  %b○%b gum (optional, using ANSI fallback)\n" "$C_PENDING" "$C_RESET"
fi

if [[ ${#missing[@]} -gt 0 ]]; then
    printf "\n%bMissing dependencies:%b\n" "$C_FAILED" "$C_RESET"
    for dep in "${missing[@]}"; do
        printf "  %b✗%b %s\n" "$C_FAILED" "$C_RESET" "$dep"
    done
    # Write empty file to signal failure to pipeline
    echo "" > "$DESC_FILE"
    exit 1
fi

printf "%b✓ All dependencies satisfied.%b\n\n" "$C_DONE" "$C_RESET"

# --- Prompt ---
description=""
if command -v gum &>/dev/null; then
    description="$(gum input --placeholder "機能説明 or バグ報告を入力..." --width 60)" || true
else
    printf "%b> %b" "$C_RUNNING" "$C_RESET"
    read -r description
fi

if [[ -z "$description" ]]; then
    printf "%bError: 説明が入力されませんでした。%b\n" "$C_FAILED" "$C_RESET"
    echo "" > "$DESC_FILE"
    exit 1
fi

# --- Write result ---
printf '%s' "$description" > "$DESC_FILE"
printf "\n%bFeature:%b %s\n" "$C_TITLE" "$C_RESET" "$description"
printf "%bLaunching pipeline...%b\n" "$C_RUNNING" "$C_RESET"
