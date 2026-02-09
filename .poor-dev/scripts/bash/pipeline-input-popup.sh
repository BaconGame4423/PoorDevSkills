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
MODES=(intake feature bugfix roadmap ask report)
MODE_IDX=0
BUFFER=""

# モード別プレースホルダー
declare -A MODE_PLACEHOLDER
MODE_PLACEHOLDER[intake]="機能説明 or バグ報告を入力..."
MODE_PLACEHOLDER[feature]="機能の説明を入力..."
MODE_PLACEHOLDER[bugfix]="バグの詳細を入力..."
MODE_PLACEHOLDER[roadmap]="テーマを入力..."
MODE_PLACEHOLDER[ask]="質問を入力..."
MODE_PLACEHOLDER[report]="Enter で実行"

# モード別: BUFFER 必須か
declare -A MODE_REQUIRES_BUFFER
MODE_REQUIRES_BUFFER[intake]=1
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

# --- Ctrl+S: モデル設定画面 (A1-A5) ---

# サブエージェント定義 (設定画面で再利用)
declare -A STEP_AGENTS
STEP_AGENTS[planreview]="pm critical risk value"
STEP_AGENTS[tasksreview]="techlead senior devops junior"
STEP_AGENTS[architecturereview]="architect performance security sre"
STEP_AGENTS[qualityreview]="qa testdesign code security"
STEP_AGENTS[phasereview]="qa regression docs ux"

# A5: 設定項目リスト生成 (毎回YAML再読み込み)
build_settings_items() {
    local items=()
    local default_model
    default_model="$(yq '.defaults.model // "sonnet"' "$CONFIG_FILE" 2>/dev/null)"
    items+=("defaults.model ............... $default_model")

    local all_steps="intake specify clarify plan planreview tasks tasksreview architecturereview implement qualityreview phasereview"

    for step in $all_steps; do
        local step_model
        step_model="$(yq ".steps.$step.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
        [[ "$step_model" == "null" ]] && step_model=""
        local display_model="${step_model:-(default)}"
        items+=("$step ..................... $display_model")

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

    printf '%s\n' "${items[@]}"
}

# A5: 表示行からキー抽出
extract_key_from_line() {
    echo "$1" | sed 's/ *[.]*  *[^ ]*$//' | sed 's/^ *//' | sed 's/ *$//'
}

# A3: ヘッダー以降のみクリア
clear_overlay_area() {
    local start_row=$((HEADER_LINES))
    tput cup "$start_row" 0 2>/dev/null
    tput ed 2>/dev/null  # カーソル以降を全消去
}

# A2+A4: モデル選択 (gum filter + カスタム入力)
select_model_for() {
    local key="$1"
    local available_height filter_height
    available_height=$(( $(tput lines) - HEADER_LINES - 3 ))
    filter_height=$available_height
    (( filter_height < 5 )) && filter_height=5
    (( filter_height > 25 )) && filter_height=25

    local new_model
    new_model=$(printf '%s\n' "haiku" "sonnet" "opus" \
        "claude-sonnet-4-5-20250929" "claude-haiku-4-5-20251001" "claude-opus-4-6" \
        "glm-4.7" "glm-4.7-1m" \
        "gpt-4o" "gpt-4o-mini" "gpt-4.1" "gpt-4.1-mini" "gpt-4.1-nano" \
        "o3" "o4-mini" \
        "gemini-2.5-pro" "gemini-2.5-flash" \
        "(default)" "カスタム入力..." \
        | gum filter --header "モデル選択: $key (Esc: 戻る)" \
            --header.foreground "141" \
            --indicator.foreground "141" \
            --match.foreground "214" \
            --height "$filter_height") || return 1

    if [[ "$new_model" == "カスタム入力..." ]]; then
        new_model=$(gum input --placeholder "例: glm-4.7" \
            --header "カスタムモデル名を入力" \
            --header.foreground "141") || return 1
        [[ -z "$new_model" ]] && return 1
    fi

    echo "$new_model"
}

# A5: YAML保存
save_model_setting() {
    local key="$1" new_model="$2"

    if [[ "$new_model" == "(default)" ]]; then
        if [[ "$key" == "defaults.model" ]]; then
            yq -i '.defaults.model = "sonnet"' "$CONFIG_FILE" 2>/dev/null
        elif [[ "$key" == *" > "* ]]; then
            local step_part agent_part
            step_part="$(echo "$key" | awk -F' > ' '{print $1}')"
            agent_part="$(echo "$key" | awk -F' > ' '{print $2}')"
            yq -i "del(.steps.$step_part.agents.$agent_part.model)" "$CONFIG_FILE" 2>/dev/null || true
        else
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
}

# A1: メイン設定画面 (while ループ化)
open_settings() {
    printf "\033[?25h"  # カーソル復元

    local available_height filter_height
    available_height=$(( $(tput lines) - HEADER_LINES - 3 ))
    filter_height=$available_height
    (( filter_height < 5 )) && filter_height=5
    (( filter_height > 25 )) && filter_height=25

    while true; do
        # A3: ヘッダー以降のみクリア
        clear_overlay_area

        # A5: 設定項目リスト生成 (毎回YAML再読み込み→変更即反映)
        local selected
        selected=$(build_settings_items | gum filter --header "モデル設定 (Esc: 戻る)" \
            --header.foreground "141" \
            --indicator.foreground "141" \
            --match.foreground "214" \
            --height "$filter_height") || break  # Esc → ループ終了

        # A5: キー抽出
        local key
        key="$(extract_key_from_line "$selected")"

        # A3: ヘッダー以降のみクリア
        clear_overlay_area

        # A2+A4: モデル選択
        local new_model
        new_model="$(select_model_for "$key")" || continue  # Esc → 設定リストに戻る

        # A5: 保存
        save_model_setting "$key" "$new_model"
    done

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
    intake)
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
