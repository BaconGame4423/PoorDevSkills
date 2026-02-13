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

## Backup and Recovery Procedures

### Automatic Backups

All YAML state files are automatically backed up before any write operation:

```bash
# Backup location
specs/008-add-bestpractice-suggest-phase/.backups/

# Files backed up
- exploration-session-<timestamp>.yaml
- suggestions-<timestamp>.yaml
- suggestion-decisions-<timestamp>.yaml
```

**Backup naming**: `<filename>-<ISO8601_timestamp>.yaml` (e.g., `suggestions-20260212T103045Z.yaml`)

**Retention**: Last 5 backups retained, older than 7 days removed automatically

### Manual Recovery

If a YAML file becomes corrupted:

```bash
# Run recovery command
/poor-dev.suggest recover

# Recovery process:
# 1. Detects corrupted files
# 2. Restores from most recent backup
# 3. If no backup, reconstructs from related files
# 4. Verifies cross-file consistency
```

**Manual restoration from specific backup**:

```bash
# List available backups
ls -lt specs/008-add-bestpractice-suggest-phase/.backups/

# Copy specific backup to restore
cp specs/008-add-bestpractice-suggest-phase/.backups/suggestions-20260212T103045Z.yaml \
   specs/008-add-bestpractice-suggest-phase/suggestions.yaml
```

### Common Corruption Scenarios

**Scenario 1: suggestion-decisions.yaml corrupted**
- Recovery automatically rebuilds from suggestions.yaml
- All decisions reset to `pending`
- Re-run decision collection to restore choices

**Scenario 2: suggestions.yaml corrupted**
- Restores from `.backups/` directory
- If no backup: uses exploration-session.yaml to determine suggestion count
- May require re-running suggest phase

**Scenario 3: exploration-session.yaml corrupted**
- Restores from backup
- If no backup: cannot recover session metadata
- Re-run suggest phase to create new session

## Cache Refresh Procedures

### Automatic Cache Validation

Cache is validated monthly based on `last_updated` timestamp:

```yaml
# .poor-dev/cache/exploration-cache.yaml
version: "1.0.0"
last_updated: "2026-02-12T10:00:00Z"
categories:
  testing_frameworks:
    - name: Jest
      maintainability_score: 92
      security_score: 95
```

**Freshness check**: If `last_updated` is >= 30 days old, cache is considered stale

### Manual Cache Refresh

Force refresh to update all library scores:

```bash
/poor-dev.suggest refresh-cache

# Refresh process:
# 1. Reads current cache
# 2. Checks GitHub API for last commit dates
# 3. Checks OSV API for vulnerabilities
# 4. Updates maintainability/security scores
# 5. Tags stale libraries with [STALE] prefix
# 6. Removes libraries with scores < 50
# 7. Creates backup before writing updated cache
```

**When to refresh**:
- Monthly (automatic based on freshness check)
- After major security announcements
- When library recommendations seem outdated
- Before starting critical features

**Cache refresh output**:
```
[PROGRESS: Cache refresh started: 45 libraries]
[PROGRESS: Validated Jest: maintainability=92, security=95]
[PROGRESS: Validated Mocha: maintainability=88, security=90]
[PROGRESS: Cache refresh complete: 42 updated, 3 removed, 1 stale]
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

## Escalation Paths for Failures

### Level 1: Retry with Increased Timeout

If suggestion phase times out during complex research:

```json
// Edit .poor-dev/config.json
{
  "polling": {
    "max_timeout": 600  // Increase from 300s to 10 minutes
  }
}
```

Then re-run: `/poor-dev.suggest specs/008-add-bestpractice-suggest-phase`

### Level 2: Model Fallback

If GLM4.7 is unavailable or consistently failing:

```json
// Edit .poor-dev/config.json
{
  "overrides": {
    "suggest": {
      "model": "claude-3-opus-20240229"  // Fallback to Claude Opus
    }
  }
}
```

Note: Research quality may differ between models.

### Level 3: Manual Research Mode

If automated exploration fails repeatedly:

1. Skip automated exploration
2. Use manual suggestion addition (STEP 8b in command contract)
3. Provide your own research findings:
   ```yaml
   - id: <generate UUID>
     type: library
     name: "Your Library"
     description: "..."
     rationale: "..."
     maintainability_score: 85
     security_score: 90
     source: "manual"
   ```

### Level 4: Continue Without Suggestions

If no suggestions are needed or research is blocked:

```bash
# Accept empty suggestion set
/poor-dev.suggest specs/008-add-bestpractice-suggest-phase

# When prompted "No suggestions found", select:
# [ ] Continue without suggestions

# Or manually create empty files:
echo '[]' > specs/008-add-bestpractice-suggest-phase/suggestions.yaml
echo '[]' > specs/008-add-bestpractice-suggest-phase/suggestion-decisions.yaml
```

### Level 5: Skip Suggestion Phase

For standard features not requiring specialized tools:

```bash
# Go directly to planning
/poor-dev.plan specs/008-add-bestpractice-suggest-phase/spec.md

# Planning phase will proceed without suggestion context
```

### Escalation Decision Tree

```
GLM4.7 Timeout
  ↓
[L1] Retry with increased timeout (600s)
  ↓ (if still fails)
[L2] Switch to Claude Opus model
  ↓ (if unavailable)
[L3] Manual research mode
  ↓ (if blocked)
[L4] Continue without suggestions
  ↓ (if unnecessary)
[L5] Skip suggestion phase entirely
```

## WSL 2 Ubuntu Setup Notes

### Prerequisites

Ensure required tools are installed in WSL 2 Ubuntu:

```bash
# Check Node.js (for .mjs modules)
node --version  # Should be >= 18.0.0

# Check curl (for API calls)
which curl

# Check opencode or claude CLI
which opencode
which claude
```

### WSL 2 Specific Configuration

```json
// .poor-dev/config.json
{
  "default": {
    "cli": "opencode",  // Recommended for WSL 2
    "model": "zai-coding-plan/glm-4.7"
  },
  "polling": {
    "interval": 2,       // Slightly longer due to WSL overhead
    "idle_timeout": 150,
    "max_timeout": 360
  }
}
```

### File System Performance

WSL 2 has slower I/O for Windows file system paths. Store project in WSL native file system:

```bash
# Good: WSL native (fast)
/home/bacon/DevSkills/

# Avoid: Windows file system via /mnt/c (slow)
/mnt/c/Users/bacon/DevSkills/
```

### Network Access

Ensure WSL 2 has internet access for GitHub and OSV APIs:

```bash
# Test GitHub API
curl -I https://api.github.com

# Test OSV API
curl -I https://api.osv.dev

# If blocked, check Windows firewall settings
```

### Common WSL 2 Issues

**Issue**: `node: command not found`
```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
```

**Issue**: API timeouts in WSL 2
- Increase timeout values in config
- Check DNS resolution: `cat /etc/resolv.conf`
- Restart WSL: `wsl --shutdown` (from Windows PowerShell)

**Issue**: Permission errors on .mjs files
```bash
# Ensure execute permissions
chmod +x lib/*.mjs
```

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
