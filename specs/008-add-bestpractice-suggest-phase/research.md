# Research: GLM4.7 Sub-Agent Implementation for Suggestion Phase

**Feature**: Best Practice and Tool Suggestion Phase
**Branch**: 008-add-bestpractice-suggest-phase
**Date**: 2026-02-12

## Research Overview

This document consolidates research findings for implementing GLM4.7 as a sub-agent for exploration research within the suggestion phase. The implementation must work within the non-interactive execution mode used by pipeline steps and leverage existing sub-agent dispatch patterns.

## Current Sub-Agent Dispatch Patterns

### Pattern 1: Native Execution (same CLI runtime)

**Finding**: Review orchestrators use `Task()` tool with `subagent_type` parameter when executing in the same CLI context:

```markdown
Task(subagent_type="planreview-pm", model=<resolved model>, prompt="Review $ARGUMENTS. Output compact English YAML.")
```

**Source**: `commands/poor-dev.planreview.md:42`, `commands/poor-dev.phasereview.md:42`

**Implication**: When GLM4.7 model matches the current CLI runtime, native Task() dispatch can be used. The Task tool handles internal dispatching and returns task_id and output_file.

### Pattern 2: Cross-CLI Execution (different CLI runtime)

**Finding**: When resolved CLI differs from current runtime, Bash commands spawn background processes:

```bash
# OpenCode target from Claude runtime:
Bash: opencode run --model <model> --agent planreview-pm --format json "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)

# Claude target from OpenCode runtime:
Bash: claude -p --model <model> --agent planreview-pm --no-session-persistence --output-format text "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
```

**Source**: `commands/poor-dev.planreview.md:48-51`, `commands/poor-dev.phasereview.md:48-51`

**Implication**: GLM4.7 exploration must support both native and cross-CLI dispatch patterns based on config resolution.

### Pattern 3: Fallback Mode

**Finding**: When opencode CLI is unavailable, FALLBACK_MODE uses Task() with haiku model:

```markdown
FALLBACK_MODE: Task(subagent_type="general-purpose", model="haiku", prompt=<assembled prompt>)
```

**Source**: `commands/poor-dev.md:269`, `commands/poor-dev.md:369`

**Implication**: Fallback mechanism exists for exploration failures, but suggestion phase requires GLM4.7 for exploration research (FR-002).

## R-001: GLM4.7 Sub-Agent Dispatch Pattern

**Decision**: Use native Task() dispatch with model parameter for GLM4.7 exploration when opencode CLI is available and config resolves to opencode.

**Rationale**: 
- Existing review orchestrators use this pattern successfully
- Task tool handles task_id and output_file management
- Works with adaptive polling mechanism already in place
- Consistent with existing config resolution flow

**Implementation**:

```markdown
# Step 0: Config Resolution
Read `.poor-dev/config.json`. Resolve with priority: `overrides.suggest` → `overrides.default`.
Extract: cli + model.

# Step 1: Dispatch GLM4.7 exploration
IF resolved_cli == "opencode" AND model == "zai-coding-plan/glm-4.7":
  # Native execution
  Task(subagent_type="suggestion-exploration", model="zai-coding-plan/glm-4.7", prompt=<exploration prompt>)
ELSE:
  # Cross-CLI or fallback
  Bash: opencode run --model zai-coding-plan/glm-4.7 --agent suggestion-exploration --format json "<exploration prompt>" (run_in_background: true)
```

**Alternative rejected**: Direct Bash command without Task tool - Task tool provides better integration with polling and output handling.

## R-002: Exploration Prompt Template

**Decision**: Use structured prompt with NON_INTERACTIVE_HEADER prefix and clear output format requirements.

**Rationale**: 
- Non-interactive mode prevents AskUserQuestion usage
- Structured output enables parsing into suggestion entities
- Clear constraints prevent exploration from getting stuck

**Prompt Template**:

