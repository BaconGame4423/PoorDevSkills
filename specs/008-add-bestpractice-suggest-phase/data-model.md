# Data Model: Best Practice and Tool Suggestion Phase

**Feature**: Best Practice and Tool Suggestion Phase
**Branch**: 008-add-bestpractice-suggest-phase
**Date**: 2026-02-12

## Overview

This document defines the data model for the suggestion phase feature, which provides best practice, tool, library, and usage pattern suggestions during feature addition flow. The model supports GLM4.7 exploration research, maintainability and security validation, and developer decision tracking.

## Entities

### Suggestion

Represents a recommended best practice, tool, library, or usage pattern for a feature.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | - | Unique identifier (UUID v4) |
| `type` | SuggestionType | Yes | - | Suggestion category |
| `name` | string | Yes | - | Human-readable name |
| `description` | string | Yes | - | 2-3 sentence description |
| `rationale` | string | Yes | - | Why relevant to the feature |
| `maintainability_score` | number | Yes | - | Maintainability score (0-100) |
| `security_score` | number | Yes | - | Security score (0-100) |
| `source_urls` | string[] | Yes | - | Supporting documentation URLs |
| `adoption_examples` | string[] | Yes | - | Example projects using this |
| `evidence` | string[] | Yes | - | Evidence points for recommendation |
| `created_at` | string | Yes | - | ISO8601 timestamp |

**SuggestionType Enum**:
- `'best_practice'`: Coding or architectural best practice
- `'tool'`: Development or deployment tool
- `'library'`: External library or framework
- `'usage_pattern'`: Usage pattern or paradigm

**Validation Rules**:
- `id` must be valid UUID v4 format
- `maintainability_score` must be 0-100
- `security_score` must be 0-100
- `source_urls` must contain at least 1 valid URL
- `type` must be one of enum values
- Both scores must be >= 50 to be included (FR-006 threshold)

**State Transitions**: None (immutable after creation)

**Example**:
```yaml
id: "550e8400-e29b-41d4-a716-446655440000"
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
```

### ExplorationSession

Represents a GLM4.7 exploration phase execution for a feature.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | - | Unique session identifier (UUID v4) |
| `feature_id` | string | Yes | - | Feature branch identifier (e.g., "008-suggest-phase") |
| `status` | ExplorationStatus | Yes | 'pending' | Current session status |
| `started_at` | string | Yes | - | ISO8601 timestamp when started |
| `completed_at` | string \| null | Yes | null | ISO8601 timestamp when completed |
| `findings_summary` | string | Yes | - | 3-4 sentence summary of findings |
| `suggestions_generated_count` | number | Yes | 0 | Number of suggestions generated |
| `sources_consulted` | string[] | No | [] | URLs of sources researched |
| `failure_reason` | string \| null | No | null | Error details if status is 'failed' |

**ExplorationStatus Enum**:
- `'pending'`: Session created, not started
- `'in_progress'`: GLM4.7 actively researching
- `'completed'`: Exploration finished successfully
- `'failed'`: Exploration failed or timed out

**State Transitions**:
```
pending → in_progress (exploration started)
  in_progress → completed (successful completion)
  in_progress → failed (timeout, error, or cancellation)
completed, failed → terminal (no further transitions)
```

**Validation Rules**:
- `id` must be valid UUID v4
- `completed_at` must be >= `started_at` if not null
- `suggestions_generated_count` must be >= 0
- `status` transitions must follow state machine
- If `status` is 'failed', `failure_reason` must be non-empty
- `findings_summary` must be 100-500 characters

**Example**:
```yaml
id: "660e8400-e29b-41d4-a716-446655440001"
feature_id: "008-suggest-phase"
status: completed
started_at: "2026-02-12T10:00:00Z"
completed_at: "2026-02-12T10:03:45Z"
findings_summary: "Identified 3 relevant libraries and 2 best practices. All suggested tools maintain active development and have no critical security issues."
suggestions_generated_count: 5
sources_consulted:
  - "https://zod.dev/docs/intro"
  - "https://github.com/colinhacks/zod"
  - "https://nodejs.org/api/async_hooks.html"
failure_reason: null
```

