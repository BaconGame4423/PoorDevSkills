---
description: Intake user input and route to the appropriate flow: feature, bugfix, investigation, roadmap, discovery, Q&A, or documentation.
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
  - label: Problem Investigation
    agent: poor-dev.investigate
    prompt: Investigate this problem or unknown issue
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text after the command **is** the user's request. Do not ask them to repeat it unless empty.

### Flow Control Rule

This command is the pipeline orchestrator. After classification (Step 1-4):
- Pipeline flows (Feature, Bugfix, Roadmap, Discovery, Investigation) → proceed to **Step 5 Pipeline Orchestration**
- Non-pipeline flows (Q&A, Documentation) → execute target skill directly in Step 4
- Do NOT auto-transition to other agents via handoff frontmatter. Handoffs are UI metadata only.

### Step 1: Input Classification

Analyze `$ARGUMENTS` through a 3-stage process.

**1a. Intent Detection**: Classify by what the user wants to accomplish:
- **Feature**: user wants to add, create, or implement new functionality
- **Bugfix**: user reports an error, crash, broken behavior, or regression
- **Investigation**: user wants to investigate a problem, understand behavior, or find root cause without assuming it's a bug
- **Roadmap**: user wants to plan strategy, define vision, or explore concepts at project level
- **Discovery**: user wants to prototype, explore ideas, rebuild existing code, or "just try something"
- **Q&A**: user asks a question about the codebase or architecture
- **Documentation**: user requests a report, summary, or document generation

**Priority rule**: Feature / Bugfix / Investigation / Roadmap / Discovery signals take precedence over Q&A / Documentation. Example: "How do I implement X?" → Feature (not Q&A), because the intent is implementation.

**1b. Contextual Analysis** (when intent is ambiguous):
- Problem description ("X happens", "X doesn't work") → bugfix
- Investigation signal ("why does X happen", "investigate X", "something seems off") → investigation
- Desired state ("I want X", "add X") → feature
- Planning/strategy ("plan for X", "strategy") → roadmap
- Exploration ("try X", "prototype", "rebuild", "vibe coding") → discovery
- Question ("what is X", "how does X work") → Q&A
- Report request ("summarize X", "list all X") → documentation
- Improvement/change ("optimize X", "improve X") → ambiguous

**1c. Confidence**: High / Medium / Low

### Step 2: Clarify if Ambiguous

If confidence is Medium or below, ask user to choose:
1. "機能リクエスト（新機能・拡張）"
2. "バグ報告（既存機能の不具合・異常動作）"
3. "調査（原因不明の問題・挙動の理解）"
4. "ロードマップ・戦略策定（プロジェクト企画段階）"
5. "探索・プロトタイプ（まず作って学ぶ / 既存コードを整理して再構築）"
6. "質問・ドキュメント作成（パイプライン不要）"
7. "もう少し詳しく説明する"

If "もう少し詳しく" → re-classify. If option 6 → follow-up: ask/report.

**Non-pipeline shortcut**: Q&A / Documentation → skip Step 3, go to Step 4D/4E.
**Investigation shortcut**: → skip Step 3, go to Step 4G (no branch/directory creation needed).
**Discovery shortcut**: → skip Step 3, go to Step 4F (branch handled by `/poor-dev.discovery`).

### Step 3: Branch & Directory Creation (pipeline flows only)

1. Generate short name (2-4 words): action-noun for features, `fix-` prefix for bugs. Preserve technical terms.
2. Create feature branch:
   ```bash
   git fetch --all --prune
   ```
   Find highest number N across remote branches, local branches, specs directories. Use N+1.
   ```bash
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```

### Step 4: Routing

**4A Feature**: Report "Classified as feature: <summary>". → Step 5 Pipeline Orchestration に進む

