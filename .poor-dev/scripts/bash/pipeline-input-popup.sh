#!/usr/bin/env bash
# tmux display-popup 内で実行される入力スクリプト。
# テキスト入力中に Tab/Shift+Tab で6モード直接サイクル可能な TUI。
# Ctrl+S でモデル設定画面を開く。
# Usage: pipeline-input-popup.sh <desc_output_file>
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"

DESC_FILE="${1:?Usage: pipeline-input-popup.sh <desc_output_file>}"
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONFIG_FILE="$REPO_ROOT/.poor-dev/pipeline-config.yaml"

# --- 6モード定義 ---
MODES=(triage feature bugfix roadmap ask report)
MODE_IDX=0
BUFFER=""

# モード別プレースホルダー
declare -A MODE_PLACEHOLDER
MODE_PLACEHOLDER[triage]="機能説明 or バグ報告を入力..."
MODE_PLACEHOLDER[feature]="機能の説明を入力..."
MODE_PLACEHOLDER[bugfix]="バグの詳細を入力..."
MODE_PLACEHOLDER[roadmap]="テーマを入力..."
MODE_PLACEHOLDER[ask]="質問を入力..."
MODE_PLACEHOLDER[report]="Enter で実行"

# モード別: BUFFER 必須か
declare -A MODE_REQUIRES_BUFFER
MODE_REQUIRES_BUFFER[triage]=1
MODE_REQUIRES_BUFFER[feature]=1
MODE_REQUIRES_BUFFER[bugfix]=1
MODE_REQUIRES_BUFFER[roadmap]=1
MODE_REQUIRES_BUFFER[ask]=1
MODE_REQUIRES_BUFFER[report]=0

current_mode() { echo "${MODES[$MODE_IDX]}"; }

