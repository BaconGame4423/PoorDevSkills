---
description: Intake user input and route to the appropriate flow: feature, bugfix, roadmap, discovery, Q&A, or documentation.
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
    send: true
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
    send: true
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
    send: true
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
    send: true
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
    send: true
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text after the command **is** the user's request. Do not ask them to repeat it unless empty.

### Step 1: Input Classification

Analyze `$ARGUMENTS` through a 3-stage process.

**1a. Intent Detection**: Classify by what the user wants to accomplish:
- **Feature**: user wants to add, create, or implement new functionality
- **Bugfix**: user reports an error, crash, broken behavior, or regression
- **Roadmap**: user wants to plan strategy, define vision, or explore concepts at project level
- **Discovery**: user wants to prototype, explore ideas, rebuild existing code, or "just try something"
- **Q&A**: user asks a question about the codebase or architecture
- **Documentation**: user requests a report, summary, or document generation

**Priority rule**: Feature / Bugfix / Roadmap / Discovery signals take precedence over Q&A / Documentation. Example: "How do I implement X?" → Feature (not Q&A), because the intent is implementation.

**1b. Contextual Analysis** (when intent is ambiguous):
- Problem description ("X happens", "X doesn't work") → bugfix
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
3. "ロードマップ・戦略策定（プロジェクト企画段階）"
4. "探索・プロトタイプ（まず作って学ぶ / 既存コードを整理して再構築）"
5. "質問・ドキュメント作成（パイプライン不要）"
6. "もう少し詳しく説明する"

If "もう少し詳しく" → re-classify. If option 5 → follow-up: ask/report.

**Non-pipeline shortcut**: Q&A / Documentation → skip Step 3, go to Step 4D/4E.
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

**4A Feature**: Report "Classified as feature: <summary>". Next: `/poor-dev.specify`

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
3. Report "Classified as bugfix: <summary>". Next: `/poor-dev.bugfix`

**4C Roadmap**: Report "Classified as roadmap: <summary>". Next: `/poor-dev.concept`

**4D Q&A**: Report "Classified as Q&A: <summary>". Next: `/poor-dev.ask`

**4E Documentation**: Report "Classified as documentation: <summary>". Next: `/poor-dev.report`

**4F Discovery**: Report "Classified as discovery: <summary>". Next: `/poor-dev.discovery`
Discovery handles its own branch/directory creation.

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

#### 5.1 Pipeline Selection

Based on the classification from Step 1:

| Classification | Pipeline |
|---------------|----------|
| Feature | `specify → suggest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Bugfix | `bugfix → [CONDITIONAL]` |
| Bugfix (small) | `bugfix → planreview(fix-plan.md) → implement → qualityreview → phasereview` |
| Bugfix (large) | `bugfix → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Roadmap | `concept → goals → milestones → roadmap` |
| Discovery-init | `discovery` (single step) |
| Discovery-rebuild | `rebuildcheck → [CONDITIONAL]` |
| Discovery-rebuild (REBUILD) | `rebuildcheck → harvest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Discovery-rebuild (CONTINUE) | `rebuildcheck` (pipeline pauses) |

For single-step pipelines (discovery-init): dispatch that step and return. No pipeline-state tracking needed.
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
  "updated": "2026-02-12T10:30:00Z"
}
```

**Backward compatibility**: Existing pipeline-state.json without `variant`/`condition`/`status` fields → treat as linear pipeline with `status: "active"`, `variant: null`.

If found:

**Case 1: `status: "active"` (or absent)** → AskUserQuestion:
- "前回は `${current}` ステップで中断しています。再開しますか？"
  - "再開する（${current} から）" — skip completed steps
  - "最初からやり直す" — delete pipeline-state.json, start fresh

**Case 2: `status: "paused"`** (discovery-rebuild CONTINUE) → AskUserQuestion:
- "前回のリビルド判定で CONTINUE（継続開発）となり、パイプラインが一時停止中です。"
  - "リビルド判定を再実行する" — reset to rebuildcheck step, set status to "active"
  - "harvest にスキップする（プロトタイプ完了とみなす）" — set completed to ["rebuildcheck"], current to "harvest", variant to "discovery-rebuild", status to "active"
  - "探索を続行する（パイプライン終了）" — delete pipeline-state.json, exit

