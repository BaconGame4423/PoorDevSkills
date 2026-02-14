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
- Pipeline flows (Feature, Bugfix, Roadmap, Discovery, Investigation) → proceed to **Step 5**
- Non-pipeline flows (Q&A, Documentation) → execute target skill directly in Step 4
- Do NOT auto-transition to other agents via handoff frontmatter. Handoffs are UI metadata only.

### Step 1: Input Classification

Analyze `$ARGUMENTS` through a 3-stage process.

**1a. Intent Detection**: Classify by what the user wants to accomplish:
- **Feature**: add, create, or implement new functionality
- **Bugfix**: error, crash, broken behavior, or regression
- **Investigation**: investigate a problem, understand behavior, find root cause
- **Roadmap**: plan strategy, define vision, explore concepts at project level
- **Discovery**: prototype, explore ideas, rebuild existing code, "just try something"
- **Q&A**: question about the codebase or architecture
- **Documentation**: report, summary, or document generation

**Priority rule**: Feature / Bugfix / Investigation / Roadmap / Discovery signals take precedence over Q&A / Documentation.

**1b. Contextual Analysis** (when ambiguous):
- Problem description → bugfix
- Investigation signal ("why does X", "investigate") → investigation
- Desired state ("I want X", "add X") → feature
- Planning/strategy → roadmap
- Exploration ("try X", "prototype", "rebuild") → discovery
- Question → Q&A
- Report request → documentation

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

