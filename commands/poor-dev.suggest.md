---
description: Execute suggestion phase - GLM4.7 research for best practices, tools, libraries, and usage patterns with maintainability/security validation
handoffs:
  - label: プラン作成
    agent: poor-dev.plan
    prompt: 提案フェーズを完了しました。プランを作成してください
    send: true
  - label: プラン修正
    agent: poor-dev.plan
    prompt: 提案を考慮してプランを修正してください
---

## User Input

```text
$ARGUMENTS
```

## Input Requirements

**Required**:
- `FEATURE_DIR`: Feature specification directory path (e.g., `specs/008-add-bestpractice-suggest-phase`)
- `spec.md`: Feature specification file in FEATURE_DIR

**Optional**:
- `plan.md`: Existing plan file (if available, for context)
- Technology stack information (auto-detected from project files)

## STEP 0: Feature Directory Detection

1. **Resolve FEATURE_DIR**:
   - If `$ARGUMENTS` contains a path ending with `/spec.md`, extract parent directory
   - If `$ARGUMENTS` is a directory path, use it directly
   - If `$ARGUMENTS` is empty, scan for most recent spec in `specs/*/spec.md`
   - Set `FEATURE_DIR` to resolved path

2. **Validate inputs**:
   - Check `FEATURE_DIR/spec.md` exists and is readable
   - Read spec.md to extract feature description and context

3. **Extract feature context**:
   - Parse spec.md for feature description
   - Detect technology stack from project files (package.json, requirements.txt, etc.)

## STEP 1: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`).
   - If missing, use built-in defaults:
   ```json
   {
     "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" },
     "overrides": {},
     "polling": { "interval": 1, "idle_timeout": 120, "max_timeout": 300 }
   }
   ```

2. Resolve config for suggestion phase with priority:
   - `overrides.suggest` → `overrides.default` → `default`

3. Extract: `cli`, `model`, `polling.interval`, `polling.idle_timeout`, `polling.max_timeout`

4. Determine execution mode:
   - `resolved_cli` vs `current_cli` (runtime executing this command)
   - If match → native execution
   - If mismatch → cross-CLI execution

## STEP 2: Initialize ExplorationSession

Create initial ExplorationSession with status `pending`:

```yaml
id: <generate UUID v4>
feature_id: <extract from FEATURE_DIR path, e.g., "008-add-bestpractice-suggest-phase">
status: pending
started_at: null
completed_at: null
findings_summary: ""
suggestions_generated_count: 0
sources_consulted: []
failure_reason: null
```

Output progress marker:
```
[PROGRESS: Initializing exploration session: ${EXPLORATION_SESSION_ID}]
```

## STEP 3: Dispatch GLM4.7 Exploration

**Execute GLM4.7 as sub-agent** for exploration research:

1. **Build exploration prompt** with NON_INTERACTIVE_HEADER:

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
- Feature specification: ${SPEC_FILE_PATH}
- Feature description: ${EXTRACTED_FROM_SPEC}
- Technology stack: ${DETECTED_STACK}

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

\`\`\`yaml
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

sources_consulted:
  - <source_1_url>
  - <source_2_url>
\`\`\`

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
\`\`\`yaml
exploration_session:
  status: completed
  findings_summary: "No specific suggestions found. Feature appears to use standard patterns."
suggestions: []
\`\`\`

If exploration fails:
\`\`\`yaml
exploration_session:
  status: failed
  findings_summary: "[ERROR: <description of failure>]"
suggestions: []
\`\`\`
```

2. **Dispatch execution** following routing logic (MANDATORY):

```
resolved_cli = config resolution from STEP 1
current_cli  = runtime you are executing in ("claude" or "opencode")

IF resolved_cli == current_cli:
  # Native execution
  IF current_cli == "claude":
    → Task(subagent_type="suggestion-exploration", model=<resolved model>, prompt=<exploration prompt>)
  ELSE:  # current_cli == "opencode"
    → @suggestion-exploration (if config model == session default)
    → Bash: opencode run --model <model> --agent suggestion-exploration "prompt" (if different model)
ELSE:
  # Cross-CLI — REQUIRED
  IF resolved_cli == "opencode":
    → Bash: opencode run --model <model> --agent suggestion-exploration --format json "prompt" (run_in_background: true)
  ELSE:  # resolved_cli == "claude"
    → Bash: claude -p --model <model> --agent suggestion-exploration --no-session-persistence --output-format text "prompt" (run_in_background: true)
```

