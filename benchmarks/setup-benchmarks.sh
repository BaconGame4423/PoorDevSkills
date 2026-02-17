#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/benchmarks.json"
SCAFFOLD="$SCRIPT_DIR/_scaffold"
DEVSKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

# --- Helper: JSON から値を取得 ---
jval() { jq -r "$1" "$CONFIG"; }

# --- モデル定義をロード ---
model_cli()      { jval ".models[\"$1\"].cli"; }
model_id()       { jval ".models[\"$1\"].model_id"; }
model_display()  { jval ".models[\"$1\"].display_name"; }
model_fallback() {
  local fb
  fb=$(jval ".models[\"$1\"].fallback_model // empty")
  echo "$fb"
}

# --- .poor-dev/config.json 導出 ---
# Solo (orch=sub): cli=sub, model=sub, fallback=model定義のfallback ?? sub
# Hybrid 同CLI:    cli=sub, model=sub, fallback=orch
# Hybrid 異CLI:    cli=sub, model=sub, fallback=sub
derive_config() {
  local orch="$1" sub="$2"
  local sub_cli sub_model orch_cli orch_model fb

  sub_cli=$(model_cli "$sub")
  sub_model=$(model_id "$sub")
  orch_cli=$(model_cli "$orch")
  orch_model=$(model_id "$orch")

  if [[ "$orch" == "$sub" ]]; then
    # Solo
    fb=$(model_fallback "$sub")
    [[ -z "$fb" ]] && fb="$sub_model"
  elif [[ "$orch_cli" == "$sub_cli" ]]; then
    # Hybrid 同CLI
    fb="$orch_model"
  else
    # Hybrid 異CLI
    fb="$sub_model"
  fi

  cat <<ENDJSON
{
  "default": {
    "cli": "$sub_cli",
    "model": "$sub_model"
  },
  "overrides": {},
  "gates": {},
  "auto_approve": true,
  "polling": {
    "interval": 1,
    "idle_timeout": 120,
    "max_timeout": 600,
    "step_timeouts": {}
  },
  "protected_files": [],
  "fallback_model": "$fb"
}
ENDJSON
}

# --- sync_scaffold: DevSkills ソース → スキャフォールドに同期 ---
sync_scaffold() {
  if [[ -z "$DEVSKILLS_DIR" || ! -d "$DEVSKILLS_DIR/.opencode/command" ]]; then
    echo "ERROR: DevSkills リポジトリが見つかりません ($SCRIPT_DIR/../DevSkills)" >&2
    exit 1
  fi

  echo "--- Syncing DevSkills → scaffold ---"

  # pipeline.md はベンチマーク不要なので除外
  local exclude_files="poor-dev.pipeline.md"

  for variant_dir in "$SCAFFOLD/opencode-variant" "$SCAFFOLD/claude-variant"; do
    local vname
    vname=$(basename "$variant_dir")

    # .opencode/command/
    rm -rf "$variant_dir/.opencode/command"
    mkdir -p "$variant_dir/.opencode/command"
    for f in "$DEVSKILLS_DIR/.opencode/command"/poor-dev*.md; do
      local fname
      fname=$(basename "$f")
      [[ "$exclude_files" == *"$fname"* ]] && continue
      cp "$f" "$variant_dir/.opencode/command/"
    done

    # .opencode/agents/
    rm -rf "$variant_dir/.opencode/agents"
    cp -rL "$DEVSKILLS_DIR/.opencode/agents" "$variant_dir/.opencode/"

    # .claude/agents/
    rm -rf "$variant_dir/.claude/agents"
    cp -rL "$DEVSKILLS_DIR/.claude/agents" "$variant_dir/.claude/"

    echo "  synced $vname"
  done

  # common files
  cp "$DEVSKILLS_DIR/constitution.md" "$SCAFFOLD/common/constitution.md"
  cp -r "$DEVSKILLS_DIR/templates/"* "$SCAFFOLD/common/templates/"
  echo "  synced common files"

  echo "--- scaffold sync complete ---"
  echo ""
}