**4A Feature**: Report "Classified as feature: <summary>". → Step 5
**4B Bugfix**:
1. Check `bug-patterns.md` for similar past patterns.
2. Create `$FEATURE_DIR/bug-report.md`:
   ```markdown
   # Bug Report: [BUG SHORT NAME]
   **Branch**: `[###-fix-bug-name]` | **Created**: [DATE] | **Status**: Investigating
   **Input**: "$ARGUMENTS"
   ## Description
   [summary]
   ## Expected vs Actual
   - Expected: [expected]
   - Actual: [actual, with error messages if available]
   ## Steps to Reproduce
   1. [Step 1]
   ## Context
   - Frequency: [always / intermittent / specific conditions]
   - Environment: [OS, Language/Runtime, Key Dependencies]
   - Since When: [onset timing]
   - Reproduction: [Not Attempted / Reproduced / Could Not Reproduce]
   ```
   Fill what can be extracted. Leave unknowns as placeholders.
3. Report "Classified as bugfix: <summary>". → Step 5
**4C Roadmap**: Report "Classified as roadmap: <summary>". → Step 5
**4D Q&A**: Report "Classified as Q&A: <summary>". Execute `/poor-dev.ask` directly (non-pipeline).
**4E Documentation**: Report "Classified as documentation: <summary>". Execute `/poor-dev.report` directly (non-pipeline).
**4F Discovery**: Report "Classified as discovery: <summary>". → Step 5
**4G Investigation**: Report "Classified as investigation: <summary>". → Step 5

### Step 5: Specify + Pipeline Dispatch

After routing to a pipeline flow, orchestrate the specify step directly, then dispatch the remaining pipeline to a sub-agent.

#### 5A. Specify Step (read-only dispatch)

1. Read `commands/poor-dev.specify.md`
2. Strip YAML frontmatter (first `---` to next `---`). Validate no `handoffs:` remains.
3. Prepend NON_INTERACTIVE_HEADER + READONLY_HEADER:
   ```markdown
   ## Mode: NON_INTERACTIVE (pipeline sub-agent)
   - No AskUserQuestion → use [NEEDS CLARIFICATION: ...] markers
   - No Gate Check, Dashboard Update, handoffs, EnterPlanMode/ExitPlanMode
   - Output progress: [PROGRESS: ...] / [REVIEW-PROGRESS: ...]
   - If blocked → [ERROR: description] and stop
   - File scope: FEATURE_DIR + project source only. NEVER modify: agents/, commands/, lib/, .poor-dev/, .opencode/command/, .opencode/agents/, .claude/agents/, .claude/commands/
   - End with: files created/modified, unresolved items

   ## Read-Only Execution Mode
   You have READ-ONLY tool access (Edit, Write, Bash, NotebookEdit are disabled).
   - Output the spec draft as plain markdown text in your response.
   - First line MUST be: `[BRANCH: suggested-short-name]`
   - The rest of your output is the spec draft content (using the Spec Template).
   - Include `[NEEDS CLARIFICATION: question]` markers inline as needed (max 3).
   - Do NOT attempt to create branches, directories, or files.
   ```
4. Append: `$ARGUMENTS` (full original user input) as context
5. Resolve model: `bash lib/config-resolver.sh specify .poor-dev/config.json`
6. Dispatch with polling (same pattern as pipeline):
   - opencode/claude/FALLBACK dispatch → poll-dispatch.sh → JSON summary
   - If cli=claude: add `--disallowedTools "Edit,Write,Bash,NotebookEdit"`
   - FALLBACK_MODE: `Task(subagent_type="Explore", model="haiku", prompt=...)`
7. Parse output:
   - Extract `[BRANCH: ...]` → SUGGESTED_BRANCH
   - Remaining = draft body
   - `[ERROR: ...]` → stop
8. Branch + FEATURE_DIR:
   - Already on feature branch → FEATURE_DIR known, skip
   - On main → create branch from SUGGESTED_BRANCH + `mkdir -p FEATURE_DIR`
9. Write `FEATURE_DIR/spec-draft.md`
10. **[NEEDS CLARIFICATION] resolution**:
    - Extract all `[NEEDS CLARIFICATION: ...]` markers from spec-draft.md
    - INTERACTIVE_MODE = true → AskUserQuestion per marker → replace in spec-draft.md
    - INTERACTIVE_MODE = false → keep markers (user resolves during approval pause)
11. **User approval**:
    Display spec-draft.md as 日本語要約:
    ```
    ## 仕様ドラフト: [機能名の日本語訳]
    ### ユーザーストーリー
    - **P1**: [ストーリータイトルの日本語要約（1行）]
    ### 機能要件
    - FR-001: [要件の日本語訳（1行）]
    ### エッジケース
    - [日本語要約]
    ### 成功基準
    - SC-001: [基準の日本語訳]
    ```
    - INTERACTIVE_MODE = true → AskUserQuestion:
      - "承認する" → `cp spec-draft.md spec.md && rm spec-draft.md`、続行
      - "修正指示付きで棄却" → feedback 追記 → 停止
      - "棄却する" → 停止 (spec-draft.md 保存)
    - INTERACTIVE_MODE = false → 表示 → PAUSE_FOR_APPROVAL("spec-approval", "specify", summary)
12. Validation: 承認後 spec.md → checklists/requirements.md 生成

#### 5B. Pipeline Dispatch (remaining steps)

specify 完了後、残りパイプラインを sub-agent として dispatch:

1. Write classification JSON to `/tmp/poor-dev-classification.json`:
   ```json
   {
     "flow": "${FLOW}",
     "feature_dir": "${FEATURE_DIR}",
     "branch": "${BRANCH}",
     "summary": "${FEATURE_SUMMARY}",
     "interactive_mode": ${INTERACTIVE_MODE},
     "completed": ["specify"],
     "arguments": "${ORIGINAL_ARGUMENTS}"
   }
   ```
2. Read `commands/poor-dev.pipeline.md`, strip frontmatter
3. Prepend NON_INTERACTIVE_HEADER
4. Append classification JSON as context
5. Resolve model for "plan" step (pipeline orchestrator uses plan-tier model):
   `bash lib/config-resolver.sh plan .poor-dev/config.json`
6. Dispatch via opencode/claude/Task() with polling
7. Poll until completion → relay progress → display result