3. **Set session status to `in_progress`** and update timestamps

4. **Output progress marker**:
```
[PROGRESS: GLM4.7 exploration started: ${TASK_ID}]
```

## STEP 4: Adaptive Polling Loop

Poll GLM4.7 task output with adaptive timeout:

```
POLL_INTERVAL = config.polling.interval || 1          # 秒
IDLE_TIMEOUT  = config.polling.idle_timeout || 120    # 出力停滞でキル
MAX_TIMEOUT   = config.polling.max_timeout || 300     # 5分絶対上限

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

Output progress markers:
```
[PROGRESS: Polling GLM4.7 exploration: ${ELAPSED}s elapsed, output size: ${CURRENT_SIZE} bytes]
```

## STEP 5: Parse and Validate GLM4.7 Output

1. **Read output_file** containing GLM4.7 YAML response

2. **YAML parsing**:
   - Parse YAML to extract `exploration_session` and `suggestions` sections
   - If parse fails: `[ERROR: Invalid YAML output from GLM4.7 exploration]`

3. **Structure validation** (required fields):
   ```yaml
   Required:
   - exploration_session.id
   - exploration_session.status
   - exploration_session.findings_summary
   - suggestions[] (array, may be empty)
   ```

4. **Status check**:
   - `status: completed` → continue to STEP 6
   - `status: failed` → proceed to fallback (STEP 9)

5. **Output progress marker**:
```
[PROGRESS: GLM4.7 exploration completed: ${SUGGESTION_COUNT} suggestions generated]
```

## STEP 6: Filter Suggestions by Thresholds

Apply maintainability and security thresholds (FR-006):

```javascript
filtered_suggestions = []

for suggestion in suggestions:
  maintainability = suggestion.maintainability_score
  security = suggestion.security_score

  # Threshold rule: exclude if either score < 50
  if maintainability < 50 OR security < 50:
    continue  # exclude entirely

  # Warning rules
  if (maintainability >= 75 AND security < 60) OR (security >= 75 AND maintainability < 60):
    suggestion.name = "[RISK] " + suggestion.name
  elif maintainability < 60 OR security < 60:
    suggestion.name = "[CAUTION] " + suggestion.name

  filtered_suggestions.append(suggestion)
```

Output progress marker:
```
[PROGRESS: Filtered suggestions: ${SUGGESTION_COUNT} passed thresholds, ${EXCLUDED_COUNT} excluded]
```

## STEP 7: Save Output Files

Write three YAML files to `${FEATURE_DIR}`:

### exploration-session.yaml
```yaml
id: <exploration_session.id>
feature_id: <from FEATURE_DIR>
status: <exploration_session.status>
started_at: <exploration_session.started_at>
completed_at: <exploration_session.completed_at>
findings_summary: <exploration_session.findings_summary>
suggestions_generated_count: <len(suggestions)>
sources_consulted: <exploration_session.sources_consulted>
failure_reason: null
```

### suggestions.yaml
```yaml
<filtered_suggestions array>
```

### suggestion-decisions.yaml
```yaml
[]
```

Output progress marker:
```
[PROGRESS: Output files written: exploration-session.yaml, suggestions.yaml, suggestion-decisions.yaml]
```

## STEP 8: Present Suggestions and Collect Decisions

Display suggestions to user for review and decision collection:

```markdown
# Suggestion Phase Results

## Exploration Summary
**Status**: ${EXPLORATION_SESSION.status}
**Suggestions Found**: ${SUGGESTION_COUNT}
**Time**: ${EXPLORATION_DURATION}

${FINDINGS_SUMMARY}

---

## Suggestions

${EACH_SUGGESTION}

### ${SUGGESTION_NAME} (${SUGGESTION_TYPE})
**Description**: ${DESCRIPTION}

**Rationale**: ${RATIONALE}

**Scores**:
- Maintainability: ${MAINTAINABILITY_SCORE}/100
- Security: ${SECURITY_SCORE}/100

**Evidence**:
${EVIDENCE}

**Sources**:
${SOURCE_URLS}

**Adoption Examples**:
${ADOPTION_EXAMPLES}