### SuggestionDecision

Records developer's decision on a suggestion for traceability and learning.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | - | Unique identifier (UUID v4) |
| `suggestion_id` | string | Yes | - | Reference to Suggestion.id |
| `feature_id` | string | Yes | - | Feature branch identifier |
| `decision` | DecisionType | Yes | 'pending' | Developer's decision |
| `reason` | string | No | "" | Optional explanation |
| `decided_at` | string \| null | Yes | null | ISO8601 timestamp |

**DecisionType Enum**:
- `'accepted'`: Suggestion adopted for the feature
- `'rejected'`: Suggestion declined
- `'pending'`: Not yet decided (initial state)

**State Transitions**:
```
pending → accepted (developer accepts suggestion)
  pending → rejected (developer rejects suggestion)
accepted, rejected → terminal (no further transitions)
```

**Validation Rules**:
- `id` must be valid UUID v4
- `suggestion_id` must reference existing Suggestion.id
- `feature_id` must match ExplorationSession.feature_id
- `decided_at` must be >= suggestion `created_at` if not null
- If `decision` is not 'pending', `decided_at` must be non-null

**Example**:
```yaml
id: "770e8400-e29b-41d4-a716-446655440002"
suggestion_id: "550e8400-e29b-41d4-a716-446655440000"
feature_id: "008-suggest-phase"
decision: accepted
reason: "Matches our TypeScript-first approach and team has prior experience"
decided_at: "2026-02-12T10:10:00Z"
```

## Relationships

```
ExplorationSession
  ├─ generates → Suggestion[]
  └─ feature_id matches → Feature branch

Suggestion
  └─ receives → SuggestionDecision

SuggestionDecision
  └─ references → Suggestion (via suggestion_id)
```

## Data Flow

```
1. Feature Specification Created
   spec.md exists in FEATURE_DIR

2. Suggestion Phase Triggered
   FEATURE_DIR + spec.md → ExplorationSession (status: pending)

3. GLM4.7 Exploration Dispatch
   ExplorationSession → Task(suggestion-exploration) → Research

4. Research Output Parsed
   GLM4.7 YAML output → ExplorationSession (status: completed)
                           + Suggestion[] (filtered by thresholds)

5. Developer Review
   Suggestion[] → SuggestionDecision[] (per suggestion)

6. Artifacts Stored
   - FEATURE_DIR/exploration-session.yaml
   - FEATURE_DIR/suggestions.yaml
   - FEATURE_DIR/suggestion-decisions.yaml
```

## Storage

**In-memory**:
- ExplorationSession (during execution)
- Suggestion[] (during parsing and validation)
- SuggestionDecision[] (during review)

**Disk (YAML files)**:
- `${FEATURE_DIR}/exploration-session.yaml` - ExplorationSession entity
- `${FEATURE_DIR}/suggestions.yaml` - Array of Suggestion entities
- `${FEATURE_DIR}/suggestion-decisions.yaml` - Array of SuggestionDecision entities

**No database** - All state stored as YAML in feature directories

## YAML File Structures

### exploration-session.yaml

```yaml
id: <UUID>
feature_id: <branch_name>
status: completed|in_progress|pending|failed
started_at: <ISO8601>
completed_at: <ISO8601|null>
findings_summary: <text>
suggestions_generated_count: <number>
sources_consulted:
  - <url>
failure_reason: <text|null>
```

### suggestions.yaml

```yaml
- id: <UUID>
  type: best_practice|tool|library|usage_pattern
  name: <name>
  description: <text>
  rationale: <text>
  maintainability_score: <0-100>
  security_score: <0-100>
  source_urls:
    - <url>
  adoption_examples:
    - <project>
  evidence:
    - <point>
  created_at: <ISO8601>
```