**4B Bugfix**:
1. Check `bug-patterns.md` for similar past patterns. If found, inform user.
2. Create `$FEATURE_DIR/bug-report.md`:

   ```markdown
   # Bug Report: [BUG SHORT NAME]

   **Branch**: `[###-fix-bug-name]`
   **Created**: [DATE]
   **Status**: Investigating
   **Input**: "$ARGUMENTS"

   ## Description
   [summary]

   ## Expected Behavior
   [expected]

   ## Actual Behavior
   [actual, with error messages if available]

   ## Steps to Reproduce
   1. [Step 1]

   ## Frequency
   [always / intermittent / specific conditions]

   ## Environment
   - **OS**: [e.g., Ubuntu 22.04]
   - **Language/Runtime**: [e.g., Node.js 20.x]
   - **Key Dependencies**: [e.g., React 18.2]

   ## Since When
   [onset timing, relation to recent changes]

   ## Reproduction Results
   **Status**: [Not Attempted / Reproduced / Could Not Reproduce]
   ```

   Fill what can be extracted from `$ARGUMENTS`. Leave unknowns as placeholders.
3. Report "Classified as bugfix: <summary>". → Step 5 Pipeline Orchestration に進む

**4C Roadmap**: Report "Classified as roadmap: <summary>". → Step 5 Pipeline Orchestration に進む

**4D Q&A**: Report "Classified as Q&A: <summary>". Execute `/poor-dev.ask` directly (non-pipeline).

**4E Documentation**: Report "Classified as documentation: <summary>". Execute `/poor-dev.report` directly (non-pipeline).

**4F Discovery**: Report "Classified as discovery: <summary>". → Step 5 Pipeline Orchestration に進む
Discovery handles its own branch/directory creation.

**4G Investigation**: Report "Classified as investigation: <summary>". → Step 5 Pipeline Orchestration に進む
Investigation is a non-pipeline flow (read-only analysis). No branch/directory creation needed.

### Step 5: Pipeline Orchestration

After routing is complete, automatically orchestrate the full pipeline for the classified flow.
Non-pipeline flows (Q&A, Documentation) are handled directly in Step 4 and skip this step.

#### 5.0 Pre-flight Check

```
OPENCODE_AVAILABLE = (command -v opencode returns 0)
OPENCODE_LOG_DIR = ~/.local/share/opencode/log

# Polling config (from .poor-dev/config.json → polling)
POLL_INTERVAL = config.polling.interval || 1          (秒)
IDLE_TIMEOUT  = config.polling.idle_timeout || 120    (出力停滞でキル)
MAX_TIMEOUT   = config.polling.max_timeout || config.dispatch_timeout || 600  (絶対安全上限)
```

If `opencode` is not available:
- Display warning: "opencode が見つかりません。Claude Code (haiku) にフォールバックします"
- Set FALLBACK_MODE = true (all dispatches use Task() with model=haiku)

#### 5.0b CLI Capability Detection

利用可能なツール一覧を確認し INTERACTIVE_MODE を判定:
- AskUserQuestion ツールが利用可能 → INTERACTIVE_MODE = true
- AskUserQuestion ツールが利用不可 → INTERACTIVE_MODE = false

判定結果を表示: "INTERACTIVE_MODE: ${INTERACTIVE_MODE}"

#### 5.1 Pipeline Selection

Based on the classification from Step 1:

| Classification | Pipeline |
|---------------|----------|
| Feature | `specify → suggest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Bugfix | `bugfix → [CONDITIONAL]` |
| Bugfix (small) | `bugfix → planreview(fix-plan.md) → implement → qualityreview → phasereview` |
| Bugfix (large) | `bugfix → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Investigation | `investigate` (single step, read-only) |
| Roadmap | `concept → goals → milestones → roadmap` |
| Discovery-init | `discovery` (single step) |
| Discovery-rebuild | `rebuildcheck → [CONDITIONAL]` |
| Discovery-rebuild (REBUILD) | `rebuildcheck → harvest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Discovery-rebuild (CONTINUE) | `rebuildcheck` (pipeline pauses) |

For single-step pipelines (investigation, discovery-init): dispatch that step and return. No pipeline-state tracking needed.
For conditional pipelines (bugfix, discovery-rebuild): dispatch the first step, then use Section C to resolve the variant and determine the continuation pipeline.

#### 5.2 Resume Detection

Check for `$FEATURE_DIR/pipeline-state.json`:

```json
{
  "flow": "feature",
  "variant": null,
  "completed": ["specify", "plan", "planreview"],
  "current": "tasks",
  "status": "active",
  "pauseReason": null,
  "condition": null,
  "pendingApproval": null,
  "updated": "2026-02-12T10:30:00Z"
}
```

**Schema notes**:
- `status`: `"active"` | `"paused"` | `"rate-limited"` | `"error"` | `"stopped"` | `"awaiting-approval"`
- `pendingApproval`: `null` | `{ "type": "spec-approval|gate|review-nogo|resume-paused", "step": "<step-name>" }`

**Backward compatibility**: Existing pipeline-state.json without `variant`/`condition`/`status`/`pendingApproval` fields → treat as linear pipeline with `status: "active"`, `variant: null`, `pendingApproval: null`.

If found:

**Case 1: `status: "active"` (or absent)**:
- INTERACTIVE_MODE = true → AskUserQuestion:
  - "前回は `${current}` ステップで中断しています。再開しますか？"
    - "再開する（${current} から）" — skip completed steps
    - "最初からやり直す" — delete pipeline-state.json, start fresh
- INTERACTIVE_MODE = false → 自動再開（再実行 = 続行意思）。skip completed steps.

**Case 2: `status: "paused"`** (discovery-rebuild CONTINUE):
- INTERACTIVE_MODE = true → AskUserQuestion:
  - "前回のリビルド判定で CONTINUE（継続開発）となり、パイプラインが一時停止中です。"
    - "リビルド判定を再実行する" — reset to rebuildcheck step, set status to "active"
    - "harvest にスキップする（プロトタイプ完了とみなす）" — set completed to ["rebuildcheck"], current to "harvest", variant to "discovery-rebuild", status to "active"
    - "探索を続行する（パイプライン終了）" — delete pipeline-state.json, exit
- INTERACTIVE_MODE = false → PAUSE_FOR_APPROVAL("resume-paused", current, status summary)

**Case 3: `status: "rate-limited"`**:
- INTERACTIVE_MODE = true → AskUserQuestion:
  - "前回は `${current}` ステップでレートリミットにより中断しました（${pauseReason}）。"
    - "再開する（${current} から）" — set status to "active", resume from current
    - "止める" — delete pipeline-state.json, exit
- INTERACTIVE_MODE = false → 自動再開（再試行）。set status to "active", resume from current.

**Case 4: `status: "awaiting-approval"`**:
- pendingApproval.type を読み取り
- INTERACTIVE_MODE = true の場合:
  - type に応じた AskUserQuestion を表示:
    - spec-approval → "承認する / 修正指示付きで棄却 / 棄却する"
    - gate → "進む / 修正する / 止める"
    - review-nogo → "修正して再レビュー / 止める"
    - resume-paused → Case 2 と同じ選択肢
  - 回答に基づきパイプライン再開・修正・停止
  - pendingApproval を null にクリア、status を "active" に更新
- INTERACTIVE_MODE = false の場合:
  - 再実行 = 暗黙の承認として扱う
  - spec-approval → spec-draft.md を spec.md にコピーしてパイプライン続行
  - gate → 自動続行
  - review-nogo → 自動再レビュー
  - resume-paused → 自動再開
  - pendingApproval を null にクリア、status を "active" に更新
  - 表示: "前回の承認待ちを自動承認しました（${type}）。パイプラインを続行します。"

If not found → start from beginning.

#### 5.3 Step Dispatch Loop

For each STEP in PIPELINE (skipping already-completed steps if resuming):

- If STEP == "specify": → Section A2 (Specify Step Read-Only Override) を実行
- If STEP == "plan": Check `${FEATURE_DIR}/suggestions.yaml` exists (verify suggest phase completed). If missing, warn but continue (suggestions are optional).
- Otherwise: → Section A (通常 Production Steps) / B / C を実行

##### A. Production Steps (plan, tasks, implement, harvest, bugfix)

1. **Read command**: Read `commands/poor-dev.${STEP}.md`
2. **Strip sections**:
   a. **Frontmatter removal**: ファイル先頭の YAML frontmatter ブロック（最初の `---` から次の `---` まで）を完全に除去する。
      部分的な除去は禁止（handoffs, description 等を個別に削除するのではなく、frontmatter 全体を除去）。
   b. **Section removal**: "Gate Check" セクション、"Dashboard Update" セクションを除去。
   c. **Validation**: 組み立て済みプロンプトに `handoffs:` または `send:` 文字列が残っていないことを確認。残っている場合はエラー停止。
3. **Prepend**: NON_INTERACTIVE_HEADER (see 5.4)
4. **Append context block**:
   ```
   ## Pipeline Context
   - FEATURE_DIR: ${FEATURE_DIR}
   - BRANCH: ${BRANCH}
   - Feature description: ${ARGUMENTS}
   - target_file: ${TARGET_FILE}
   - Previous step output: (3-line summary of previous step result)
   ```
   **target_file resolution** (variant-based):
   | Variant | planreview target_file |
   |---------|----------------------|
   | (default) | plan.md |
   | bugfix-small | fix-plan.md |
5. **Resolve model**: Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {}, "polling": { "interval": 1, "idle_timeout": 120, "max_timeout": 600 } }`. Check `overrides.${STEP}` → `default`. Extract cli + model.
6. **Dispatch** (シェルスクリプトベースポーリング):

   **起動**: プロンプトは /tmp/poor-dev-step.txt に書き出し済み。
   dispatch コマンドを /tmp/poor-dev-cmd.sh に Write ツールで書き出す（変数は展開済みの値を埋め込む）:
   - If OPENCODE_AVAILABLE and resolved cli == "opencode":
     ```
     opencode run --model <RESOLVED_MODEL> --format json "$(cat /tmp/poor-dev-step.txt)"
     ```
   - If OPENCODE_AVAILABLE and resolved cli == "claude":
     ```
     cat /tmp/poor-dev-step.txt | claude -p --model <RESOLVED_MODEL> --no-session-persistence --output-format text
     ```
   - If FALLBACK_MODE:
     ```
     Task(subagent_type="general-purpose", model="haiku", prompt=<assembled prompt>)
     ```
     (FALLBACK_MODE はタイムアウト不要 — Task() は内部で管理。ポーリングループをスキップ)

   **実行** (FALLBACK_MODE 以外):
   ```
   OUTPUT_FILE = /tmp/poor-dev-output-${STEP}.txt
   PROGRESS_FILE = /tmp/poor-dev-progress-${STEP}.txt
   POLL_COPY = /tmp/poor-dev-poll-$$.sh

   cp lib/poll-dispatch.sh "$POLL_COPY"

   Bash(run_in_background: true):
     "$POLL_COPY" /tmp/poor-dev-cmd.sh ${OUTPUT_FILE} ${PROGRESS_FILE} ${IDLE_TIMEOUT} ${MAX_TIMEOUT}
   → task_id を取得
   ```

   **軽量ポーリング** (進捗リレー付き):
   ```
   DISPLAYED = 0

   while true:
     TaskOutput(task_id, block=false, timeout=5000)
       → completed/failed → break

     Read(PROGRESS_FILE)
       → DISPLAYED 以降の新規マーカーのみユーザーにリレー表示
       → DISPLAYED を更新
   ```
   ※ TaskOutput の timeout=5000 が実質的な sleep 代替（5秒間ブロック）
   ※ progress_file は数行のマーカーのみ。1サイクルあたり: ~20B (status) + ~数行 (マーカー)

   **完了時**: TaskOutput → JSON サマリー (~200B) を取得

   **設計意図**:
   - ポーリングループ・タイムアウト監視・マーカー抽出は全て lib/poll-dispatch.sh 内で実行
   - オーケストレーターのコンテキストには軽量な進捗マーカーと最終JSONサマリーのみが入る
   - output_file 全文はオーケストレーターのコンテキストに入らない（ディスク上に保持）

6b. **Rate limit detection** (JSON サマリーの exit_code != 0 の場合のみ。正常完了時はスキップ):

   ⚠ **絶対禁止**: プロセス実行中に opencode ログを手動チェックして
   レートリミットを判断してはならない。opencode は内部で指数バックオフ
   リトライを行う。ログの "Usage limit" エラーはリトライ中の一時的な
   記録であり、最終的な失敗を意味しない。
   Rate limit detection はプロセスが completed/failed になった後のみ実行する。

   (1) ログからレートリミットを検出:
       ```bash
       LATEST_LOG=$(ls -t ${OPENCODE_LOG_DIR}/*.log 2>/dev/null | head -1)
       RATE_LIMIT_COUNT=$(grep -c "Rate limit" "$LATEST_LOG" 2>/dev/null || echo 0)
       ```

   (2) 判定フロー:

       ```
       dispatch 失敗
            │
            ├─ RATE_LIMIT_COUNT == 0
            │   → 通常エラー。step 7 に進む（[ERROR: dispatch failed]）
            │
            └─ RATE_LIMIT_COUNT > 0 (レートリミット確認)
                 │
                 ├─ FALLBACK_MODEL が存在 かつ RESOLVED_MODEL != FALLBACK_MODEL
                 │   → Report: "⚠ レートリミット検出 (${RESOLVED_MODEL})。${FALLBACK_MODEL} で再試行します。"
                 │   → RESOLVED_MODEL = FALLBACK_MODEL
                 │   → step 6 を再実行（同じポーリングループ付き）
                 │   → 再実行結果:
                 │        ├─ 正常完了 → step 7 に進む
                 │        ├─ Rate limit 再検出 → パイプライン中断 (下記)
                 │        └─ Rate limit なし → 通常エラー。step 7 に進む
                 │
                 └─ FALLBACK_MODEL なし、または fallback でもレートリミット
                      → pipeline-state.json 更新:
                        status: "rate-limited"
                        pauseReason: "Rate limit: ${RESOLVED_MODEL}"
                      → Report: "⏸ レートリミット検出: パイプラインを中断しました。`/poor-dev` で再開できます。"
                      → Exit pipeline
       ```

   NOTE: opencode が内部リトライで成功した場合は介入不要。
7. **Output parsing** (JSON サマリーベース):
   - JSON.clarifications が非空:
     - INTERACTIVE_MODE = true → AskUserQuestion でリレー → 回答追加して再 dispatch
     - INTERACTIVE_MODE = false → マーカーを保持して自動続行
   - JSON.errors が非空 → stop pipeline, report error
   - JSON.timeout_type != "none" → タイムアウト報告
   - Verify expected output files exist (spec.md, plan.md, tasks.md etc.) via Glob
7b. **Artifact display** (特定ステップ完了後のみ):

   | STEP | 表示内容 |
   |------|---------|
   | plan | plan.md の Summary + Technical Context セクションを日本語で要約表示。詳細は plan.md 参照の旨を付記。 |
   | specify | (A2 Step 11 で仕様サマリーを既に表示するため不要) |

   表示後の動作は既存の Gate Check (Step 8) に委譲。
   plan 表示のために独自の確認ポイントは追加しない（既存の gates.after-plan で制御可能）。
8. **Gate check**: Read `.poor-dev/config.json` gates. If `gates.after-${STEP}` is true:
   - INTERACTIVE_MODE = true → AskUserQuestion: "進む / 修正する / 止める"
     - "修正する" → user can manually run `/poor-dev.${STEP}`, then re-run `/poor-dev` to resume
     - "止める" → save pipeline-state.json, exit
   - INTERACTIVE_MODE = false:
     - ゲート有効時 → PAUSE_FOR_APPROVAL("gate", STEP, step summary)
     - ゲート無効時 → 自動続行
9. **Update pipeline-state.json**: Add STEP to `completed`, set `current` to next step
10. **Progress report**: "Step N/M: ${STEP} complete"

**implement special handling**: Dispatch implement per-phase (see D6):
- Parse tasks.md for phase headers (`## Phase N:`)
- For each phase: dispatch implement with `--phase N` context
- Each phase runs with `run_in_background: true`
- Poll tasks.md for `[X]` markers to track progress
- Report per-phase completion

##### A2. Specify Step (Read-Only Override)

specify は他の Production Steps と異なり、読み取り専用で実行し、orchestrator が承認フロー後にファイルを作成する。

1. **Read command**: Section A Step 1 と同じ
2. **Strip sections**: Section A Step 2 と同じ
3. **Prepend**: NON_INTERACTIVE_HEADER + READONLY_HEADER (see 5.4b)
4. **Append context block**: Section A Step 4 と同じ
5. **Resolve model**: Section A Step 5 と同じ
6. **Dispatch** (読み取り専用 + アイドルベース適応ポーリング):
   Section A step 6 と同じポーリング方式（進捗マーカー抽出 (2b) を含む）で dispatch。CLI ごとの差異:
   - opencode: `opencode run --model ${RESOLVED_MODEL} --format json "$(cat /tmp/poor-dev-step.txt)"`
   - claude: `cat /tmp/poor-dev-step.txt | claude -p --model ${RESOLVED_MODEL} --no-session-persistence --output-format text --disallowedTools "Edit,Write,Bash,NotebookEdit"`
   - FALLBACK_MODE: `Task(subagent_type="Explore", model="haiku", prompt=<assembled prompt>)` (ポーリングループなし)

   Note: `--disallowedTools` は `claude` CLI 時のみ適用。opencode 使用時は READONLY_HEADER のプロンプト制約で読み取り専用を担保。
7. **Output parse**:
   a. 1行目から `[BRANCH: ...]` マーカーを抽出 → SUGGESTED_BRANCH
   b. 残り全体をドラフト本文として保持
   c. `[ERROR: ...]` → stop pipeline, report error
8. **Branch + FEATURE_DIR**:
   - 既にフィーチャーブランチ上 → FEATURE_DIR は既知、スキップ
   - main 上 → SUGGESTED_BRANCH でブランチ作成 + `mkdir -p FEATURE_DIR`
9. **Write draft**: FEATURE_DIR/spec-draft.md にドラフト本文を書き出し
10. **[NEEDS CLARIFICATION] 解決**:
    - spec-draft.md 内の `[NEEDS CLARIFICATION: ...]` マーカーを全て抽出
    - INTERACTIVE_MODE = true → 各マーカーについて AskUserQuestion（オプション表形式で質問を中継）→ 回答で spec-draft.md 内の該当マーカーを置換
    - INTERACTIVE_MODE = false → マーカーを残す（仕様承認の一時停止中にユーザーが確認・手動解決）
11. **ユーザー承認**:
    - spec-draft.md の内容を以下の日本語整形フォーマットでユーザーに表示する（原文ファイルはそのまま保持）:

      ```
      ## 仕様ドラフト: [機能名の日本語訳]

      ### ユーザーストーリー
      - **P1**: [ストーリータイトルの日本語要約（1行）]
      - **P1**: [同上]
      - **P2**: [同上]
      ...

      ### 機能要件
      - FR-001: [要件の日本語訳（1行）]
      - FR-002: [同上]
      ...

      ### エッジケース
      - [エッジケースの日本語要約（1行）]
      ...

      ### 成功基準
      - SC-001: [基準の日本語訳（1行）]
      ...
      ```

    - 各項目は spec-draft.md から抽出し、orchestrator が日本語に翻訳・要約する
    - 詳細が必要な場合はユーザーが spec-draft.md を直接参照できる旨を注記する
    - INTERACTIVE_MODE = true → AskUserQuestion:
      - "承認する" → `cp spec-draft.md spec.md && rm spec-draft.md`、パイプライン続行
      - "修正指示付きで棄却" → ユーザーの自由記述を spec-draft.md 末尾に `## Feedback` として追記 → パイプライン停止
      - "棄却する" → パイプライン停止（spec-draft.md はそのまま保存）
      - 停止時: pipeline-state.json に `status: "stopped"`, `pauseReason: "spec rejected"` を記録
    - INTERACTIVE_MODE = false → 仕様サマリーを表示 → PAUSE_FOR_APPROVAL("spec-approval", "specify", summary)
12. **Validation**: 承認後、spec.md に対して checklists/requirements.md を生成（orchestrator がインラインで実行）
13. **Gate check + pipeline-state.json update**: Section A Step 8-9 と同じ

##### B. Review Steps (planreview, tasksreview, architecturereview, qualityreview, phasereview)

Reviews are dispatched as **black-box orchestrators**. The review command internally handles:
persona spawn → aggregation → fixer → loop until convergence.

ブラックボックス dispatch + シェルスクリプトベースポーリング + JSON サマリーによる verdict 抽出。

1. **Read command**: Read `commands/poor-dev.${STEP}.md`
2. **Strip sections**:
   a. **Frontmatter removal**: ファイル先頭の YAML frontmatter ブロック（最初の `---` から次の `---` まで）を完全に除去する。
      部分的な除去は禁止（handoffs, description 等を個別に削除するのではなく、frontmatter 全体を除去）。
   b. **Validation**: 組み立て済みプロンプトに `handoffs:` または `send:` 文字列が残っていないことを確認。残っている場合はエラー停止。
3. **Prepend**: NON_INTERACTIVE_HEADER
4. **Append context block**: FEATURE_DIR, BRANCH, target_file (resolved by variant — see Section A step 4 table; e.g., plan.md for planreview, fix-plan.md for bugfix-small planreview)
5. **Resolve model**: Same config resolution as production steps, using CATEGORY=`${STEP}`
6. **Dispatch**: Section A step 6 と同じシェルスクリプトベースポーリング。
   進捗マーカー（`[REVIEW-PROGRESS: ...]`）は poll-dispatch.sh が自動抽出し progress_file に書き出す。
   オーケストレーターは progress_file を Read して新規マーカーのみリレー表示する。

6b. **Rate limit detection**: Section A step 6b と同じフローを適用。JSON サマリーの exit_code != 0 の場合のみ検出・フォールバック・パイプライン中断を行う。
7. **Verdict extraction**: JSON サマリーの verdict フィールドを確認:
   - "GO" → proceed to next step
   - "CONDITIONAL":
     - INTERACTIVE_MODE = true → AskUserQuestion: "レビュー結果は CONDITIONAL です。進めますか？ / 修正しますか？"
     - INTERACTIVE_MODE = false → 警告表示のみで自動続行
   - "NO-GO":
     - INTERACTIVE_MODE = true → AskUserQuestion: "レビューが NO-GO を返しました。修正して再レビューしますか？ / 止めますか？"
     - INTERACTIVE_MODE = false → レビュー結果表示 → PAUSE_FOR_APPROVAL("review-nogo", STEP, verdict)
   - null → stop pipeline, report error
8. **Gate check + pipeline-state.json update**: Same as production steps

##### C. Conditional Steps (bugfix, rebuildcheck)

Steps that produce a marker determining the continuation pipeline. Dispatched via Section A, but with additional post-processing.

1. **Dispatch**: Same as Section A (read command, strip, prepend, append context, resolve model, dispatch with adaptive polling)
1b. **Rate limit detection**: Section A step 6b と同じフローを適用。dispatch 失敗時のレートリミット検出・フォールバック・パイプライン中断を行う。
2. **Marker extraction**: Search output for structured markers:
   - `[SCALE: SMALL]`, `[SCALE: LARGE]` (from bugfix)
   - `[VERDICT: CONTINUE]`, `[VERDICT: REBUILD]` (from rebuildcheck)
   - `[RECLASSIFY: FEATURE]` (from bugfix)
3. **Variant resolution table**:

   | Step | Marker | Variant | Continuation Pipeline |
   |------|--------|---------|----------------------|
   | bugfix | `[SCALE: SMALL]` | bugfix-small | `planreview(fix-plan.md) → implement → qualityreview → phasereview` |
   | bugfix | `[SCALE: LARGE]` | bugfix-large | `plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
   | bugfix | `[RECLASSIFY: FEATURE]` | — | Pipeline stops. Route to `/poor-dev.specify` |
   | rebuildcheck | `[VERDICT: REBUILD]` | discovery-rebuild | `harvest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
   | rebuildcheck | `[VERDICT: CONTINUE]` | discovery-continue | Pipeline pauses (graceful) |

4. **Update pipeline-state.json**: Record `variant`, `condition` (step + marker + resolved variant):
   ```json
   {
     "condition": {
       "step": "bugfix",
       "marker": "[SCALE: SMALL]",
       "resolved": "bugfix-small"
     }
   }
   ```
5. **Branch processing**:
   - **Continuation pipeline exists** → Replace remaining pipeline steps with the variant's continuation pipeline. Resume dispatch loop from the next step.
   - **discovery-continue** → Set `status: "paused"`, `pauseReason: "rebuildcheck CONTINUE"` in pipeline-state.json. Report "パイプラインを一時停止しました（リビルド判定: CONTINUE）。プロトタイプ開発を続行してください。再度 `/poor-dev` を実行すると再判定できます。" Exit pipeline.
   - **Marker not found** → Set `status: "error"` in pipeline-state.json. Report error and stop pipeline.
6. **Reclassification escape** (bugfix only): `[RECLASSIFY: FEATURE]` → Stop pipeline, delete pipeline-state.json, report "バグ修正から機能リクエストに再分類されました。" Route to `/poor-dev.specify`.

#### 5.4 NON_INTERACTIVE_HEADER

Prepended to all dispatched command prompts:

```markdown
## Execution Mode: Non-Interactive

You are running as a sub-agent in a pipeline. Follow these rules:
- Do NOT use AskUserQuestion. Include questions as [NEEDS CLARIFICATION: question] markers.
- Do NOT execute Gate Check or Dashboard Update sections.
- Do NOT suggest handoff commands.
- Do NOT use EnterPlanMode or ExitPlanMode.
- Focus on producing the required output artifacts (files).
- If blocked, output [ERROR: description] and stop.
- Exception: You MUST output progress markers during execution:
  - Review steps: `[REVIEW-PROGRESS: ...]` markers between iterations
  - Production steps: `[PROGRESS: step-name phase/status description]` markers at key milestones
- End with: files created/modified, any unresolved items.
```

#### 5.4b READONLY_HEADER

specify ステップにのみ追加で prepend されるヘッダー:

```markdown
## Read-Only Execution Mode

You have READ-ONLY tool access (Edit, Write, Bash, NotebookEdit are disabled).
- Output the spec draft as plain markdown text in your response.
- First line MUST be: `[BRANCH: suggested-short-name]`
- The rest of your output is the spec draft content (using the Spec Template).
- Include `[NEEDS CLARIFICATION: question]` markers inline as needed (max 3).
- Do NOT attempt to create branches, directories, or files.
```

#### 5.4c PAUSE_FOR_APPROVAL(type, step, display_content)

INTERACTIVE_MODE = false の場合に、確認が必要な箇所でパイプラインを一時停止するメカニズム。

1. **成果物の表示**: display_content をユーザーに出力（仕様サマリー、プラン概要、レビュー結果等）
2. **pipeline-state.json 更新**:
   ```json
   {
     "status": "awaiting-approval",
     "pauseReason": "${type} at ${step}",
     "pendingApproval": { "type": "${type}", "step": "${step}" }
   }
   ```
3. **ユーザーへのメッセージ**:
   "⏸ 承認待ちで一時停止しました（${type}）。"
   "成果物を確認後、`/poor-dev` を再実行すると承認して続行します。"
   "パイプラインを中止するには pipeline-state.json を削除してください。"
4. **パイプライン終了**

**設計意図**: 再実行 = 暗黙の承認。ユーザーが成果物を確認し、問題なければ再実行する。問題があれば成果物を手動編集してから再実行するか、パイプラインを破棄する。

#### 5.5 Error Recovery

- **Step failure**: Pipeline stops immediately. All previously-produced artifacts are preserved in FEATURE_DIR.
- **Resume**: Re-run `/poor-dev` → pipeline-state.json detected → resume from failed step.
- **Manual override**: User can always run individual commands (`/poor-dev.plan`, `/poor-dev.specify`, etc.) directly, then re-run `/poor-dev` to resume the pipeline.
- **Clarify skip**: clarify is intentionally excluded from the pipeline. specify already includes up to 3 clarification questions (Step 5 in specify). If more clarification is needed, user stops at the after-specify gate and runs `/poor-dev.clarify` manually.
- **Conditional pause** (discovery-rebuild CONTINUE): Not an error. Pipeline is saved with `status: "paused"`. Re-running `/poor-dev` triggers Step 5.2 Case 2 resume options.
- **Variant preservation**: Once a conditional step resolves a variant (e.g., bugfix-small), the variant is saved in pipeline-state.json. On resume, the resolved variant's continuation pipeline is used — the conditional step is NOT re-executed.
- **Spec rejection**: specify の承認フローで棄却された場合、spec-draft.md が FEATURE_DIR に残る。
  ユーザーが手動で `/poor-dev.specify` を実行して spec.md を作成後、`/poor-dev` で resume 可能。
  resume 時は specify を completed として扱い、plan ステップから再開する。
- **Rate limit**: dispatch 失敗時に opencode ログで "Rate limit" が確認された場合、
  fallback_model が設定されていれば自動的にフォールバックモデルで再試行する。
  フォールバックでもレートリミットの場合は `status: "rate-limited"` でパイプラインを中断。
  再度 `/poor-dev` を実行すると中断ステップから再開可能。
  opencode のログディレクトリ: `~/.local/share/opencode/log/`
- **Idle timeout**: ポーリングで IDLE_TIMEOUT 秒間出力が増加しなかった場合、プロセスをキルしてタイムアウト扱い。
  pipeline-state.json に `status: "error"`, `pauseReason: "idle timeout at ${STEP}"` を記録。

### Dashboard Update

Update living documents in `docs/`:

1. `mkdir -p docs`
2. Scan all `specs/*/` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → Planning → Tasks → Implementation → Review → Complete
4. Write `docs/progress.md`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)

### CLI Compatibility Guide

#### ツール可用性マトリクス

| ツール | Claude Code | OpenCode | 備考 |
|--------|:-----------:|:--------:|------|
| AskUserQuestion | ✅ | ❌ | 対話的確認。INTERACTIVE_MODE で分岐 |
| EnterPlanMode / ExitPlanMode | ✅ | ❌ | NON_INTERACTIVE_HEADER で既に禁止 |
| Task() | ✅ | ❌ | FALLBACK_MODE で代替 |
| Bash (background) | ✅ | ✅ | poll-dispatch.sh で統一 |
| Read / Write / Edit / Glob / Grep | ✅ | ✅ | |

#### 新規 AskUserQuestion 追加時の規約

AskUserQuestion を使用する全ての箇所で以下パターンを適用すること:

```
if INTERACTIVE_MODE:
  AskUserQuestion: [質問と選択肢]
  [回答に基づく分岐]
else:
  [成果物・状況を表示]
  PAUSE_FOR_APPROVAL(type, step, display_content)  ← 確認必須の場合
  または
  [自動続行 + 警告表示]                              ← 自動で安全な場合
```

#### Handoff 規約

- orchestrator (poor-dev.md) の handoff は `send: true` を使用しない
- サブコマンドの handoff `send: true` は個別実行時の利便性のために維持可能
- パイプラインで dispatch する際は frontmatter 全体を除去 + validation で担保
