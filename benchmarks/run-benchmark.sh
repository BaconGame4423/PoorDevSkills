#!/usr/bin/env bash
# ============================================================
# run-benchmark.sh - ベンチマーク実行スクリプト
# ============================================================
# Usage:
#   ./benchmarks/run-benchmark.sh <combo> [version]
#       セットアップ + CLI自動検出 + 非対話パイプライン実行 + 分析 + メトリクス収集
#
#   ./benchmarks/run-benchmark.sh --collect <combo>
#       メトリクス収集のみ
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/benchmarks.json"
DEVSKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- 色定義 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- 前提条件チェック ---
if ! command -v jq &>/dev/null; then
  err "jq が必要です。先にインストールしてください。"
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  err "$CONFIG が見つかりません"
  exit 1
fi

# --- JSON ヘルパー ---
jval() { jq -r "$1" "$CONFIG"; }

# --- 引数解析 ---
COLLECT_ONLY=false
COMBO=""
VERSION=""

if [[ "${1:-}" == "--collect" ]]; then
  COLLECT_ONLY=true
  COMBO="${2:-}"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage:"
  echo "  $0 <combo> [version]    セットアップ + 非対話パイプライン実行 + 分析 + メトリクス収集"
  echo "  $0 --collect <combo>    メトリクス収集のみ"
  echo ""
  echo "Arguments:"
  echo "  combo    ベンチマーク組み合わせ名 (e.g. glm5_all, m2.5_all, claude_all)"
  echo "  version  PoorDevSkills バージョン (デフォルト: package.json の version)"
  echo ""
  echo "利用可能な組み合わせ:"
  jq -r '.combinations[] | "  \(.dir_name)\t(\(.orchestrator)/\(.sub_agent))"' "$CONFIG"
  exit 0
else
  COMBO="${1:-}"
  VERSION="${2:-}"
fi

if [[ -z "$COMBO" ]]; then
  err "combo を指定してください"
  echo ""
  echo "利用可能な組み合わせ:"
  jq -r '.combinations[].dir_name' "$CONFIG" | sed 's/^/  /'
  exit 1
fi

# --- combo 存在確認 ---
COMBO_INDEX=$(jq -r --arg c "$COMBO" '[.combinations[].dir_name] | to_entries[] | select(.value == $c) | .key' "$CONFIG")
if [[ -z "$COMBO_INDEX" ]]; then
  err "不明な combo: $COMBO"
  echo "利用可能な組み合わせ:"
  jq -r '.combinations[].dir_name' "$CONFIG" | sed 's/^/  /'
  exit 1
fi

# --- CLI 自動検出 ---
ORCH=$(jval ".combinations[$COMBO_INDEX].orchestrator")
ORCH_CLI=$(jval ".models[\"$ORCH\"].cli")
ORCH_MODEL=$(jval ".models[\"$ORCH\"].model_id")

if ! command -v "$ORCH_CLI" &>/dev/null; then
  err "$ORCH_CLI が見つかりません（combo $COMBO に必要）"
  exit 1
fi

info "CLI: $ORCH_CLI / モデル: $ORCH_MODEL"

# --- バージョン解決 ---
if [[ -z "$VERSION" ]]; then
  VERSION=$(jq -r '.version' "$DEVSKILLS_DIR/package.json")
fi

TARGET_DIR="$SCRIPT_DIR/$COMBO"

# ============================================================
# build_prompt: benchmarks.json からプロンプトを動的構築
# ============================================================
build_prompt() {
  local task_name task_desc requirements prompt

  task_name=$(jval '.task.name')
  task_desc=$(jval '.task.description')
  requirements=$(jq -r '.task.requirements[] | "- \(.id): \(.name)"' "$CONFIG")

  prompt="/poor-dev ${task_desc}「${task_name}」を開発してください。
要件:
${requirements}"

  echo "$prompt"
}

