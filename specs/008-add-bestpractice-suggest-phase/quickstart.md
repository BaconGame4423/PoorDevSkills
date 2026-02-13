# Quickstart Guide: Best Practice and Tool Suggestion Phase

**Feature**: Best Practice and Tool Suggestion Phase
**Branch**: 008-add-bestpractice-suggest-phase
**Date**: 2026-02-12

## Overview

The suggestion phase is an automated step in the feature addition flow that provides best practice, tool, library, and usage pattern suggestions. GLM4.7 conducts exploration research and evaluates all suggestions for maintainability and security before presenting them to you.

## How It Works in Feature Addition Flow

```
1. /poor-dev.specify    → Create feature specification
2. /poor-dev.suggest     ← Run suggestion phase (NEW)
3. /poor-dev.plan        → Build technical plan
4. /poor-dev.tasks       → Decompose into tasks
5. /poor-dev.implement   → Implement feature
```

The suggestion phase runs automatically after specification and before planning, ensuring you have relevant recommendations before designing your implementation.

## Running the Suggestion Phase

### Basic Usage

```bash
# After creating spec in specs/008-add-bestpractice-suggest-phase/
/poor-dev.suggest specs/008-add-bestpractice-suggest-phase/spec.md

# Or specify the feature directory
/poor-dev.suggest specs/008-add-bestpractice-suggest-phase
```

### What Happens Under the Hood

1. **Session Initialization**: Creates exploration session with unique ID
2. **GLM4.7 Dispatch**: Sends research task to GLM4.7 with your spec context
3. **Adaptive Polling**: Monitors progress with 5-minute timeout
4. **Output Parsing**: Extracts structured suggestions from GLM4.7 YAML
5. **Threshold Filtering**: Excludes low-quality suggestions (< 50 scores)
6. **File Generation**: Writes 3 YAML files with results
7. **Decision Collection**: Prompts you to accept/reject suggestions (interactive)

## Generated Output Files

### 1. exploration-session.yaml

Metadata about the GLM4.7 exploration session.

```yaml
id: "660e8400-e29b-41d4-a716-446655440001"
feature_id: "008-add-bestpractice-suggest-phase"
status: completed
started_at: "2026-02-12T10:00:00Z"
completed_at: "2026-02-12T10:03:45Z"
findings_summary: "Identified 3 relevant libraries and 2 best practices. All suggested tools maintain active development and have no critical security issues."
suggestions_generated_count: 5
sources_consulted:
  - "https://zod.dev/docs/intro"
  - "https://github.com/colinhacks/zod"
failure_reason: null
```

### 2. suggestions.yaml

Array of suggested best practices, tools, libraries, and usage patterns.

```yaml
- id: "550e8400-e29b-41d4-a716-446655440000"
  type: library
  name: "Zod"
  description: "TypeScript-first schema validation library with static type inference"
  rationale: "Provides runtime validation that matches TypeScript types, reducing type mismatches"
  maintainability_score: 92
  security_score: 95
  source_urls:
    - "https://zod.dev"
    - "https://github.com/colinhacks/zod"
  adoption_examples:
    - "Remix Framework"
    - "T3 Stack"
  evidence:
    - "Monthly releases with active contributors"
    - "No known CVEs in last 12 months"
    - "Used by 500K+ projects on npm"
  created_at: "2026-02-12T10:00:00Z"

- id: "550e8400-e29b-41d4-a716-446655440001"
  type: best_practice
  name: "Early Return Pattern"
  description: "Return early from functions when conditions are not met, reducing nesting"
  rationale: "Improves code readability and reduces cognitive load in complex logic"
  maintainability_score: 100
  security_score: 100
  source_urls:
    - "https://eslint.org/docs/latest/rules/no-else-return"
  adoption_examples:
    - "Node.js core codebase"
    - "Vue.js codebase"
  evidence:
    - "Well-documented in clean code literature"
    - "Standard in TypeScript codebases"
  created_at: "2026-02-12T10:00:00Z"
```

### 3. suggestion-decisions.yaml

Records your accept/reject decisions for traceability.