# --- update_skill: 既存ディレクトリの PoorDevSkill ファイルだけを更新 ---
update_skill() {
  local target="$1" orch_cli="$2" dir_name="$3"

  if [[ ! -f "$target/.poor-dev/config.json" ]]; then
    echo "  SKIP: $dir_name/ はセットアップされていません（先に setup を実行してください）"
    return 1
  fi
  if [[ ! -d "$target/.git" ]]; then
    (
      cd "$target"
      git init -q
      # pre-push hook: ベンチマーク環境からの push を物理的にブロック
      mkdir -p .git/hooks
      cat > .git/hooks/pre-push <<'HOOK_EOF'
#!/usr/bin/env bash
echo "ERROR: ベンチマーク環境からの push は禁止されています" >&2
exit 1
HOOK_EOF
      chmod +x .git/hooks/pre-push
      git add -A
      git commit -q -m "initial scaffold for $dir_name"
    )
    echo "  created .git (was missing)"
  fi

  # バリアント選択
  if [[ "$orch_cli" == "claude" ]]; then
    variant="claude-variant"
  else
    variant="opencode-variant"
  fi

  # 1) common ファイル更新
  cp "$SCAFFOLD/common/constitution.md" "$target/"
  cp "$SCAFFOLD/common/.poor-dev-version" "$target/"
  cp "$SCAFFOLD/common/CLAUDE.md" "$target/"
  cp "$SCAFFOLD/common/AGENTS.md" "$target/"
  rm -rf "$target/templates"
  cp -r "$SCAFFOLD/common/templates" "$target/"
  echo "  updated common files"

  # 2) .opencode/ 更新（agents + commands）
  rm -rf "$target/.opencode/agents" "$target/.opencode/command"
  cp -rL "$SCAFFOLD/$variant/.opencode/agents" "$target/.opencode/"
  cp -rL "$SCAFFOLD/$variant/.opencode/command" "$target/.opencode/"
  echo "  updated .opencode/ (agents + commands)"

  # 3) .claude/agents/ 更新
  rm -rf "$target/.claude/agents"
  cp -rL "$SCAFFOLD/$variant/.claude/agents" "$target/.claude/"
  echo "  updated .claude/agents/"

  # 4) .claude/commands/ symlinks 再生成（claude variant のみ）
  if [[ "$orch_cli" == "claude" ]]; then
    rm -rf "$target/.claude/commands"
    mkdir -p "$target/.claude/commands"
    for cmd_file in "$target/.opencode/command"/poor-dev*.md; do
      [[ -f "$cmd_file" ]] || continue
      local_name=$(basename "$cmd_file")
      ln -s "../../.opencode/command/$local_name" "$target/.claude/commands/$local_name"
    done
    echo "  recreated .claude/commands/ symlinks ($(ls "$target/.claude/commands/" | wc -l) files)"
  fi

  # 5) git commit（変更がある場合のみ、.git が存在する場合のみ）
  if [[ -d "$target/.git" ]]; then
    # pre-push hook を確保（update 時にも）
    mkdir -p "$target/.git/hooks"
    cat > "$target/.git/hooks/pre-push" <<'HOOK_EOF'
#!/usr/bin/env bash
echo "ERROR: ベンチマーク環境からの push は禁止されています" >&2
exit 1
HOOK_EOF
    chmod +x "$target/.git/hooks/pre-push"
    (
      cd "$target"
      if [[ -n "$(git status --porcelain)" ]]; then
        git add -A
        git commit -q -m "update PoorDevSkill files"
        echo "  committed skill update"
      else
        echo "  no changes detected"
      fi
    )
  else
    echo "  skipped git commit (no .git)"
  fi
}

# --- 引数解析 ---
MODE="setup"
NO_GIT=false
for arg in "$@"; do
  case "$arg" in
    --update) MODE="update" ;;
    --no-git) NO_GIT=true ;;
  esac
done

# --- メイン処理 ---
combo_count=$(jval '.combinations | length')

if [[ "$MODE" == "update" ]]; then
  echo "=== setup-benchmarks --update: $combo_count combinations ==="

  # DevSkills → scaffold 同期
  sync_scaffold

  for i in $(seq 0 $((combo_count - 1))); do
    dir_name=$(jval ".combinations[$i].dir_name")
    orch=$(jval ".combinations[$i].orchestrator")
    orch_cli=$(model_cli "$orch")
    target="$SCRIPT_DIR/$dir_name"

    local mode
    mode=$(jval ".combinations[$i].mode // \"pipeline\"")

    echo ""
    echo "--- [$dir_name] updating skill files ---"

    if [[ "$mode" == "baseline" ]]; then
      echo "  SKIP: baseline モードはスキルファイル更新不要"
      continue
    fi

    update_skill "$target" "$orch_cli" "$dir_name"
  done

  echo ""
  echo "=== setup-benchmarks --update complete ==="
  exit 0
fi

echo "=== setup-benchmarks: $combo_count combinations ==="

for i in $(seq 0 $((combo_count - 1))); do
  dir_name=$(jval ".combinations[$i].dir_name")
  orch=$(jval ".combinations[$i].orchestrator")
  sub=$(jval ".combinations[$i].sub_agent")
  orch_cli=$(model_cli "$orch")
  orch_model=$(model_id "$orch")

  target="$SCRIPT_DIR/$dir_name"
  mode=$(jval ".combinations[$i].mode // \"pipeline\"")

  echo ""
  echo "--- [$dir_name] orch=$orch($orch_cli) sub=$sub mode=$mode ---"

  # 1) 既存ディレクトリ削除（冪等性）
  if [[ -d "$target" ]]; then
    rm -rf "$target"
    echo "  removed existing $dir_name/"
  fi

  # 2) ディレクトリ作成
  mkdir -p "$target"

  if [[ "$mode" == "baseline" ]]; then
    # --- baseline モード: 最小環境のみ ---

    # .gitignore
    cat > "$target/.gitignore" <<'GITIGNORE_EOF'
