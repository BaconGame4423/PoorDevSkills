#!/usr/bin/env bash
# tmux display-popup 内で実行される入力スクリプト。
# テキスト入力中に Tab/Shift+Tab でモード切替可能な TUI。
# Usage: pipeline-input-popup.sh <desc_output_file>
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"

DESC_FILE="${1:?Usage: pipeline-input-popup.sh <desc_output_file>}"
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE=triage   # triage | switch
BUFFER=""

# --- ヘッダーのプリレンダリング ---
HEADER_TRIAGE=$(gum style --border rounded --padding "1 2" --border-foreground "141" \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" "" \
    "$(gum style --foreground 245 '▸ triage │ switch')  $(gum style --faint '⇧Tab: 切替')")

HEADER_SWITCH=$(gum style --border rounded --padding "1 2" --border-foreground "214" \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" "" \
    "$(gum style --foreground 245 'triage │ ▸ switch')  $(gum style --faint '⇧Tab: 切替')")

# --- 描画関数 ---

# 全画面再描画
draw_full() {
    printf "\033[2J\033[H"

    if [[ "$MODE" == "triage" ]]; then
        printf '%s\n' "$HEADER_TRIAGE"
    else
        printf '%s\n' "$HEADER_SWITCH"
    fi

    echo ""
    draw_input_line
    echo ""
    draw_footer
}

# 入力行のみ再描画 (行位置固定: ヘッダー行数の次)
redraw_input_line() {
    # ヘッダーは7行 (border 5行 + 空行1 + 入力行位置=行7, 0-indexed=6)
    tput cup "$INPUT_ROW" 0 2>/dev/null
    printf "\033[2K"
    draw_input_line
}

# フッター行のみ再描画
redraw_footer() {
    tput cup "$FOOTER_ROW" 0 2>/dev/null
    printf "\033[2K"
    draw_footer
}

# 入力行の描画
draw_input_line() {
    if [[ -z "$BUFFER" ]]; then
        if [[ "$MODE" == "triage" ]]; then
            printf "  \033[38;5;245m機能説明 or バグ報告を入力...\033[0m"
        else
            printf "  \033[38;5;245mフロー説明を入力 (空でもOK)...\033[0m"
        fi
    else
        printf "  \033[37m%s\033[0m\033[7m \033[0m" "$BUFFER"
    fi
}

# フッター行の描画
draw_footer() {
    if [[ "$MODE" == "triage" ]]; then
        printf "  \033[38;5;245mEnter: 送信\033[0m"
    else
        printf "  \033[38;5;245mEnter: フロー選択\033[0m"
    fi
}

# --- 行位置の計算 ---
# HEADER_TRIAGE の行数を数える
HEADER_LINES=$(printf '%s\n' "$HEADER_TRIAGE" | wc -l)
# ヘッダー + 空行 = 入力行の位置 (0-indexed)
INPUT_ROW=$((HEADER_LINES + 1))
# 入力行 + 空行 = フッター行の位置
FOOTER_ROW=$((INPUT_ROW + 2))

# --- カーソル非表示 + 終了時復元 ---
printf "\033[?25l"
cleanup() { printf "\033[?25h"; }
trap cleanup EXIT

# --- 初回描画 ---
draw_full

# --- メインループ: 文字単位入力 ---
while true; do
    IFS= read -rsn1 key

    case "$key" in
        $'\x1b')
            # エスケープシーケンスの残りを読む
            read -rsn2 -t 0.1 rest || true
            if [[ "$rest" == "[Z" ]]; then
                # Shift+Tab → モード切替
                if [[ "$MODE" == "triage" ]]; then MODE=switch; else MODE=triage; fi
                draw_full
            elif [[ -z "$rest" ]]; then
                # Esc 単押し → キャンセル
                exit 1
            fi
            ;;
        $'\t')
            # Tab → モード切替
            if [[ "$MODE" == "triage" ]]; then MODE=switch; else MODE=triage; fi
            draw_full
            ;;
        $'\x7f'|$'\b')
            # Backspace → 末尾1文字削除
            if [[ -n "$BUFFER" ]]; then
                BUFFER="${BUFFER%?}"
                redraw_input_line
            fi
            ;;
        $'\x15')
            # Ctrl+U → バッファ全クリア
            BUFFER=""
            redraw_input_line
            ;;
        $'\x03')
            # Ctrl+C → キャンセル
            exit 1
            ;;
        "")
            # Enter → 送信処理へ
            break
            ;;
        *)
            # 通常文字 → バッファに追加
            BUFFER+="$key"
            redraw_input_line
            ;;
    esac
done

# --- カーソル復元 ---
printf "\033[?25h"

# --- Enter 後の送信処理 ---
if [[ "$MODE" == "triage" ]]; then
    # triage モード: BUFFER の内容をそのまま書き込み
    if [[ -z "$BUFFER" ]]; then
        exit 1
    fi
    printf '%s' "$BUFFER" > "$DESC_FILE"
else
    # switch モード: フロー選択
    printf "\033[2J\033[H"
    flow=$(bash "$SCRIPT_DIR/flow-selector.sh") || exit 1

    case "$flow" in
        ask|report)
            # ask/report は説明不要 → FLOW:type のみ
            printf 'FLOW:%s' "$flow" > "$DESC_FILE"
            exit 0
            ;;
    esac

    # feature/bugfix/roadmap: BUFFER があればそれを使う
    if [[ -n "$BUFFER" ]]; then
        printf 'FLOW:%s:%s' "$flow" "$BUFFER" > "$DESC_FILE"
    else
        # BUFFER 空 → gum input でフォールバック入力
        echo ""
        description=$(gum input \
            --placeholder "${flow} の説明を入力..." \
            --width 50 \
            --char-limit 500) || exit 1
        if [[ -z "$description" ]]; then
            exit 1
        fi
        printf 'FLOW:%s:%s' "$flow" "$description" > "$DESC_FILE"
    fi
fi