# ============================================================
# setup_environment: 環境セットアップ
# ============================================================
setup_environment() {
  info "=== ベンチマーク環境セットアップ: $COMBO (v$VERSION) ==="
  echo ""

  # 1) .poor-dev-version 更新（scaffold 側）
  info ".poor-dev-version を $VERSION に更新"
  echo "$VERSION" > "$SCRIPT_DIR/_scaffold/common/.poor-dev-version"

  # 2) setup-benchmarks.sh 実行（ディレクトリ未作成時）
  if [[ ! -d "$TARGET_DIR" ]]; then
    info "setup-benchmarks.sh を実行（ディレクトリ未作成）"
    bash "$SCRIPT_DIR/setup-benchmarks.sh"
    ok "セットアップ完了"
  else
    # 既存ディレクトリがあってもスキルファイルを最新に更新
    info "既存ディレクトリを検出。スキルファイルを更新"
    bash "$SCRIPT_DIR/setup-benchmarks.sh" --update
    ok "スキルファイル更新完了"
  fi

  # 3) .poor-dev-version をターゲットにも反映
  echo "$VERSION" > "$TARGET_DIR/.poor-dev-version"

  # 4) パイプライン補完: setup-benchmarks.sh が除外しているファイルを補完
  info "パイプライン補完（pipeline.md, lib/, commands/）"

  # pipeline.md コピー
  local pipeline_src=""
  if [[ -f "$DEVSKILLS_DIR/commands/poor-dev.pipeline.md" ]]; then
    pipeline_src="$DEVSKILLS_DIR/commands/poor-dev.pipeline.md"
  elif [[ -f "$DEVSKILLS_DIR/.opencode/command/poor-dev.pipeline.md" ]]; then
    pipeline_src="$DEVSKILLS_DIR/.opencode/command/poor-dev.pipeline.md"
  fi

  if [[ -n "$pipeline_src" ]]; then
    cp "$pipeline_src" "$TARGET_DIR/.opencode/command/poor-dev.pipeline.md"
    # claude variant の場合 symlink も作成
    if [[ -d "$TARGET_DIR/.claude/commands" ]]; then
      ln -sf "../../.opencode/command/poor-dev.pipeline.md" "$TARGET_DIR/.claude/commands/poor-dev.pipeline.md"
    fi
    ok "pipeline.md をコピー"
  else
    warn "pipeline.md が見つかりません"
  fi

  # lib/ symlink（存在しない場合のみ）
  if [[ ! -e "$TARGET_DIR/lib" ]]; then
    ln -s "$DEVSKILLS_DIR/lib" "$TARGET_DIR/lib"
    ok "lib/ symlink を作成"
  fi

  # commands/ symlink（存在しない場合のみ）
  if [[ ! -e "$TARGET_DIR/commands" ]]; then
    ln -s "$DEVSKILLS_DIR/commands" "$TARGET_DIR/commands"
    ok "commands/ symlink を作成"
  fi

  # 5) git commit（.git が存在する場合のみ）
  if [[ -d "$TARGET_DIR/.git" ]]; then
    (
      cd "$TARGET_DIR"
      if [[ -n "$(git status --porcelain)" ]]; then
        git add -A
        git commit -q -m "benchmark setup: pipeline補完 + version $VERSION"
        ok "パイプライン補完をコミット"
      fi
    )
  fi

  echo ""
  ok "環境セットアップ完了"
}

# ============================================================
# run_pipeline: 非対話パイプライン実行（auto-resume 対応）
# ============================================================
run_pipeline() {
  local prompt="$1"
  local max_retries=5
  local attempt=0

  while [[ $attempt -lt $max_retries ]]; do
    attempt=$((attempt + 1))
    info "パイプライン実行 (attempt $attempt/$max_retries)"

    # プロンプトをファイルに書き出し
    local prompt_file="/tmp/poor-dev-bench-prompt-$$.txt"
    echo "$prompt" > "$prompt_file"

    # CLI に応じた非対話実行
    if [[ "$ORCH_CLI" == "claude" ]]; then
      (cd "$TARGET_DIR" && env -u CLAUDECODE claude -p \
        --model "$ORCH_MODEL" \
        --output-format text \
        < "$prompt_file" \
        > "$TARGET_DIR/.bench-output.txt" 2>&1) || true
    else
      (cd "$TARGET_DIR" && opencode run \
        --model "$ORCH_MODEL" \
        --format json \
        "$(cat "$prompt_file")" \
        > "$TARGET_DIR/.bench-output.txt" 2>&1) || true
    fi

    rm -f "$prompt_file"

    # pipeline-state.json で完了判定
    local state_file="$TARGET_DIR/.poor-dev/pipeline-state.json"
    if [[ ! -f "$state_file" ]]; then
      warn "pipeline-state.json が見つかりません。パイプライン未開始の可能性"
      break
    fi

    local status
    status=$(jq -r '.status // "unknown"' "$state_file")

    case "$status" in
      completed)
        ok "パイプライン完了"
        return 0
        ;;
      awaiting-approval|paused|rate-limited)
        info "ステータス: $status → 自動リトライ"
        # 同じプロンプトで再投入（Step 3 Resume Detection が auto-approve）
        ;;
      error)
        warn "パイプラインエラー。成果物を保持して続行"
        return 1
        ;;
      *)
        info "ステータス: $status"
        break
        ;;
    esac
  done

  warn "最大リトライ到達。部分的な成果物で分析を続行"
  return 1
}