cycle_mode_forward() {
    MODE_IDX=$(( (MODE_IDX + 1) % ${#MODES[@]} ))
    redraw_mode_line
    redraw_input_line
    redraw_footer
}

cycle_mode_backward() {
    MODE_IDX=$(( (MODE_IDX - 1 + ${#MODES[@]}) % ${#MODES[@]} ))
    redraw_mode_line
    redraw_input_line
    redraw_footer
}

# --- ヘッダー (gum, 静的) ---
HEADER=$(gum style --border rounded --padding "1 2" --border-foreground "141" \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')")

# --- モードライン描画 (raw ANSI, 動的) ---
draw_mode_line() {
    local mode
    mode="$(current_mode)"
    printf "  "
    for m in "${MODES[@]}"; do
        if [[ "$m" == "$mode" ]]; then
            printf "\033[1;38;5;141m▸ %s\033[0m  " "$m"
        else
            printf "\033[38;5;245m%s\033[0m  " "$m"
        fi
    done
    printf "\033[38;5;245m⇧Tab\033[0m"
}

# --- 描画関数 ---

# 全画面再描画
draw_full() {
    printf "\033[2J\033[H"
    printf '%s\n' "$HEADER"
    draw_mode_line
    echo ""
    echo ""
    draw_input_line
    echo ""
    draw_footer
}

# モードラインのみ再描画
redraw_mode_line() {
    tput cup "$MODE_LINE_ROW" 0 2>/dev/null
    printf "\033[2K"
    draw_mode_line
}

# 入力行のみ再描画
redraw_input_line() {
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

# 入力行の描画 (Issue 2: BUFFER 空でもブロックカーソル表示)
draw_input_line() {
    local mode placeholder
    mode="$(current_mode)"
    placeholder="${MODE_PLACEHOLDER[$mode]}"
    if [[ -z "$BUFFER" ]]; then
        printf "  \033[7m \033[0m \033[38;5;245m%s\033[0m" "$placeholder"
    else
        printf "  \033[37m%s\033[0m\033[7m \033[0m" "$BUFFER"
    fi
}

# フッター行の描画
draw_footer() {
    local mode
    mode="$(current_mode)"
    if [[ "$mode" == "report" ]]; then
        printf "  \033[38;5;245mEnter: 実行  Ctrl+S: 設定\033[0m"
    else
        printf "  \033[38;5;245mEnter: 送信  Ctrl+S: 設定\033[0m"
    fi
}

# --- Ctrl+S: モデル設定画面 ---
open_settings() {
    printf "\033[?25h"  # カーソル復元

    # 設定項目リスト生成
    local items=()
    local default_model
    default_model="$(yq '.defaults.model // "sonnet"' "$CONFIG_FILE" 2>/dev/null)"
    items+=("defaults.model ............... $default_model")
    items+=("─────────────────────────────────────")

    # ステップ + サブエージェント定義
    local all_steps="triage specify clarify plan planreview tasks tasksreview architecturereview implement qualityreview phasereview"

    declare -A STEP_AGENTS
    STEP_AGENTS[planreview]="pm critical risk value"
    STEP_AGENTS[tasksreview]="techlead senior devops junior"
    STEP_AGENTS[architecturereview]="architect performance security sre"
    STEP_AGENTS[qualityreview]="qa testdesign code security"
    STEP_AGENTS[phasereview]="qa regression docs ux"

    for step in $all_steps; do
        local step_model
        step_model="$(yq ".steps.$step.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
        [[ "$step_model" == "null" ]] && step_model=""
        local display_model="${step_model:-(default)}"
        items+=("$step ..................... $display_model")

        # サブエージェント
        if [[ -n "${STEP_AGENTS[$step]:-}" ]]; then
            for agent in ${STEP_AGENTS[$step]}; do
                local agent_model
                agent_model="$(yq ".steps.$step.agents.$agent.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
                [[ "$agent_model" == "null" ]] && agent_model=""
                local agent_display="${agent_model:-(default)}"
                items+=("  $step > $agent ...... $agent_display")
            done
        fi
    done

    printf "\033[2J\033[H"

    local selected
    selected=$(printf '%s\n' "${items[@]}" | gum choose --header "モデル設定 (Esc: 戻る)" --cursor.foreground "141" --height 30) || {
        # Esc or error → 入力画面に復帰
        printf "\033[?25l"
        draw_full
        return
    }

    # セパレータ選択時は無視
    if [[ "$selected" == ─* ]]; then
        printf "\033[?25l"
        draw_full
        return
    fi

    # 選択された項目からキーを抽出
    local key
    key="$(echo "$selected" | sed 's/ *[.]*  *[^ ]*$//' | sed 's/^ *//' | sed 's/ *$//')"

    # モデル選択
    local new_model
    new_model=$(gum choose "haiku" "sonnet" "opus" "(default)" \
        --header "モデル選択: $key" --cursor.foreground "141") || {
        printf "\033[?25l"
        draw_full
        return
    }

    # 設定保存
    if [[ "$new_model" == "(default)" ]]; then
        # オーバーライド削除
        if [[ "$key" == "defaults.model" ]]; then
            yq -i '.defaults.model = "sonnet"' "$CONFIG_FILE" 2>/dev/null
        elif [[ "$key" == *" > "* ]]; then
            # agent-level: "planreview > pm" → steps.planreview.agents.pm.model を削除
            local step_part agent_part
            step_part="$(echo "$key" | awk -F' > ' '{print $1}')"
            agent_part="$(echo "$key" | awk -F' > ' '{print $2}')"
            yq -i "del(.steps.$step_part.agents.$agent_part.model)" "$CONFIG_FILE" 2>/dev/null || true
        else
            # step-level
            yq -i "del(.steps.$key.model)" "$CONFIG_FILE" 2>/dev/null || true
        fi
    else
        if [[ "$key" == "defaults.model" ]]; then
            yq -i ".defaults.model = \"$new_model\"" "$CONFIG_FILE" 2>/dev/null
        elif [[ "$key" == *" > "* ]]; then
            local step_part agent_part
            step_part="$(echo "$key" | awk -F' > ' '{print $1}')"
            agent_part="$(echo "$key" | awk -F' > ' '{print $2}')"
            yq -i ".steps.$step_part.agents.$agent_part.model = \"$new_model\"" "$CONFIG_FILE" 2>/dev/null
        else
            yq -i ".steps.$key.model = \"$new_model\"" "$CONFIG_FILE" 2>/dev/null
        fi
    fi

    printf "\033[?25l"
    draw_full
}

# --- 行位置の計算 ---
HEADER_LINES=$(printf '%s\n' "$HEADER" | wc -l)
# ヘッダー行の次 = モードライン行 (0-indexed)
MODE_LINE_ROW=$((HEADER_LINES))
# モードライン + 空行 = 入力行
INPUT_ROW=$((MODE_LINE_ROW + 2))
# 入力行 + 空行 = フッター行
FOOTER_ROW=$((INPUT_ROW + 1))

# --- フロー制御無効化 (Ctrl+S を XOFF から解放) + カーソル非表示 + 終了時復元 ---
ORIG_STTY="$(stty -g)"
stty -ixon
printf "\033[?25l"
cleanup() {
    stty "$ORIG_STTY" 2>/dev/null
    printf "\033[?25h"
}
trap cleanup EXIT

# --- 初回描画 ---
draw_full

# --- Issue 4a: stdin ドレイン (初回描画後、入力ループ前にバッファフラッシュ) ---
sleep 0.1
while read -rsn1 -t 0.05 _discard; do :; done

# --- メインループ: 文字単位入力 ---
while true; do
    IFS= read -rsn1 key

    case "$key" in
        $'\x1b')
            # Issue 4b: 完全な ESC シーケンスパーサー
            read -rsn1 -t 0.1 next || true
            case "$next" in
                '[')
                    # CSI: ESC [ ... letter/~
                    csi=""
                    while read -rsn1 -t 0.1 ch; do
                        csi+="$ch"
                        [[ "$ch" =~ [A-Za-z~] ]] && break
                    done
                    if [[ "$csi" == "Z" ]]; then
                        cycle_mode_backward
                    fi
                    # 他の CSI (矢印キー, CPR 等) は破棄
                    ;;
                ']')
                    # OSC: ESC ] ... (BEL or ESC\)
                    while read -rsn1 -t 0.1 ch; do
                        [[ "$ch" == $'\x07' ]] && break
                        if [[ "$ch" == $'\x1b' ]]; then
                            read -rsn1 -t 0.1 _ || true
                            break
                        fi
                    done
                    ;;
                '')
                    # ESC 単押し → キャンセル
                    exit 1
                    ;;
            esac
            ;;
        $'\t')
            # Tab → 次のモード (forward)
            cycle_mode_forward
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
        $'\x13')
            # Ctrl+S → 設定画面
            open_settings
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
mode="$(current_mode)"

case "$mode" in
    triage)
        # BUFFER 必須
        [[ -z "$BUFFER" ]] && exit 1
        printf '%s' "$BUFFER" > "$DESC_FILE"
        ;;
    feature|bugfix|roadmap)
        # BUFFER 必須 → FLOW:type:BUFFER
        [[ -z "$BUFFER" ]] && exit 1
        printf 'FLOW:%s:%s' "$mode" "$BUFFER" > "$DESC_FILE"
        ;;
    ask)
        # BUFFER 必須 → FLOW:ask:BUFFER
        [[ -z "$BUFFER" ]] && exit 1
        printf 'FLOW:%s:%s' "$mode" "$BUFFER" > "$DESC_FILE"
        ;;
    report)
        # BUFFER 不要 → FLOW:report
        printf 'FLOW:report' > "$DESC_FILE"
        ;;
esac