---

**Decision**:
- [ ] Accept - Include this suggestion in the feature
- [ ] Reject - Skip this suggestion
- [ ] Defer - Decide later
```

**Non-Interactive Mode**:
- Skip decision collection
- All decisions set to `pending`
- Output: `[PROGRESS: Non-interactive mode - decisions deferred to later phase]`

**Interactive Mode**:
- Collect user decisions via orchestrator (bypass QuestionTools)
- Update `suggestion-decisions.yaml` with each decision
- Optional reason field for rejected suggestions

## STEP 8b: Manual Suggestion Addition

Allow developers to add custom suggestions not automatically discovered by GLM4.7.

**Non-Interactive Mode**:
- Output: `[NEEDS CLARIFICATION: Do you want to add manual suggestions?]`
- Skip manual suggestion collection (requires user interaction)

**Interactive Mode**:
1. **Prompt for manual addition**:
   ```
   Do you want to add custom suggestions not found by GLM4.7? (yes/no)
   ```

2. **Collect manual suggestion input**:
   For each manual suggestion, collect:
   ```yaml
   - id: <auto-generate UUID>
     type: best_practice|tool|library|usage_pattern
     name: <suggestion name>
     description: <2-3 sentence description>
     rationale: <why this is relevant to the feature>
     maintainability_score: <0-100>
     security_score: <0-100>
     source: "manual"
     source_urls:
       - <optional URLs>
     adoption_examples:
       - <optional examples>
     evidence:
       - <optional evidence>
   ```

3. **Validate manual suggestions**:
   - Apply same threshold rules as GLM4.7 suggestions (maintainability >= 50, security >= 50)
   - Add [RISK] or [CAUTION] prefixes based on score patterns
   - Exclude suggestions that fail thresholds

4. **Append to suggestions.yaml**:
   - Manual suggestions are appended to the existing suggestions array
   - Each manual suggestion has `source: "manual"` field to distinguish from GLM4.7 suggestions

5. **Update counts**:
   - Update `exploration-session.yaml` with new total suggestion count
   - Include manual suggestions in decision collection (STEP 8)

**Output progress marker**:
```
[PROGRESS: Manual suggestions added: ${MANUAL_COUNT} (total now: ${TOTAL_COUNT})]
```

## STEP 9: Fallback Handling

If GLM4.7 exploration fails or times out:

### Tier 1: Cache-based Fallback
```bash
if [[ -f "${FEATURE_DIR}/exploration-cache.yaml" ]]; then
  # Check if cache has relevant suggestions
  # Match by feature type keyword
  # If match: use cached suggestions
  echo "[PROGRESS: Using cached suggestions]"
  # Proceed to STEP 7 with cached data
fi
```

### Tier 2: Manual Research Fallback
```
echo "GLM4.7 exploration failed/timed out."
echo "Options:"
echo "  1. Provide manual suggestions"
echo "  2. Continue without suggestions"

# Ask orchestrator for decision (bypass QuestionTools)
# If option 1: collect user input → suggestions.yaml
# If option 2: create empty suggestions.yaml
```

### Tier 3: Continue Without Suggestions
```yaml
exploration-session.yaml:
  status: failed
  findings_summary: "No suggestions available - exploration failed"

suggestions.yaml:
  []

suggestion-decisions.yaml:
  []
```

Output: `[PROGRESS: Continuing without suggestions]`

## STEP 10: Completion and Reporting

Generate final summary:

```yaml
type: suggest
feature_dir: ${FEATURE_DIR}
exploration_session_id: ${EXPLORATION_SESSION_ID}
suggestions:
  total: ${SUGGESTION_COUNT}
  accepted: ${ACCEPTED_COUNT}
  rejected: ${REJECTED_COUNT}
  pending: ${PENDING_COUNT}
files:
  - exploration-session.yaml
  - suggestions.yaml
  - suggestion-decisions.yaml