### suggestion-decisions.yaml

```yaml
- id: <UUID>
  suggestion_id: <UUID>
  feature_id: <branch_name>
  decision: accepted|rejected|pending
  reason: <text>
  decided_at: <ISO8601|null>
```

## Validation Summary

| Entity | Validation Focus |
|--------|------------------|
| Suggestion | Score thresholds (>= 50), valid URLs, required fields |
| ExplorationSession | Valid state transitions, timestamp ordering |
| SuggestionDecision | Valid references, decision timestamp ordering |
| All | UUID format, ISO8601 timestamps, enum values |

## Scoring Algorithms

### Maintainability Score (0-100)

**Metrics**:
- Commit recency (0-30 points)
  - Last commit < 6 months: 30
  - Last commit < 12 months: 20
  - Last commit < 18 months: 10
  - Last commit >= 18 months: 0
- Issue resolution rate (0-30 points)
  - > 90% resolved: 30
  - > 70% resolved: 20
  - > 50% resolved: 10
  - <= 50% resolved: 0
- Contributor activity (0-20 points)
  - Active contributors >= 5: 20
  - Active contributors >= 3: 15
  - Active contributors >= 1: 10
  - No active contributors: 0
- Documentation quality (0-20 points)
  - Complete docs + examples: 20
  - Complete docs: 15
  - Minimal docs: 10
  - No docs: 0

**Score Bands**:
- 90-100: Very active
- 70-89: Active
- 50-69: Moderate
- 0-49: Low (excluded)

### Security Score (0-100)

**Metrics**:
- Known vulnerabilities (0-40 points)
  - No CVEs: 40
  - Non-critical CVEs only: 20
  - Critical CVEs: 0
- Security audit status (0-30 points)
  - Recent audit passed: 30
  - Old audit: 15
  - No audit: 0
- Dependency health (0-20 points)
  - All dependencies up-to-date: 20
  - Some outdated: 10
  - Critical outdated deps: 0
- Code quality indicators (0-10 points)
  - High test coverage + linter: 10
  - Medium quality: 5
  - Low quality: 0

**Score Bands**:
- 90-100: Secure
- 70-89: Mostly secure
- 50-69: Some concerns
- 0-49: Risky (excluded)

## Threshold Rules

**Inclusion Threshold** (FR-006):
- `maintainability_score >= 50 AND security_score >= 50`

**Warning Rules**:
- Mixed scores (one >= 75, other < 60) → flag with `[RISK]` prefix
- Scores in 50-59 range → flag with `[CAUTION]` prefix

**Exclusion Rules**:
- Either score < 50 → exclude entirely
- Critical CVEs present → exclude regardless of score

## Performance Considerations

**Memory**:
- ExplorationSession: Single entity, negligible memory
- Suggestion[]: Limited to ~20 suggestions, minimal memory
- YAML parsing: Standard library, optimized

**CPU**:
- Score calculation: O(n) where n = number of suggestions
- WebFetch research: Bounded by 5-minute timeout
- Validation: Simple checks, minimal overhead

**I/O**:
- Reading spec.md: Single file read
- Writing 3 YAML files: 3 writes at completion
- No intermediate files

**Network**:
- WebFetch requests: Unbounded but timeout limited
- Fallback available if WebFetch fails

## Extension Points

**Future Enhancements**:
1. Per-feature score thresholds (configurable per feature type)
2. Suggestion categorization by technology stack
3. Machine learning-based scoring from historical data
4. Suggestion impact estimation (implementation effort)
5. Integration with package manager APIs (npm, PyPI, crates.io)

## References

- Spec: `/specs/008-add-bestpractice-suggest-phase/spec.md`
- Research: `/specs/008-add-bestpractice-suggest-phase/research.md`
- Command: `/commands/poor-dev.suggest.md`