```markdown
## Execution Mode: Non-Interactive

You are running as a sub-agent in a pipeline. Follow these rules:
- Do NOT use AskUserQuestion. Include questions as [NEEDS CLARIFICATION: question] markers.
- Do NOT execute Gate Check or Dashboard Update sections.
- Do NOT suggest handoff commands.
- Focus on producing the required output artifacts (files).
- If blocked, output [ERROR: description] and stop.
- End with: files created/modified, any unresolved items.

## Task: Exploration Research for Suggestion Phase

You are GLM4.7, conducting exploration research for best practices, tools, libraries, and usage patterns.

### Context
- Feature specification: ${SPEC_FILE}
- Feature description: ${FEATURE_DESCRIPTION}
- Technology stack: ${TECH_STACK}

### Research Objectives
1. Identify relevant best practices for this feature type
2. Research modern tools and libraries commonly used for this domain
3. Find usage patterns and architectural approaches
4. Compile sources with evidence (documentation, blog posts, GitHub repos)
5. Assess maintainability and security of suggested tools/libraries

### Research Process
- Use WebFetch tool to research best practices documentation
- Search for popular GitHub repositories in this domain
- Analyze community adoption and maintenance activity
- Check for known security issues in suggested tools
- Compile findings with supporting evidence

### Output Format

Output findings in this exact YAML structure:

```yaml
exploration_session:
  id: <unique_session_id>
  started_at: <ISO8601_timestamp>
  completed_at: <ISO8601_timestamp>
  status: completed|failed
  findings_summary: <3-4 sentence summary>

suggestions:
  - id: <unique_id>
    type: best_practice|tool|library|usage_pattern
    name: <name>
    description: <2-3 sentence description>
    rationale: <why this is relevant to the feature>
    maintainability_score: <0-100>
    security_score: <0-100>
    source_urls:
      - <url_1>
      - <url_2>
    adoption_examples:
      - <example_project_1>
      - <example_project_2>
    evidence:
      - <evidence_point_1>
      - <evidence_point_2>
  - id: <unique_id_2>
    ... (repeat for each suggestion)

sources_consulted:
  - <source_1_url>
  - <source_2_url>
```

### Maintainability Scoring (0-100)
- 90-100: Very active (commits last 6mo, responsive maintainers, high issue resolution)
- 70-89: Active (commits last 12mo, some maintainer activity)
- 50-69: Moderate (commits last 18mo, limited activity)
- 0-49: Low (no commits 18+mo, inactive maintainers)

### Security Scoring (0-100)
- 90-100: Secure (no known CVEs, recent security audit, high code quality)
- 70-89: Mostly secure (no critical CVEs, some advisory, acceptable quality)
- 50-69: Some concerns (non-critical CVEs, outdated dependencies)
- 0-49: Risky (critical CVEs, no security audit, poor practices)

### Threshold Rules
- Exclude suggestions with maintainability_score < 50 OR security_score < 50
- Flag suggestions with mixed scores (one low, one high) with [RISK] prefix

### Completion Time
You have 5 minutes (300 seconds) to complete this exploration. Prioritize quality over quantity.

If unable to find relevant suggestions, output:
```yaml
exploration_session:
  status: completed
  findings_summary: "No specific suggestions found. Feature appears to use standard patterns."
suggestions: []
```

If exploration fails:
```yaml
exploration_session:
  status: failed
  findings_summary: "[ERROR: <description of failure>]"
suggestions: []
```
```

## R-003: Timeout Handling Strategy

**Decision**: Use existing adaptive polling mechanism with 5-minute absolute timeout for GLM4.7 exploration.

**Rationale**: 
- Spec SC-005 requires completion within 5 minutes
- Existing polling infrastructure already implemented in `poor-dev.md`
- Idle-based timeout prevents hanging on stuck processes

**Implementation**:

```markdown
# Configure timeout specifically for suggestion phase
POLL_INTERVAL = config.polling.interval || 1          # 秒
IDLE_TIMEOUT  = config.polling.idle_timeout || 120    # 出力停滞でキル
MAX_TIMEOUT   = 300                                   # 5分絶対上限 (suggestion専用)

# Polling loop (adaptive)
ELAPSED = 0, IDLE = 0, LAST_SIZE = 0

while true:
  (1) TaskOutput(task_id, block=false, timeout=1000)
      → status が completed/failed → ループ終了

  (2) Read(output_file) で現在の出力サイズを確認
      → CURRENT_SIZE > LAST_SIZE の場合:
         IDLE = 0 (リセット — 出力が増加中)
         LAST_SIZE = CURRENT_SIZE
      → CURRENT_SIZE == LAST_SIZE の場合:
         IDLE += POLL_INTERVAL

  (3) IDLE >= IDLE_TIMEOUT → TaskStop(task_id)、タイムアウト扱い
  (4) ELAPSED >= MAX_TIMEOUT → TaskStop(task_id)、安全停止
  (5) ELAPSED += POLL_INTERVAL、次のサイクルへ
```

**Config Update**:
```json
{
  "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" },
  "overrides": {
    "suggest": { "model": "zai-coding-plan/glm-4.7" }
  },
  "polling": {
    "interval": 1,
    "idle_timeout": 120,
    "max_timeout": 300
  }
}
```