next: /poor-dev.plan
```

Output final progress marker:
```
[PROGRESS: Suggestion phase complete: ${SUGGESTION_COUNT} suggestions, ${ACCEPTED_COUNT} accepted]
```

## Emergency Recovery

When suggestion phase artifacts are corrupted, run recovery:

### Usage
```
/poor-dev.suggest recover
```

### Recovery Process
1. Check each artifact file for corruption:
   - exploration-session.yaml
   - suggestions.yaml
   - suggestion-decisions.yaml
2. For corrupted files:
   a. Attempt restore from `.backups/` directory
   b. If no backup available, reconstruct from remaining artifacts
   c. If reconstruction fails, create fresh empty file
3. Verify cross-file consistency:
   - suggestions_generated_count matches suggestions.yaml length
   - suggestion-decisions reference valid suggestion IDs
4. Output recovery report with actions taken

### Recovery Markers
- `[PROGRESS: Recovery started for ${FEATURE_DIR}]`
- `[PROGRESS: Recovered ${FILE} from backup]`
- `[PROGRESS: Reconstructed ${FILE} from ${SOURCE}]`
- `[PROGRESS: Recovery complete: ${ACTIONS_COUNT} actions taken]`

## Manual Cache Refresh

Manually trigger cache validation and refresh:

### Usage
```
/poor-dev.suggest refresh-cache
```

### Refresh Process
1. Read current cache from `.poor-dev/cache/exploration-cache.yaml`
2. For each library in cache:
   a. Check GitHub API for last commit date
   b. Check OSV API for known vulnerabilities
   c. Update maintainability_score and security_score
   d. Tag stale libraries with [STALE] prefix
3. Remove libraries with scores < 50
4. Increment cache version
5. Create backup before writing updated cache
6. Output refresh report

### Refresh Markers
- `[PROGRESS: Cache refresh started: ${LIBRARY_COUNT} libraries]`
- `[PROGRESS: Validated ${LIBRARY_NAME}: maintainability=${SCORE}, security=${SCORE}]`
- `[PROGRESS: Cache refresh complete: ${UPDATED} updated, ${REMOVED} removed, ${STALE} stale]`

## Output Artifacts

**Files Created**:
1. `${FEATURE_DIR}/exploration-session.yaml` - Exploration session metadata
2. `${FEATURE_DIR}/suggestions.yaml` - Filtered suggestions array
3. `${FEATURE_DIR}/suggestion-decisions.yaml` - Developer decisions array

**Progress Markers** (all prefixed with `[PROGRESS: ...]`):
- `[PROGRESS: Initializing exploration session: ${ID}]`
- `[PROGRESS: GLM4.7 exploration started: ${TASK_ID}]`
- `[PROGRESS: Polling GLM4.7 exploration: ${ELAPSED}s elapsed]`
- `[PROGRESS: GLM4.7 exploration completed: ${COUNT} suggestions]`
- `[PROGRESS: Filtered suggestions: ${PASSED} passed, ${EXCLUDED} excluded]`
- `[PROGRESS: Output files written: ...]`
- `[PROGRESS: Suggestion phase complete: ...]`

## Non-Interactive Execution Constraints

**Mandatory for pipeline mode**:
- Use NON_INTERACTIVE_HEADER in GLM4.7 prompt
- Do NOT use AskUserQuestion at any point
- Bypass QuestionTools for all user interactions
- All decisions deferred to `pending` state
- Progress markers MUST be output even in non-interactive mode
- Timeout handling is MANDATORY (max 5 minutes)

**Fallback behavior in non-interactive**:
- Skip Tier 2 manual research fallback (requires user input)
- Proceed directly to Tier 3 (continue without suggestions)
- Log failure to `${FEATURE_DIR}/exploration-failures.log`

## Error Handling

**GLM4.7 dispatch failure**:
```
[ERROR: Failed to dispatch GLM4.7 exploration: ${ERROR_MESSAGE}]
→ Proceed to fallback (STEP 9)
```

**GLM4.7 timeout**:
```
[ERROR: GLM4.7 exploration timeout after 300 seconds]
→ Proceed to fallback (STEP 9)
```

**Invalid YAML output**:
```
[ERROR: Invalid YAML from GLM4.7: ${PARSE_ERROR}]
→ Proceed to fallback (STEP 9)
```

**Missing spec.md**:
```
[ERROR: spec.md not found in ${FEATURE_DIR}]
→ Exit with error
```

### Dashboard Update

Update living documents in `docs/`:

1. `mkdir -p docs`
2. Scan all `specs/*/` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → **Suggestion** → Planning → Tasks → Implementation → Review → Complete
4. Write `docs/progress.md`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)
