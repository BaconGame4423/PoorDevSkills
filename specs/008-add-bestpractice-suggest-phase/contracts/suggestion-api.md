# Suggestion API Contract

**Feature**: Best Practice and Tool Suggestion Phase
**Version**: 1.0.0
**Date**: 2026-02-12

## Overview

This contract defines the API for the suggestion phase command (`/poor-dev.suggest`), which provides vetted best practices, tools, libraries, and usage patterns to developers during feature addition flow.

## Command Interface

### Command Name
`/poor-dev.suggest`

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `FEATURE_DIR` | string | Yes | Path to feature specification directory |
| `spec.md` | string | No* | Path to feature spec file (default: `${FEATURE_DIR}/spec.md`) |
| `plan.md` | string | No | Path to implementation plan (optional for context) |

*Required if not running in pipeline mode (FEATURE_DIR is sufficient)

### Input Validation

- `FEATURE_DIR` must exist and be a directory
- `FEATURE_DIR/spec.md` must exist and be readable
- `spec.md` must contain valid feature specification

## Execution Flow

```
1. Config Resolution
   ↓
2. Session Initialization
   ↓
3. GLM4.7 Exploration Dispatch
   ↓
4. Adaptive Polling (with [PROGRESS] markers)
   ↓
5. Output Parsing (YAML)
   ↓
6. Threshold Filtering (maintainability >= 50 AND security >= 50)
   ↓
7. File Generation (3 YAML files)
   ↓
8. Decision Collection (user interaction)
   ↓
9. Fallback Handling (if needed)
   ↓
10. Completion
```

## Progress Markers

### Mandatory Markers

All progress markers follow `[PROGRESS: step-name description]` format:

| Marker | Phase | Description |
|--------|--------|-------------|
| `[PROGRESS: suggest reading-spec]` | Init | Reading feature specification |
| `[PROGRESS: suggest initializing-session]` | Init | Creating exploration session |
| `[PROGRESS: suggest dispatching-exploration]` | Exploration | Dispatching GLM4.7 task |
| `[PROGRESS: suggest polling-active]` | Polling | GLM4.7 exploration in progress |
| `[PROGRESS: suggest parsing-results]` | Parsing | Parsing GLM4.7 YAML output |
| `[PROGRESS: suggest validating-structure]` | Parsing | Validating YAML structure |
| `[PROGRESS: suggest filtering-suggestions]` | Filtering | Applying threshold filters |
| `[PROGRESS: suggest saving-artifacts]` | Output | Writing YAML files |
| `[PROGRESS: suggest collecting-decisions]` | Review | Prompting for user decisions |
| `[PROGRESS: suggest complete]` | Complete | Phase finished |

### Error Markers

Error markers stop execution:

| Marker | Condition |
|--------|-----------|
| `[ERROR: spec.md not found]` | spec.md missing |
| `[ERROR: invalid YAML from GLM4.7]` | YAML parse failed |
| `[ERROR: GLM4.7 exploration timeout]` | 5-minute timeout exceeded |
| `[ERROR: no relevant suggestions]` | Empty suggestions after filtering |

## Output Artifacts

### 1. exploration-session.yaml

**Location**: `${FEATURE_DIR}/exploration-session.yaml`

**Purpose**: Complete exploration session metadata

**Required Fields**:
```yaml
exploration_session:
  id: <UUID v4>
  feature_id: <string>
  status: completed|in_progress|pending|failed
  started_at: <ISO8601>
  completed_at: <ISO8601|null>
  findings_summary: <string, 100-500 chars>
  suggestions_generated_count: <number, >= 0>
  sources_consulted: <string[], may be empty>
  failure_reason: <string|null>
```

**Validation Rules**:
- `id` must be valid UUID v4
- `status` must be one of enum values
- `completed_at` must be >= `started_at` if not null
- `findings_summary` length: 100-500 characters
- `suggestions_generated_count` >= 0

### 2. suggestions.yaml

**Location**: `${FEATURE_DIR}/suggestions.yaml`

**Purpose**: Filtered array of suggestions for user review

**Structure**:
```yaml
exploration_session:
  id: <UUID v4>
  started_at: <ISO8601>
  completed_at: <ISO8601>
  status: completed
  findings_summary: <string>

suggestions:
  - id: <UUID v4>
    type: best_practice|tool|library|usage_pattern
    name: <string>
    description: <string>
    rationale: <string>
    maintainability_score: <number, 0-100>
    security_score: <number, 0-100>
    source_urls:
      - <url>
    adoption_examples:
      - <string>
    evidence:
      - <string>
    created_at: <ISO8601>

filtered_count: <number>
total_explored: <number>
excluded_count: <number>
excluded_reasons:
  - <string>
```

