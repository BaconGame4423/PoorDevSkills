#!/usr/bin/env bash
# Flow selector TUI using gum
# Outputs the selected flow type to stdout
set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pipeline-ui.sh"

FLOW=$(gum choose \
    "feature    : 機能開発" \
    "bugfix     : バグ修正" \
    "roadmap    : ロードマップ策定" \
    "ask        : 質問応答" \
    "report     : レポート生成" \
    --header "フローを選択" \
    --cursor.foreground "141") || exit 1

echo "$FLOW" | awk '{print $1}'