# ============================================================
# analyze_poordev: PoorDevSkills 分析フェーズ
# ============================================================
analyze_poordev() {
  info "=== PoorDevSkills 分析フェーズ ==="

  # 分析プロンプト構築
  local analysis_prompt_file="/tmp/poor-dev-analysis-prompt-$$.txt"
  cat > "$analysis_prompt_file" <<'ANALYSIS_EOF'
このディレクトリは PoorDevSkills パイプラインのベンチマーク実行結果です。
成果物を分析し、PoorDevSkills 自体の問題点と改善案を特定してください。

## 分析対象ファイル（存在するものを全て読んでください）
- spec.md, plan.md, tasks.md, review-log.yaml
- *.html, *.js, *.css, *.ts, *.py（生成コード）
- .poor-dev/pipeline-state.json
- git log --oneline --all（Bash で実行）

## 評価観点

### A. ワークフロー全体
1. パイプライン遵守: 各ステップが正しく実行されたか
2. 情報欠落: ステップ間で引き渡されるべき情報の欠落
3. 手戻り/ボトルネック: 不要な再実行や停滞
4. レビュー有効性: レビュー指摘の適切さと修正反映
5. 成果物一貫性: spec→plan→tasks→code の論理的整合

### B. コマンド/テンプレート品質
1. コマンドの指示は明確だったか（.opencode/command/ 内を参照可能）
2. テンプレートのフォーマットは適切か
3. NON_INTERACTIVE_HEADER の制約は理解しやすいか
4. 不足/曖昧な指示箇所
5. 改善すべきコマンド/テンプレートと修正案

### C. モデル適合性
1. 特に難しかったステップとその理由
2. プロンプトの長さ・複雑さの適切さ
3. コンテキストウィンドウ制約への抵触
4. モデルティア設定の最適化提案
5. fallback_model の切り替えは適切だったか

## 出力
poordev-analysis.yaml を作成してください:

workflow:
  pipeline_adherence: { completed_steps: [], skipped_steps: [], notes: "" }
  information_flow: { gaps: [], notes: "" }
  bottlenecks: { issues: [], notes: "" }
  review_effectiveness: { useful_fixes: 0, noise_fixes: 0, notes: "" }

commands:
  issues: []  # { command: "", severity: H/M/L, description: "", suggestion: "" }
  strengths: []

model_fit:
  difficult_steps: []  # { step: "", reason: "", suggestion: "" }
  prompt_issues: []
  context_window_pressure: { worst_step: "", estimated_tokens: 0, notes: "" }
  tier_recommendations: {}

summary:
  top_issues: []      # 最重要の問題 3 件
  quick_wins: []      # すぐ修正できる改善 3 件
  strategic: []       # 中長期的な改善提案
ANALYSIS_EOF

  # 分析実行（同じ CLI/モデル）
  if [[ "$ORCH_CLI" == "claude" ]]; then
    (cd "$TARGET_DIR" && env -u CLAUDECODE claude -p \
      --model "$ORCH_MODEL" \
      --output-format text \
      < "$analysis_prompt_file") || warn "分析フェーズ失敗"
  else
    (cd "$TARGET_DIR" && opencode run \
      --model "$ORCH_MODEL" \
      --format json \
      "$(cat "$analysis_prompt_file")") || warn "分析フェーズ失敗"
  fi

  rm -f "$analysis_prompt_file"

  # 結果確認
  if [[ -f "$TARGET_DIR/poordev-analysis.yaml" ]]; then
    ok "分析完了: poordev-analysis.yaml"
  else
    warn "poordev-analysis.yaml が生成されませんでした"
  fi
}