**Case 3: `status: "rate-limited"`** → AskUserQuestion:
- "前回は `${current}` ステップでレートリミットにより中断しました（${pauseReason}）。"
  - "再開する（${current} から）" — set status to "active", resume from current
  - "止める" — delete pipeline-state.json, exit

If not found → start from beginning.

#### 5.3 Step Dispatch Loop

For each STEP in PIPELINE (skipping already-completed steps if resuming):

- If STEP == "specify": → Section A2 (Specify Step Read-Only Override) を実行
- If STEP == "plan": Check `${FEATURE_DIR}/suggestions.yaml` exists (verify suggest phase completed). If missing, warn but continue (suggestions are optional).
- Otherwise: → Section A (通常 Production Steps) / B / C を実行

##### A. Production Steps (plan, tasks, implement, harvest, bugfix)

1. **Read command**: Read `commands/poor-dev.${STEP}.md`
2. **Strip sections**: Remove `handoffs` frontmatter, "Gate Check" section, "Dashboard Update" section
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
6. **Dispatch** (アイドルベース適応ポーリング):

   **起動**: Bash(run_in_background: true) で dispatch。プロンプトは /tmp/poor-dev-step.txt に書き出し済み。
   - If OPENCODE_AVAILABLE and resolved cli == "opencode":
     ```bash
     opencode run --model ${RESOLVED_MODEL} --format json "$(cat /tmp/poor-dev-step.txt)"
     ```
   - If OPENCODE_AVAILABLE and resolved cli == "claude":
     ```bash
     cat /tmp/poor-dev-step.txt | claude -p --model ${RESOLVED_MODEL} --no-session-persistence --output-format text
     ```
   - If FALLBACK_MODE:
     ```
     Task(subagent_type="general-purpose", model="haiku", prompt=<assembled prompt>)
     ```
     (FALLBACK_MODE はタイムアウト不要 — Task() は内部で管理。ポーリングループをスキップ)

   → task_id と output_file パスを取得

   **ポーリングループ** (FALLBACK_MODE 以外):
   ```
   ELAPSED = 0, IDLE = 0, LAST_SIZE = 0, DISPLAYED_PROGRESS = 0
   OUTPUT_STARTED = false

   while true:
     (1) TaskOutput(task_id, block=false, timeout=1000)
         → status が completed/failed → ループ終了

     (2) Read(output_file) で現在の出力サイズを確認
         → CURRENT_SIZE > LAST_SIZE の場合:
            OUTPUT_STARTED = true
            IDLE = 0 (リセット — 出力が増加中)
            LAST_SIZE = CURRENT_SIZE

            (2b) 進捗マーカー抽出:
              - output_file から `[PROGRESS: ...]` パターンを検索
              - opencode --format json の場合: NDJSON の各行から
                result/text フィールドを抽出して検索
              - 全マーカーを抽出し、DISPLAYED_PROGRESS 以降の
                新規マーカーのみユーザーにリレー表示
              - DISPLAYED_PROGRESS を更新して二重表示を防止

         → CURRENT_SIZE == LAST_SIZE の場合:
            IDLE += POLL_INTERVAL

     (3) IF OUTPUT_STARTED AND IDLE >= IDLE_TIMEOUT → TaskStop(task_id)、タイムアウト扱い
         # 出力が一度も始まっていない場合は IDLE_TIMEOUT を適用しない
         # MAX_TIMEOUT のみが安全停止の上限として機能する
     (4) ELAPSED >= MAX_TIMEOUT → TaskStop(task_id)、安全停止
     (5) ELAPSED += POLL_INTERVAL、次のサイクルへ
   ```

   **結果**: プロセス完了時の output_file 全文を取得 → step 7 (Output parsing) へ

   **設計意図**:
   - 出力が増え続ける限り無期限に待機（MAX_TIMEOUT まで）
   - 出力が止まって IDLE_TIMEOUT 秒経過 → プロセスがハングと判断
   - タイムアウト値の事前予想が不要

