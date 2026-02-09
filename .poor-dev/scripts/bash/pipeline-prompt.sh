#!/usr/bin/env bash
# tmux dashboard ウィンドウ内で実行される TUI プロンプト。
# 3フェーズ: (1) tmux クライアント接続待ち (2) display-popup 入力 (3) プログレス表示
# Usage: pipeline-prompt.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-prompt.sh <desc_output_file>}"

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pipeline-ui.sh"

FEATURE_STEPS=(intake specify clarify plan planreview tasks tasksreview
       architecturereview implement qualityreview phasereview)
ROADMAP_STEPS=(concept goals milestones roadmap)

# B1: スピナーフレーム
SPIN_FRAMES=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
SPIN_IDX=0

# B3: ログ表示状態
SHOW_LOG=true
PREV_LOG_LINES=""

# B6: SESSION_NAME 取得
SESSION_NAME="${POOR_DEV_SESSION:-}"
if [[ -z "$SESSION_NAME" ]]; then
    SESSION_NAME="$(tmux display-message -p '#S' 2>/dev/null || echo '')"
fi

# B4: 実行中のパイプラインPIDを追跡 (中止用)
PIPELINE_PID=""

cleanup() {
    cursor_show 2>/dev/null
    # B4: Ctrl+C trap — 子プロセス含めて停止
    if [[ -n "$PIPELINE_PID" ]]; then
        kill "$PIPELINE_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup INT TERM

# ─── Phase 1: tmux クライアント接続待ち ───
while [[ "$(tmux list-clients 2>/dev/null | wc -l)" -eq 0 ]]; do
    sleep 0.2
done
sleep 0.3  # attach 安定待ち

# ─── Phase 2: tmux display-popup で入力 ───
screen_clear
cursor_hide

tmux display-popup -E -w 60 -h 50% \
    "bash '${SCRIPT_DIR}/pipeline-input-popup.sh' '${DESC_FILE}'" || true

description=""
if [[ -f "$DESC_FILE" ]]; then
    description="$(cat "$DESC_FILE")"
fi
if [[ -z "$description" ]]; then
    cursor_show
    exit 1
fi

# ─── Phase 3: プログレス表示（カスタムスピナー + ログ + 介入UI） ───
screen_clear

# ヘッダー + Feature 情報
gum style --border rounded --padding "1 2" --border-foreground "141" --width 56 \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" \
    "" \
    "Feature: $description"
echo ""

# ステップ表示を先に描画
if [[ "$description" == FLOW:ask* || "$description" == FLOW:report ]]; then
    STEP_LABEL="実行中"
elif [[ "$description" == FLOW:roadmap:* ]]; then
    STEP_LABEL="実行中"
    printf "  %bPipeline steps:%b\n" "$C_PENDING" "$C_RESET"
    for step in "${ROADMAP_STEPS[@]}"; do
        if [[ "$step" == "${ROADMAP_STEPS[0]}" ]]; then
            printf "    %b⠋%b  %s\n" "$C_RUNNING" "$C_RESET" "$step"
        else
            printf "    %b◌%b  %s\n" "$C_PENDING" "$C_RESET" "$step"
        fi
    done
    echo ""
elif [[ "$description" == FLOW:* ]]; then
    STEP_LABEL="Intake を実行中"
    printf "  %bPipeline steps:%b\n" "$C_PENDING" "$C_RESET"
    for step in "${FEATURE_STEPS[@]}"; do
        if [[ "$step" == "intake" ]]; then
            printf "    %b⠋%b  %s\n" "$C_RUNNING" "$C_RESET" "$step"
        else
            printf "    %b◌%b  %s\n" "$C_PENDING" "$C_RESET" "$step"
        fi
    done
    echo ""
else
    STEP_LABEL="Intake を実行中"
fi

# B2: 行位置計算 (描画済み行数から推定)
# ヘッダー (border rounded): 約5行, Feature: 1行, 空行: 1行 = 7行ベース
# ステップリスト: FEATURE_STEPS=11行 + ヘッダー1行 + 空行1行 = 最大13行追加
# → スピナー行は画面上 7 + (ステップがあれば + ステップ数 + 2) 行目
_header_lines=7
_step_count=0
if [[ "$description" == FLOW:roadmap:* ]]; then
    _step_count=$(( ${#ROADMAP_STEPS[@]} + 2 ))
elif [[ "$description" == FLOW:* && "$description" != FLOW:ask* && "$description" != FLOW:report ]]; then
    _step_count=$(( ${#FEATURE_STEPS[@]} + 2 ))
fi
SPINNER_ROW=$(( _header_lines + _step_count ))
LOG_START_ROW=$((SPINNER_ROW + 1))
FOOTER_ROW=$((LOG_START_ROW + 4))

# B3: ログファイルパス推定
LOG_FILE=""
if [[ -n "$SESSION_NAME" ]]; then
    LOG_FILE="/tmp/${SESSION_NAME}-intake.log"
fi

# B2: 経過時間フォーマット
format_elapsed() {
    local secs="$1"
    printf "%d:%02d" $((secs / 60)) $((secs % 60))
}

# B1+B2: スピナー行描画
draw_spinner_line() {
    local elapsed="$1"
    local frame="${SPIN_FRAMES[$SPIN_IDX]}"
    SPIN_IDX=$(( (SPIN_IDX + 1) % ${#SPIN_FRAMES[@]} ))
    tput cup "$((SPINNER_ROW - 1))" 0 2>/dev/null
    printf "\033[2K"
    printf "  %b%s%b %s... (%s)" "$C_RUNNING" "$frame" "$C_RESET" "$STEP_LABEL" "$(format_elapsed "$elapsed")"
}

# B3: ログ行描画
draw_log_lines() {
    if [[ "$SHOW_LOG" != "true" ]]; then
        # ログ非表示時: ログ領域をクリア
        for (( r=0; r<3; r++ )); do
            tput cup "$((LOG_START_ROW + r))" 0 2>/dev/null
            printf "\033[2K"
        done
        return
    fi

    if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
        local new_lines
        new_lines="$(tail -n 3 "$LOG_FILE" 2>/dev/null || echo '')"
        if [[ "$new_lines" != "$PREV_LOG_LINES" ]]; then
            PREV_LOG_LINES="$new_lines"
            local i=0
            while IFS= read -r line; do
                tput cup "$((LOG_START_ROW + i))" 0 2>/dev/null
                printf "\033[2K"
                # 幅制限 (端末幅 - 4)
                local maxw=$(( $(tput cols) - 4 ))
                printf "  %b%.${maxw}s%b" "$C_PENDING" "$line" "$C_RESET"
                ((i++))
            done <<< "$new_lines"
            # 残り行をクリア
            while (( i < 3 )); do
                tput cup "$((LOG_START_ROW + i))" 0 2>/dev/null
                printf "\033[2K"
                ((i++))
            done
        fi
    fi
}

# B5: フッター描画
draw_progress_footer() {
    tput cup "$FOOTER_ROW" 0 2>/dev/null
    printf "\033[2K"
    printf "  %bq%b:中止  %bl%b:ログ  %bCtrl+C%b:強制停止" \
        "$C_KEY" "$C_RESET" "$C_KEY" "$C_RESET" "$C_KEY" "$C_RESET"
}

# B4: 中止確認
confirm_quit() {
    tput cup "$((FOOTER_ROW + 1))" 0 2>/dev/null
    printf "\033[2K"
    printf "  %b中止しますか？ (y/n)%b " "$C_FAILED" "$C_RESET"
    while true; do
        local qkey=""
        read -rsn1 -t 0.2 qkey || true
        case "$qkey" in
            y|Y)
                # 中止: SESSION_NAME の tmux セッションを kill
                if [[ -n "$SESSION_NAME" ]]; then
                    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
                fi
                cursor_show
                exit 1
                ;;
            n|N|"")
                # キャンセル: 確認行をクリア
                tput cup "$((FOOTER_ROW + 1))" 0 2>/dev/null
                printf "\033[2K"
                return
                ;;
        esac
    done
}

# 初回フッター描画
draw_progress_footer

# B1: メインスピナーループ
START_TIME=$SECONDS
while true; do
    elapsed=$(( SECONDS - START_TIME ))

    # B1+B2: スピナー + 経過時間
    draw_spinner_line "$elapsed"

    # B3: ログポーリング (0.5秒間隔 — readのtimeout分を合算)
    draw_log_lines

    # B4: ノンブロッキングキー入力 (0.2秒待ち)
    input_key=""
    read -rsn1 -t 0.2 input_key || true
    case "$input_key" in
        q|Q)
            confirm_quit
            ;;
        l|L)
            # B4: ログ表示トグル
            if [[ "$SHOW_LOG" == "true" ]]; then
                SHOW_LOG=false
            else
                SHOW_LOG=true
            fi
            draw_log_lines
            ;;
    esac
done
