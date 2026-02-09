#!/usr/bin/env bash
# tmux dashboard ウィンドウ内で実行される TUI プロンプト。
# 3フェーズ: (1) tmux クライアント接続待ち (2) display-popup 入力 (3) loading spinner
# Usage: pipeline-prompt.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-prompt.sh <desc_output_file>}"

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pipeline-ui.sh"

STEPS=(triage specify clarify plan planreview tasks tasksreview
       architecturereview implement qualityreview phasereview)

cleanup() { cursor_show 2>/dev/null; exit 0; }
trap cleanup INT TERM

# ─── Phase 1: tmux クライアント接続待ち ───
# send-keys で起動されるため、attach-session より先に実行開始する可能性がある
# display-popup はクライアント接続が必要なので待機する
while [[ "$(tmux list-clients 2>/dev/null | wc -l)" -eq 0 ]]; do
    sleep 0.2
done
sleep 0.3  # attach 安定待ち

# ─── Phase 2: tmux display-popup で入力 ───
screen_clear
cursor_hide

# popup 起動（-E: 終了時自動クローズ、-w/-h: サイズ指定）
tmux display-popup -E -w 58 -h 14 \
    "bash '${SCRIPT_DIR}/pipeline-input-popup.sh' '${DESC_FILE}'" || true

# popup 終了後、description 確認
description=""
if [[ -f "$DESC_FILE" ]]; then
    description="$(cat "$DESC_FILE")"
fi
if [[ -z "$description" ]]; then
    cursor_show
    exit 1
fi

# ─── Phase 3: ローディング表示（triage 完了まで） ───
screen_clear

# ヘッダー + Feature 情報
gum style --border rounded --padding "1 2" --border-foreground "141" --width 56 \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" \
    "" \
    "Feature: $description"
echo ""

# パイプラインステップ一覧
printf "  %bPipeline steps:%b\n" "$C_PENDING" "$C_RESET"
for step in "${STEPS[@]}"; do
    if [[ "$step" == "triage" ]]; then
        printf "    %b⠋%b  %s\n" "$C_RUNNING" "$C_RESET" "$step"
    else
        printf "    %b◌%b  %s\n" "$C_PENDING" "$C_RESET" "$step"
    fi
done
echo ""

# gum spin でアニメーションスピナー（C-c まで回り続ける）
# orchestrator の C-c (pipeline-cli.sh:617) でこのプロセスが終了し、dashboard に引き継がれる
gum spin --spinner dot --title "Triage を実行中..." -- sleep 3600 || true