6b. **Rate limit detection** (dispatch が失敗した場合のみ。正常完了時はスキップ):

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
7. **Output parsing**:
   - `[NEEDS CLARIFICATION: ...]` → AskUserQuestion to relay question → re-dispatch with answer appended
   - `[ERROR: ...]` → stop pipeline, report error
   - Verify expected output files exist (spec.md, plan.md, tasks.md etc.)
8. **Gate check**: Read `.poor-dev/config.json` gates. If `gates.after-${STEP}` is true:
   - AskUserQuestion: "進む / 修正する / 止める"
   - "修正する" → user can manually run `/poor-dev.${STEP}`, then re-run `/poor-dev` to resume
   - "止める" → save pipeline-state.json, exit
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
    - 各マーカーについて AskUserQuestion（オプション表形式で質問を中継）
    - 回答で spec-draft.md 内の該当マーカーを置換
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
    - AskUserQuestion:
      - "承認する" → `cp spec-draft.md spec.md && rm spec-draft.md`、パイプライン続行
      - "修正指示付きで棄却" → ユーザーの自由記述を spec-draft.md 末尾に `## Feedback` として追記 → パイプライン停止
      - "棄却する" → パイプライン停止（spec-draft.md はそのまま保存）
    - 停止時: pipeline-state.json に `status: "stopped"`, `pauseReason: "spec rejected"` を記録
12. **Validation**: 承認後、spec.md に対して checklists/requirements.md を生成（orchestrator がインラインで実行）
13. **Gate check + pipeline-state.json update**: Section A Step 8-9 と同じ

##### B. Review Steps (planreview, tasksreview, architecturereview, qualityreview, phasereview)

Reviews are dispatched as **black-box orchestrators**. The review command internally handles:
persona spawn → aggregation → fixer → loop until convergence.

ブラックボックス dispatch + アイドルベース適応ポーリング + 進捗マーカー抽出。

1. **Read command**: Read `commands/poor-dev.${STEP}.md`
2. **Strip**: `handoffs` frontmatter only (review commands manage their own flow)
3. **Prepend**: NON_INTERACTIVE_HEADER
4. **Append context block**: FEATURE_DIR, BRANCH, target_file (resolved by variant — see Section A step 4 table; e.g., plan.md for planreview, fix-plan.md for bugfix-small planreview)
5. **Resolve model**: Same config resolution as production steps, using CATEGORY=`${STEP}`
6. **Dispatch**: Section A step 6 と同じアイドルベース適応ポーリング。
   ただしレビュー用の追加処理 (6c) をポーリングループ内で実行。

   **ポーリングループ内の step (2) で毎サイクル実行**:

   6c. **進捗マーカー抽出**:
   - output_file を Read で取得した出力内容から `[REVIEW-PROGRESS: ...]` パターンを検索
   - opencode --format json の場合: NDJSON の各行から `{"result":"..."}` の result フィールド、
     または `{"type":"text","text":"..."}` の text フィールドを抽出してテキスト内を検索
   - 前回チェック以降に新しいマーカーが見つかったらユーザーにリレー表示:
     例: `"planreview #1: 4 issues (M:2, L:2) → fixing..."`
   - DISPLAYED_MARKERS カウンタで二重表示を防止

6b. **Rate limit detection**: Section A step 6b と同じフローを適用。dispatch 失敗時のレートリミット検出・フォールバック・パイプライン中断を行う。
7. **Verdict extraction**: プロセス完了後の全出力から verdict を抽出:
   - `v: GO` → proceed to next step
   - `v: CONDITIONAL` → AskUserQuestion: "レビュー結果は CONDITIONAL です。進めますか？ / 修正しますか？"
   - `v: NO-GO` → AskUserQuestion: "レビューが NO-GO を返しました。修正して再レビューしますか？ / 止めますか？"
   - Verdict not found or error → stop pipeline, report error
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