**Alternative rejected**: Fixed 5-minute timeout - idle-based timeout is more efficient and prevents unnecessary waiting.

## R-004: Output Parsing Strategy

**Decision**: Parse YAML output using structured validation and extract suggestions array.

**Rationale**: 
- YAML format specified in prompt enables structured parsing
- Maintainability and security scores are numeric and filterable
- ExplorationSession entity maps directly to output structure

**Implementation**:

```markdown
# Step: Output parsing (dispatch completion後)

1. Read output_file から全文を取得

2. YAML パースエラーチェック:
   → パース失敗: `[ERROR: Invalid YAML output from GLM4.7 exploration]`
   → 続行不可

3. 構造チェック:
   ```yaml
   必須フィールド:
   - exploration_session.id
   - exploration_session.status
   - exploration_session.findings_summary
   - suggestions[] (array, may be empty)
   ```

4. Status 判定:
   - `status: completed` → 継続
   - `status: failed` → パイプライン停止、エラー報告

5. Suggestions フィルタリング (maintainability/security閾値適用):
   ```yaml
   各 suggestion について:
   - maintainability_score >= 50 AND security_score >= 50 → 含める
   - どちらか < 50 → 除外 (FR-006)
   - mixed signal (一方低、一方高) → [RISK] タグ付与
   ```

6. 保存先:
   - `${FEATURE_DIR}/exploration-session.yaml` - ExplorationSession 全体
   - `${FEATURE_DIR}/suggestions.yaml` - フィルタ済み suggestions 配列のみ
   - `${FEATURE_DIR}/suggestion-decisions.yaml` - 空配列で初期化 (後で決定記録)
```

**Validation Rules**:
- `maintainability_score` and `security_score` must be 0-100
- `type` must be one of: `best_practice`, `tool`, `library`, `usage_pattern`
- `source_urls` must be valid URL format
- Minimum of 1 `source_urls` per suggestion (evidence requirement)

## R-005: Fallback Mechanisms

**Decision**: Implement three-tier fallback: cache → manual research → continue without suggestions.

**Rationale**: 
- FR-010 requires graceful failure handling
- Edge case exploration (spec.md:68) explicitly asks for fallback
- Pipeline should not block entirely on exploration failure

**Implementation**:

```markdown
# Tier 1: Cache-based fallback
IF GLM4.7 exploration fails OR times out:
  - Check `${FEATURE_DIR}/exploration-cache.yaml` (if exists from previous similar features)
  - If cache has relevant suggestions (by feature type keyword matching):
    → Report: "⚠ GLM4.7探索失敗。キャッシュから候補を提示します。"
    → Use cached suggestions
  - Else: Tier 2

# Tier 2: Manual research fallback
IF no cache available OR cache irrelevant:
  - Output: "GLM4.7探索失敗/タイムアウト。手動で調査しますか？"
  - AskUserQuestion (orchestrator経由):
    - "はい、手動で候補を提供する" → ユーザー入力を suggestions.yaml に保存
    - "いいえ、提案なしで進む" → 空の suggestions.yaml 作成
  - Log failure to `${FEATURE_DIR}/exploration-failures.log`

# Tier 3: Continue without suggestions
IF user declines manual research:
  - Create empty `${FEATURE_DIR}/suggestions.yaml`:
    ```yaml
    exploration_session:
      status: failed
      findings_summary: "No suggestions available - exploration failed"
    suggestions: []
    ```
  - Report: "提案なしでプランフェーズに進みます。"
  - Continue to next pipeline step
```

**Failure Logging**:
```markdown
# ${FEATURE_DIR}/exploration-failures.log
2026-02-12T10:30:00Z ERROR GLM4.7 exploration timeout after 300s
2026-02-12T10:35:00Z ERROR GLM4.7 dispatch failed: Rate limit exceeded
```

**Alternative rejected**: Abort entire pipeline on exploration failure - violates FR-010 graceful handling requirement.

## R-006: Sub-Agent Definition Structure

**Decision**: Create `agents/opencode/suggestion-exploration.md` following existing agent patterns.

**Rationale**: 
- Existing agents (`agents/opencode/planreview-pm.md`) use frontmatter with mode/subagent
- Consistent structure aids discovery and maintenance
- Mode: subagent enables proper tool restrictions

**Agent Template**:

