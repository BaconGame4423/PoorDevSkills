#!/usr/bin/env bash
# tmux display-popup 内で実行される入力スクリプト。
# gum を使った TUI 入力 UI を提供する。
# Usage: pipeline-input-popup.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-input-popup.sh <desc_output_file>}"
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# popup 内ターミナルを初期化（シェル初期化出力をクリアし、上辺の欠落を防止）
printf "\033[2J\033[H"

# ヘッダー
gum style --border rounded --padding "1 2" --border-foreground "141" \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" \
    "" \
    "$(gum style --foreground 245 'AI-powered development pipeline')"
echo ""

# モード選択
mode=$(gum choose \
    "triage : 自動分類（推奨）" \
    "switch : フローを直接選択" \
    --header "モードを選択" \
    --cursor.foreground "141") || exit 1

mode_type=$(echo "$mode" | awk '{print $1}')

if [[ "$mode_type" == "switch" ]]; then
    flow=$(bash "$SCRIPT_DIR/flow-selector.sh") || exit 1

    # 非パイプラインフロー (ask/report): FLOW: プレフィクスで書き出して終了
    case "$flow" in
        ask|report)
            printf 'FLOW:%s' "$flow" > "$DESC_FILE"
            exit 0
            ;;
    esac

    # パイプラインフロー: フロータイプと説明文の両方が必要
    echo ""
    description=$(gum input \
        --placeholder "${flow} の説明を入力..." \
        --width 50 \
        --char-limit 500) || exit 1
    if [[ -z "$description" ]]; then
        exit 1
    fi
    printf 'FLOW:%s:%s' "$flow" "$description" > "$DESC_FILE"
    exit 0
fi

# --- 以降、既存の triage 入力フロー ---
description=$(gum input \
    --placeholder "機能説明 or バグ報告を入力..." \
    --width 50 \
    --char-limit 500) || true

if [[ -z "$description" ]]; then
    echo "" > "$DESC_FILE"
    exit 1
fi

printf '%s' "$description" > "$DESC_FILE"
