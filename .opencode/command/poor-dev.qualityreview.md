---
description: Run quality gates + 4-persona review + adversarial review with auto-fix loop
handoffs:
  - label: 修正実装
    agent: poor-dev.implement
    prompt: 品質レビューの指摘に基づいて修正を適用してください
    send: true
  - label: フェーズ完了レビュー
    agent: poor-dev.phasereview
    prompt: フェーズ完了レビューを実行してください
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Quality Review Procedure (5 stages)

This review has additional stages compared to other review types.

### STAGE 0: Quality Gates

Run automated quality gates before persona review:

```bash
# Detect project language and run appropriate commands:

# TypeScript/JavaScript
tsc --noEmit && eslint . --max-warnings 0 && prettier --check "**/*.{ts,tsx,js,jsx,json,md}" && npm test -- --coverage

# Python
mypy . && ruff lint && black --check . && pytest --cov

# Rust
cargo check && cargo clippy -- -D warnings && cargo fmt --check && cargo test

# Go
go vet ./... && golangci-lint run && gofmt -l . && go test ./... -cover
```

If quality gates fail, record failures as C or H severity issues and proceed to fix loop.

### STAGE 1-4: Review Loop

Repeat until issue count reaches 0.

#### STEP 1: Persona Reviews (parallel)

Run 4 persona reviews as **parallel sub-agents** with fresh context each.

Persona sub-agents (defined in `.opencode/agents/`):
- `qualityreview-qa`
- `qualityreview-testdesign`
- `qualityreview-code`
- `qualityreview-security`

Each sub-agent instruction: "Review `$ARGUMENTS`. Output compact English YAML."

**IMPORTANT**: Always spawn NEW sub-agents. Never reuse previous ones.

**Claude Code**: Use Task tool with subagent_type "general-purpose" for each persona.
**OpenCode**: Use `@qualityreview-qa`, `@qualityreview-testdesign`, `@qualityreview-code`, `@qualityreview-security`.

#### STEP 2: Adversarial Review

After persona reviews, run `swarm_adversarial_review`:

```bash
/swarm_adversarial_review --diff [diff] --test_output [test output]
```

Judgments:
- **APPROVED**: code is excellent, no issues
- **NEEDS_CHANGES**: real issues found, add to issue list
- **HALLUCINATING**: adversary fabricating issues, ignore

#### STEP 3: Aggregate Results

Collect 4 persona YAML results + adversarial review results. Count all issues by severity.

Apply **3-strike rule** for adversarial review:
- Track adversarial rejection count
- After 3 rejections, task fails and returns to backlog
- Document reason for each rejection

#### STEP 4: Branch

- **Issues remain (any severity: C/H/M/L)** → STEP 5 (fix and re-review)
- **Zero issues AND adversarial APPROVED/HALLUCINATING** → Loop complete
- **3 adversarial strikes** → Abort. Report failure.

#### STEP 5: Auto-Fix (sub-agent)

Spawn a fix sub-agent (`review-fixer`) with the aggregated issue list:

> Fix `$ARGUMENTS` based on these issues.
> Priority order: C → H → M → L
> Issues: [paste aggregated issues]

After fix completes → **back to STEP 1** (new sub-agents, fresh context).

### Loop Behavior

- **Exit condition**: 0 issues from all personas + adversarial APPROVED/HALLUCINATING
- **No hard limit**: continues as long as issues remain
- **Safety valve**: after 10 iterations, ask user for confirmation
- **3-strike rule**: adversarial review failures are tracked separately
- **Progress tracking**: record issue count per iteration

## Iteration Output

```yaml
type: quality
target: $ARGUMENTS
n: 2
gates:
  typecheck: pass
  lint: pass
  format: pass
  test: pass
i:
  H:
    - missing edge case test for null input (QA)
    - XSS vulnerability in render function (SEC)
  M:
    - function too complex, cyclomatic complexity 15 (CODE)
adversarial: NEEDS_CHANGES
strikes: 1
ps:
  QA: CONDITIONAL
  TESTDESIGN: GO
  CODE: CONDITIONAL
  SEC: NO-GO
act: FIX
```

## Final Output (loop complete, 0 issues)