```yaml
- id: "770e8400-e29b-41d4-a716-446655440000"
  suggestion_id: "550e8400-e29b-41d4-a716-446655440000"
  feature_id: "008-add-bestpractice-suggest-phase"
  decision: accepted
  reason: "Matches our TypeScript-first approach and team has prior experience"
  decided_at: "2026-02-12T10:10:00Z"

- id: "770e8400-e29b-41d4-a716-446655440001"
  suggestion_id: "550e8400-e29b-41d4-a716-446655440001"
  feature_id: "008-add-bestpractice-suggest-phase"
  decision: rejected
  reason: "Already using this pattern in codebase"
  decided_at: "2026-02-12T10:11:00Z"
```

## Understanding Maintainability and Security Scores

### Maintainability Score (0-100)

Indicates how actively maintained a tool/library is.

**Score Calculation**:
| Metric | Weight | Criteria |
|--------|--------|----------|
| Commit recency | 30% | Last commit < 6mo (30), < 12mo (20), < 18mo (10), older (0) |
| Issue resolution | 30% | > 90% resolved (30), > 70% (20), > 50% (10), ≤ 50% (0) |
| Contributors | 20% | ≥ 5 active (20), ≥ 3 (15), ≥ 1 (10), none (0) |
| Documentation | 20% | Complete + examples (20), complete (15), minimal (10), none (0) |

**Score Bands**:
- **90-100**: Very active - Excellent choice
- **70-89**: Active - Good choice
- **50-69**: Moderate - Use with caution
- **0-49**: Low - Excluded

**Example**: Zod scores 92/100:
- Commits: 30/30 (active monthly releases)
- Issues: 28/30 (high resolution rate)
- Contributors: 18/20 (many active maintainers)
- Docs: 16/20 (excellent documentation)

### Security Score (0-100)

Indicates security posture and risk level.

**Score Calculation**:
| Metric | Weight | Criteria |
|--------|--------|----------|
| Known CVEs | 40% | None (40), non-critical only (20), critical (0) |
| Security audit | 30% | Recent audit passed (30), old audit (15), none (0) |
| Dependencies | 20% | All up-to-date (20), some outdated (10), critical outdated (0) |
| Code quality | 10% | High coverage + linter (10), medium (5), low (0) |

**Score Bands**:
- **90-100**: Secure - Recommended
- **70-89**: Mostly secure - Generally safe
- **50-69**: Some concerns - Evaluate carefully
- **0-49**: Risky - Excluded

**Example**: Zod scores 95/100:
- CVEs: 40/40 (no known CVEs)
- Audit: 25/30 (recent code review)
- Dependencies: 20/20 (well-maintained deps)
- Quality: 10/10 (high test coverage)

### Threshold Rules

**Inclusion**: Both scores must be >= 50
**Exclusion**: Any score < 50 → excluded
**Warnings**:
- `[RISK]` prefix: One score >= 75, other < 60
- `[CAUTION]` prefix: One or both scores in 50-59 range

## User Confirmation Flow

### Interactive Mode

When running interactively, suggestions are presented for review:

```
# Suggestion Phase Results

## Exploration Summary
**Status**: completed
**Suggestions Found**: 2
**Time**: 3m 45s

Identified 2 relevant libraries for authentication feature. Both maintain active development and have no critical security issues.

---

## Suggestions

### Zod (library)
**Description**: TypeScript-first schema validation library with static type inference

**Rationale**: Provides runtime validation that matches TypeScript types, reducing type mismatches

**Scores**:
- Maintainability: 92/100
- Security: 95/100

**Evidence**:
- Monthly releases with active contributors
- No known CVEs in last 12 months
- Used by 500K+ projects on npm

**Sources**:
- https://zod.dev
- https://github.com/colinhacks/zod

**Adoption Examples**:
- Remix Framework
- T3 Stack

---

**Decision**:
- [ ] Accept - Include this suggestion in the feature
- [ ] Reject - Skip this suggestion
- [ ] Defer - Decide later
```

**Bypass QuestionTools**: The confirmation is handled by the orchestrator, not the QuestionTools system. This allows for cleaner integration with the pipeline flow.

### Non-Interactive Mode (Pipeline)