```markdown
---
description: Suggestion phase exploration - GLM4.7 research agent
mode: subagent
tools:
  write: false
  edit: false
  bash: false
  webfetch: true
---

You are the Suggestion Exploration agent, powered by GLM4.7.

## Your Role
Conduct research to identify best practices, tools, libraries, and usage patterns relevant to the feature specification.

## Research Process
1. Read the feature specification provided
2. Use WebFetch to research:
   - Official documentation for relevant technologies
   - Best practices guides and style guides
   - Popular GitHub repositories in the domain
   - Community discussions and blog posts
3. Assess suggested tools/libraries for:
   - Maintenance activity (commit history, issue resolution)
   - Security status (CVEs, advisories)
   - Community adoption
4. Compile structured findings with evidence

## Output
Follow the exploration prompt template for exact YAML output format.

## Constraints
- Complete research within 5 minutes
- Prioritize quality over quantity of suggestions
- Exclude suggestions with maintainability_score < 50 OR security_score < 50
- Provide source URLs for all claims
```

**Source**: `agents/opencode/planreview-pm.md` pattern

## Implementation Decision Summary

### Architecture

**Choice**: Native Task() dispatch + adaptive polling + YAML parsing + 3-tier fallback

**Implementation Plan**:
1. Create `agents/opencode/suggestion-exploration.md` - Exploration agent definition
2. Create `commands/poor-dev.suggest.md` - Suggestion phase command with GLM4.7 dispatch
3. Update `commands/poor-dev.md` - Add suggest to pipeline (specify → suggest → plan)
4. Update `.poor-dev/config.json` - Add suggestion-specific config if needed

### Files to Create

- `commands/poor-dev.suggest.md` - Suggestion phase command
- `agents/opencode/suggestion-exploration.md` - GLM4.7 exploration agent
- `lib/suggestion-parser.mjs` - YAML parsing and validation utility

### Files to Modify

- `commands/poor-dev.md` - Add suggest to pipeline after specify
- `.poor-dev/config.json` - Update max_timeout for suggestion

### Integration Points

1. **Config Resolution**: Follow existing pattern (`overrides.suggest` → `default`)
2. **Non-Interactive Mode**: Use existing NON_INTERACTIVE_HEADER
3. **Polling**: Use existing adaptive polling infrastructure
4. **Output Parsing**: New YAML parser but follows review output patterns
5. **Fallback**: 3-tier fallback as new mechanism

### Backward Compatibility

**Strategy**:
- New command does not affect existing pipeline steps
- suggest step only inserted for new features (existing features continue old flow)
- Config.json additions are backward compatible (new keys, old defaults unchanged)

### Risk Assessment

**Low Risk**:
- Agent definition follows existing patterns (mode: subagent, tools restrictions)
- Polling infrastructure already tested with review orchestrators
- YAML parsing is standard Node.js library (js-yaml)

**Medium Risk**:
- 5-minute timeout may be insufficient for complex features
- WebFetch tool availability and reliability
- Fallback cache mechanism not pre-populated

**Mitigation**:
- Set reasonable timeout and allow manual research override
- WebFetch errors caught and logged with fallback to manual
- Cache grows organically as features are processed

## Open Questions

### Question 1: WebFetch Tool Availability

**Issue**: Does GLM4.7 have access to WebFetch tool when dispatched as sub-agent?

**Approach**:
- If WebFetch unavailable, exploration must rely on internal knowledge
- Document limitation in agent description
- Consider Bash-based curl fallback if needed

### Question 2: Exploration Session ID Generation

**Issue**: How to generate unique session IDs for exploration?

**Options**:
1. UUID v4
2. Timestamp-based (YYYYMMDD-HHMMSS)
3. Feature-based (NNN-suggest-N)

**Decision**: Use UUID v4 for uniqueness across all features.

### Question 3: Cache Key Strategy

**Issue**: How to match cached suggestions to new features?

**Approach**:
- Extract keywords from feature description (e.g., "authentication", "database", "api")
- Use fuzzy matching on spec.md content
- Allow user to override cache selection manually

## Next Steps (Phase 1)

1. Extract data model from research findings → `data-model.md`
2. Design API contracts → `/contracts/`
3. Write quickstart guide → `quickstart.md`
4. Proceed to task breakdown → `/poor-dev.tasks`

## References

- Spec: `/specs/008-add-bestpractice-suggest-phase/spec.md`
- Constitution: `/constitution.md`
- Main orchestrator: `/commands/poor-dev.md`
- Review patterns: `/commands/poor-dev.planreview.md`
- Agent examples: `/agents/opencode/planreview-pm.md`
- Config: `/.poor-dev/config.json`