```yaml
type: quality
target: $ARGUMENTS
v: GO
n: 5
gates:
  typecheck: pass
  lint: pass
  format: pass
  test: pass
adversarial: APPROVED
strikes: 1
log:
  - {n: 1, issues: 9, fixed: "gate failures, coverage"}
  - {n: 2, issues: 5, fixed: "XSS, null handling"}
  - {n: 3, issues: 3, fixed: "complexity, naming"}
  - {n: 4, issues: 1, fixed: "edge case test"}
  - {n: 5, issues: 0}
next: /poor-dev.phasereview
```

## Bugfix Postmortem Generation (conditional)

**This section executes ONLY after the review loop completes with 0 issues and GO verdict.**
**Do NOT execute during the internal fix-review loop (STEP 1-4 cycle).**

Determine FEATURE_DIR from `$ARGUMENTS` path (extract numeric prefix from the path, find matching `specs/NNN-*` directory). Check if `FEATURE_DIR/bug-report.md` exists. **If it exists** (bugfix flow), execute the following postmortem steps. **If it does not exist** (i.e., it's a regular feature), skip this section entirely.

### 2a. Generate Postmortem

1. Read the following artifacts from FEATURE_DIR:
   - `bug-report.md`
   - `investigation.md`
   - `fix-plan.md`
2. Use the following postmortem template:

   ```markdown
   # Postmortem: [BUG SHORT NAME]

   **Date**: [DATE]
   **Branch**: [BRANCH]
   **Severity**: [Critical/High/Medium/Low]
   **Category**: [Logic Bug / Dependency / Environment / Regression / Concurrency / Data / Configuration]
   **Resolution Time**: [intake から qualityreview 完了までの期間]

   ## Summary
   [1-2行の要約]

   ## Root Cause
   [根本原因の説明 -- investigation.md から抽出]

   ## 5 Whys
   [investigation.md の 5 Whys セクションから転記]

   ## Fix Applied
   [実際に行った修正の概要]
   - 変更ファイル: [一覧]
   - 変更の種類: [ロジック修正/設定変更/依存更新/etc.]

   ## Impact
   - 影響範囲: [affected area]
   - 影響期間: [いつからいつまで]

   ## Detection
   - 発見方法: [ユーザー報告/テスト失敗/モニタリング/etc.]

   ## Prevention
   - [ ] [再発防止策1: 具体的なアクション]
   - [ ] [再発防止策2: 具体的なアクション]

   ## Lessons Learned
   - [学んだこと1]
   - [学んだこと2]
   ```

3. Get the full diff for this bugfix branch:
   ```bash
   git diff main...HEAD
   ```
4. Generate `$FEATURE_DIR/postmortem.md` based on the template:
   - Fill in all template fields from the artifacts
   - **Fix Applied** section: list actual changed files and change types from the git diff
   - **Resolution Time**: estimate based on branch creation date (`git log --format=%ci --diff-filter=A -- $FEATURE_DIR | tail -1`)
   - **Category**: use the category identified in investigation.md
   - **5 Whys**: copy from investigation.md
   - **Prevention**: derive concrete prevention actions from the root cause

### 2b. Update Bug Pattern Database

1. Read `bug-patterns.md`
2. Determine the next pattern ID:
   - If Pattern Index table is empty, use `BP-001`
   - Otherwise, find the highest existing ID and increment
3. Add a new row to the **Pattern Index** table:
   ```
   | BP-NNN | [Category] | [Short pattern description] | 1 | [TODAY] |
   ```
4. Add a new pattern entry to the **Patterns** section:
   ```markdown
   ### BP-NNN: [Pattern Name]
   - **Category**: [from investigation.md]
   - **Cause Pattern**: [under what conditions/situations this occurs]
   - **Symptoms**: [how it manifests]
   - **Detection**: [how to detect early]
   - **Prevention**: [how to prevent]
   - **Past Occurrences**: [branch name]
   ```
5. Save the updated `bug-patterns.md`

### 2c. Report to User

Present the postmortem summary and new bug pattern to the user:
- Postmortem file path
- Root cause summary
- Prevention actions
- New bug pattern ID and description