node_modules/
dist/
*.log
_runs/
GITIGNORE_EOF
    echo "  created .gitignore (minimal)"

    # CLAUDE.md（git push 禁止のみ）
    cat > "$target/CLAUDE.md" <<'CLAUDE_EOF'
# CLAUDE.md (Baseline Benchmark)

## 制約
- `git push` は絶対に実行しないでください
- 実装が完了したら `git commit` してください
CLAUDE_EOF
    echo "  created CLAUDE.md (minimal)"

    # git init + pre-push hook
    if [[ "$NO_GIT" == false ]]; then
      (
        cd "$target"
        git init -q
        mkdir -p .git/hooks
        cat > .git/hooks/pre-push <<'HOOK_EOF'
#!/usr/bin/env bash
echo "ERROR: ベンチマーク環境からの push は禁止されています" >&2
exit 1
HOOK_EOF
        chmod +x .git/hooks/pre-push
        git add -A
        git commit -q -m "initial scaffold for $dir_name (baseline)"
      )
      echo "  git init + initial commit done (baseline)"
    else
      echo "  skipped git init (--no-git)"
    fi

  else
    # --- pipeline モード: 既存のフルセットアップ ---

    # 3) common ファイルコピー
    cp "$SCAFFOLD/common/constitution.md" "$target/"
    cp "$SCAFFOLD/common/.gitignore" "$target/"
    cp "$SCAFFOLD/common/.poor-dev-version" "$target/"
    cp "$SCAFFOLD/common/CLAUDE.md" "$target/"
    cp "$SCAFFOLD/common/AGENTS.md" "$target/"
    cp -r "$SCAFFOLD/common/templates" "$target/"
    echo "  copied common files"

    # 4) バリアント選択 & コピー
    if [[ "$orch_cli" == "claude" ]]; then
      variant="claude-variant"
    else
      variant="opencode-variant"
    fi
    cp -rL "$SCAFFOLD/$variant/.opencode" "$target/"
    cp -rL "$SCAFFOLD/$variant/.claude" "$target/"
    echo "  copied $variant files"

    # 5) .poor-dev/config.json 生成
    mkdir -p "$target/.poor-dev"
    derive_config "$orch" "$sub" > "$target/.poor-dev/config.json"
    echo "  generated .poor-dev/config.json"

    # 6) opencode.json（orch が opencode の場合のみ）
    if [[ "$orch_cli" == "opencode" ]]; then
      cat > "$target/opencode.json" <<ENDJSON
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "$orch_model"
}
ENDJSON
      echo "  generated opencode.json"
    fi

    # 7) .claude/commands/ symlinks（orch が claude の場合のみ）
    if [[ "$orch_cli" == "claude" ]]; then
      mkdir -p "$target/.claude/commands"
      for cmd_file in "$target/.opencode/command"/poor-dev*.md; do
        [[ -f "$cmd_file" ]] || continue
        local_name=$(basename "$cmd_file")
        ln -s "../../.opencode/command/$local_name" "$target/.claude/commands/$local_name"
      done
      echo "  created .claude/commands/ symlinks ($(ls "$target/.claude/commands/" | wc -l) files)"
    fi

    # 8) git init + 初期コミット（--no-git でなければ）
    if [[ "$NO_GIT" == false ]]; then
      (
        cd "$target"
        git init -q
        # pre-push hook: ベンチマーク環境からの push を物理的にブロック
        mkdir -p .git/hooks
        cat > .git/hooks/pre-push <<'HOOK_EOF'
#!/usr/bin/env bash
echo "ERROR: ベンチマーク環境からの push は禁止されています" >&2
exit 1
HOOK_EOF
        chmod +x .git/hooks/pre-push
        git add -A
        git commit -q -m "initial scaffold for $dir_name"
      )
      echo "  git init + initial commit done"
    else
      echo "  skipped git init (--no-git)"
    fi

  fi

done

# 9) 古い review YAML を削除
echo ""
echo "--- Cleaning old review files ---"
for i in $(seq 0 $((combo_count - 1))); do
  dir_name=$(jval ".combinations[$i].dir_name")
  review_file="$SCRIPT_DIR/reviews/${dir_name}.review.yaml"
  if [[ -f "$review_file" ]]; then
    rm "$review_file"
    echo "  removed $review_file"
  fi
done

# 10) COMPARISON.md 再生成
echo ""
echo "--- Regenerating COMPARISON.md ---"
if [[ -x "$SCRIPT_DIR/generate-comparison.sh" ]]; then
  "$SCRIPT_DIR/generate-comparison.sh"
else
  echo "  WARN: generate-comparison.sh not found or not executable, skipping"
fi

echo ""
echo "=== setup-benchmarks complete ==="