# ============================================================
# collect_and_summarize: メトリクス収集 + サマリ出力
# ============================================================
collect_and_summarize() {
  local start_ts="${1:-0}"

  info "=== メトリクス収集: $COMBO ==="
  echo ""

  # 1) collect-metrics.sh 実行
  if [[ -x "$SCRIPT_DIR/reviews/collect-metrics.sh" ]]; then
    bash "$SCRIPT_DIR/reviews/collect-metrics.sh" "$COMBO"
  else
    warn "collect-metrics.sh が見つかりません。スキップ"
  fi

  echo ""

  # 2) review YAML テンプレート複製
  local review_dir="$SCRIPT_DIR/reviews"
  local review_file="$review_dir/${COMBO}.review.yaml"
  local template="$review_dir/_templates/benchmark-review.yaml"

  if [[ -f "$template" && ! -f "$review_file" ]]; then
    cp "$template" "$review_file"
    # meta セクションにディレクトリ名とバージョンを記録
    sed -i "s/^  directory: \"\"/  directory: \"$COMBO\"/" "$review_file"
    sed -i "s/^  review_date: \"\"/  review_date: \"$(date +%Y-%m-%d)\"/" "$review_file"
    ok "レビューテンプレートを作成: $review_file"
  elif [[ -f "$review_file" ]]; then
    info "レビューファイルは既に存在: $review_file"
  fi

  # 3) バージョン記録
  if [[ -f "$review_file" ]]; then
    # status を initial に設定（未記入の場合）
    if grep -q 'status: ""' "$review_file"; then
      sed -i 's/^  status: ""/  status: "initial"/' "$review_file"
    fi
  fi

  echo ""

  # 4) サマリ出力
  echo -e "${BOLD}============================================================${NC}"
  echo -e "${BOLD}  ベンチマーク完了サマリ: $COMBO${NC}"
  echo -e "${BOLD}============================================================${NC}"
  echo ""

  # 成果物一覧
  echo -e "${CYAN}--- 成果物 ---${NC}"
  for artifact in spec.md plan.md tasks.md review-log.yaml poordev-analysis.yaml; do
    if [[ -f "$TARGET_DIR/$artifact" ]]; then
      echo -e "  ${GREEN}[x]${NC} $artifact"
    else
      echo -e "  ${RED}[ ]${NC} $artifact"
    fi
  done
  echo ""

  # ファイル統計
  echo -e "${CYAN}--- ファイル統計 ---${NC}"
  local file_count=0
  local total_lines=0
  for f in "$TARGET_DIR"/*.html "$TARGET_DIR"/*.js "$TARGET_DIR"/*.css "$TARGET_DIR"/*.ts "$TARGET_DIR"/*.py; do
    [[ -f "$f" ]] || continue
    file_count=$((file_count + 1))
    local lines
    lines=$(wc -l < "$f")
    total_lines=$((total_lines + lines))
    printf "  %-40s %6d lines\n" "$(basename "$f")" "$lines"
  done
  echo "  合計: ${file_count} ファイル, ${total_lines} 行"
  echo ""

  # git 履歴
  echo -e "${CYAN}--- git 履歴 ---${NC}"
  if [[ -d "$TARGET_DIR/.git" ]]; then
    local commit_count
    commit_count=$(git -C "$TARGET_DIR" rev-list --all --count 2>/dev/null || echo 0)
    echo "  コミット数: $commit_count"
    git -C "$TARGET_DIR" log --oneline --all -5 2>/dev/null | sed 's/^/  /'
  else
    echo "  git リポジトリなし"
  fi
  echo ""

  # 経過時間
  if [[ "$start_ts" -gt 0 ]]; then
    local end_ts elapsed_s elapsed_m elapsed_h
    end_ts=$(date +%s)
    elapsed_s=$((end_ts - start_ts))
    elapsed_m=$((elapsed_s / 60))
    elapsed_h=$((elapsed_m / 60))
    local remaining_m=$((elapsed_m % 60))

    echo -e "${CYAN}--- 経過時間 ---${NC}"
    if [[ $elapsed_h -gt 0 ]]; then
      echo "  ${elapsed_h}h ${remaining_m}m (${elapsed_s}s)"
    elif [[ $elapsed_m -gt 0 ]]; then
      echo "  ${elapsed_m}m $((elapsed_s % 60))s"
    else
      echo "  ${elapsed_s}s"
    fi
    echo ""
  fi

  # 次のステップ
  echo -e "${CYAN}--- 次のステップ ---${NC}"
  if [[ -f "$TARGET_DIR/poordev-analysis.yaml" ]]; then
    echo "  1. poordev-analysis.yaml を確認"
  fi
  echo "  2. $review_dir/${COMBO}.review.yaml を記入してレビューを完了"
  echo "  3. poor-dev benchmark compare で COMPARISON.md を更新"
  echo ""
  echo -e "${BOLD}============================================================${NC}"
}

# ============================================================
# メイン処理
# ============================================================

if [[ "$COLLECT_ONLY" == true ]]; then
  # --collect モード: メトリクス収集のみ
  if [[ ! -d "$TARGET_DIR" ]]; then
    err "ディレクトリが見つかりません: $TARGET_DIR"
    exit 1
  fi
  collect_and_summarize 0
  exit 0
fi

# --- フル実行モード ---
START_TS=$(date +%s)

# Phase 1: 環境セットアップ
setup_environment

# Phase 2: プロンプト構築
PROMPT=$(build_prompt)

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  非対話パイプライン実行: $COMBO${NC}"
echo -e "${BOLD}  CLI: $ORCH_CLI / モデル: $ORCH_MODEL${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# Phase 3: パイプライン実行
run_pipeline "$PROMPT"

# Phase 4: メトリクス収集
collect_and_summarize "$START_TS"

# Phase 5: PoorDevSkills 分析
analyze_poordev

# Phase 6: 完了マーカー
date +%s > "$TARGET_DIR/.bench-complete"
ok "ベンチマーク全工程完了: $COMBO"