When run as part of an automated pipeline:
- All decisions are set to `pending`
- Review happens later in the planning phase
- Progress markers still output for tracking

```
[PROGRESS: Non-interactive mode - decisions deferred to later phase]
```

## Troubleshooting

### Issue: GLM4.7 Exploration Fails

**Symptom**: `[ERROR: GLM4.7 exploration timeout after 300 seconds]`

**Solutions**:
1. **Check WebFetch availability**: Ensure GLM4.7 has access to WebFetch tool
2. **Verify network connectivity**: Check internet access for research
3. **Review spec complexity**: Complex features may need more time (adjust timeout in config)
4. **Use fallback**: System automatically falls back to cache or manual mode

### Issue: No Suggestions Found

**Symptom**: `suggestions.yaml` is empty

**Solutions**:
1. **Check findings_summary**: See why GLM4.7 found no suggestions
2. **Review spec.md**: Ensure spec provides enough context for relevant suggestions
3. **Manual input**: Use Tier 2 fallback to provide your own suggestions
4. **Accept and proceed**: It's okay to have no suggestions for standard patterns

### Issue: All Suggestions Excluded

**Symptom**: `[PROGRESS: Filtered suggestions: 0 passed, 5 excluded]`

**Solutions**:
1. **Check scores**: Examine `exploration-session.yaml` for original scores
2. **Review thresholds**: Current threshold is >= 50 for both scores
3. **Consider adjusting**: For experimental features, you may accept lower scores
4. **Manual override**: Add suggestions manually to `suggestions.yaml`

### Issue: YAML Parse Errors

**Symptom**: `[ERROR: Invalid YAML output from GLM4.7 exploration]`

**Solutions**:
1. **Check GLM4.7 output**: Review raw output in task logs
2. **Report bug**: If output format is incorrect, report as bug
3. **Use fallback**: System automatically falls back to cache/manual
4. **Retry**: May be temporary GLM4.7 issue

### Issue: Decision Collection Skipped

**Symptom**: Running interactively but no prompts for decisions

**Possible Causes**:
1. **Non-interactive mode**: Pipeline mode defers all decisions
2. **Empty suggestions**: No suggestions to decide on
3. **Config override**: Check `.poor-dev/config.json` for mode settings

**Solution**:
- Run `/poor-dev.suggest` without pipeline flags for interactive mode
- Or review and decide later when viewing `suggestions.yaml`

## Configuration

### Config File: `.poor-dev/config.json`

```json
{
  "default": {
    "cli": "opencode",
    "model": "zai-coding-plan/glm-4.7"
  },
  "overrides": {
    "suggest": {
      "model": "zai-coding-plan/glm-4.7"
    }
  },
  "polling": {
    "interval": 1,
    "idle_timeout": 120,
    "max_timeout": 300
  }
}
```

### Adjusting Timeout

For complex features needing more research time:

```json
{
  "polling": {
    "max_timeout": 600  // 10 minutes instead of 5
  }
}
```

### Changing Model

If GLM4.7 is unavailable:

```json
{
  "overrides": {
    "suggest": {
      "model": "claude-3-opus-20240229"
    }
  }
}
```

Note: Research findings may vary by model capabilities.

## Best Practices

1. **Review scores critically**: High scores are indicators, not guarantees
2. **Check source URLs**: Verify claims by reviewing linked documentation
3. **Consider team expertise**: Even great suggestions may not fit your team's skills
4. **Document rejections**: Use the `reason` field for future reference
5. **Iterate**: Run suggestion phase again if spec changes significantly

## Next Steps

After reviewing suggestions:

```bash
# Proceed to planning phase with accepted suggestions
/poor-dev.plan specs/008-add-bestpractice-suggest-phase/spec.md

# The planner will consider your accepted suggestions when designing the implementation
```

The suggestion decisions are automatically available to the planning phase through `suggestion-decisions.yaml`.

## References

- **Data Model**: `/specs/008-add-bestpractice-suggest-phase/data-model.md`
- **Command Contract**: `/commands/poor-dev.suggest.md`
- **Specification**: `/specs/008-add-bestpractice-suggest-phase/spec.md`
- **Research**: `/specs/008-add-bestpractice-suggest-phase/research.md`