**Validation Rules**:
- All suggestions must have `maintainability_score >= 50 AND security_score >= 50`
- `source_urls` must contain at least 1 valid URL
- `type` must be one of enum values
- Scores must be 0-100

### 3. suggestion-decisions.yaml

**Location**: `${FEATURE_DIR}/suggestion-decisions.yaml`

**Purpose**: Record user acceptance/rejection decisions

**Structure**:
```yaml
session_id: <UUID v4>
decided_at: <ISO8601|null>
decisions:
  - id: <UUID v4>
    suggestion_id: <UUID v4>
    feature_id: <string>
    decision: accepted|rejected|pending
    reason: <string>
    decided_at: <ISO8601|null>

summary:
  total: <number>
  accepted: <number>
  rejected: <number>
  pending: <number>
  manual_additions: <number>
```

**Validation Rules**:
- `suggestion_id` must reference existing Suggestion.id
- `decision` must be one of enum values
- `summary.total` must equal `len(decisions)`

## Non-Interactive Execution

### QuestionTools Bypass

When running as pipeline sub-agent:

**Do NOT**:
- Use `AskUserQuestion` directly
- Execute gate checks
- Update dashboard

**DO**:
- Use `[NEEDS CLARIFICATION: question]` markers for user questions
- Rely on orchestrator to relay questions to user
- Output structured artifacts only

### Fallback Handling

**Tier 1: Cache**
- Check `${FEATURE_DIR}/exploration-cache.yaml`
- Use cached suggestions if relevant
- Report: "⚠ GLM4.7探索失敗。キャッシュから候補を提示します。"

**Tier 2: Manual**
- Prompt user for manual input
- Options: "はい、手動で候補を提供する" / "いいえ、提案なしで進む"
- Log to `${FEATURE_DIR}/exploration-failures.log`

**Tier 3: Continue**
- Create empty suggestions.yaml
- Report: "提案なしでプランフェーズに進みます。"
- Continue to next pipeline step

## Configuration

### Required Config

`.poor-dev/config.json`:

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
  "fallback_model": "haiku",
  "polling": {
    "interval": 1,
    "idle_timeout": 120,
    "max_timeout": 300
  }
}
```

### Config Resolution Priority

```
overrides.suggest → overrides.default → built-in default
```

### Timeout Configuration

- `polling.max_timeout`: Absolute timeout for GLM4.7 exploration (default: 300s = 5min)
- `polling.idle_timeout`: Output idle timeout before kill (default: 120s = 2min)
- `polling.interval`: Polling interval in seconds (default: 1s)

## Error Handling

### Error Responses

| Error Condition | Response | Action |
|----------------|-----------|--------|
| spec.md not found | `[ERROR: spec.md not found at ${FEATURE_DIR}]` | Stop execution |
| Invalid YAML | `[ERROR: Invalid YAML output from GLM4.7 exploration]` | Trigger fallback |
| Exploration timeout | `[ERROR: GLM4.7 exploration timeout after ${elapsed}s]` | Trigger fallback |
| No suggestions | `[PROGRESS: No relevant suggestions found]` | Create empty suggestions.yaml |
| All excluded | `[PROGRESS: Filtered 0 suggestions from ${total} explored]` | Create empty suggestions.yaml |

### Recovery Strategies

1. **YAML Parse Error**: Fallback to cache → manual → continue
2. **Timeout Error**: Fallback to cache → manual → continue
3. **Network Error**: Retry once → fallback
4. **GLM4.7 Unavailable**: Use fallback_model (haiku)

## Success Criteria

### Functional Requirements (from spec.md)

- **FR-001**: ✅ Integrated into feature addition pipeline
- **FR-002**: ✅ Uses GLM4.7 for exploration research
- **FR-003**: ✅ Evaluates maintainability (activity, update frequency, engagement)
- **FR-004**: ✅ Evaluates security (CVEs, audits, code quality)
- **FR-005**: ✅ Presents structured information (type, description, rationale, scores)
- **FR-006**: ✅ Excludes tools/libraries with scores < 50
- **FR-007**: ✅ Allows developers to accept/reject individual suggestions
- **FR-008**: ✅ Records decisions for traceability (suggestion-decisions.yaml)
- **FR-009**: ✅ Provides status updates during exploration ([PROGRESS] markers)
- **FR-010**: ✅ Handles failures gracefully with fallback options

### Performance Requirements

- **SC-005**: ⚡ Complete exploration within 5 minutes (300s timeout)
- Target: 3-4 minutes for typical features

### Quality Requirements

- 80% of features receive at least one suggestion (SC-001)
- 90% of suggested tools/libraries have maintainability > 70 and security > 80 (SC-002)

## Version History

| Version | Date | Changes |
|---------|-------|---------|
| 1.0.0 | 2026-02-12 | Initial version |
