# Implementation Plan: Best Practice and Tool Suggestion Phase

**Branch**: `008-add-bestpractice-suggest-phase` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-add-bestpractice-suggest-phase/spec.md`

## Executive Summary

**Objective**: Add a new "suggestion phase" to the feature addition pipeline that provides vetted best practices, tools, libraries, and usage patterns. The suggestion phase will be automatically triggered after specification, use GLM4.7 for exploration research, validate maintainability and security of all suggestions, and present filtered candidates to developers for selection via QuestionTools.

**Key Benefits**:
- **Time Savings**: Reduces manual research time from 72 minutes to 20 minutes per feature (52-minute savings)
- **Quality Improvement**: 85% reduction in bad/abandoned dependencies introduced
- **Security Enhancement**: Zero critical security incidents through automated CVE checking
- **Developer Experience**: Provides actionable, vetted recommendations with clear rationale

**Implementation Approach**:
- **Technology**: JavaScript (Node.js 18+) with GLM4.7 for AI-driven exploration
- **Timeline**: 14-day implementation (Phase 2: Feb 17 - Mar 2, 2026)
- **Integration**: Seamless integration with existing pipeline (specify → suggest → plan)
- **Platform**: CLI tool with WSL 2 support on Windows (MVP scope)

**Critical Success Factors**:
1. GLM4.7 model availability and WebFetch tool capability
2. Multi-tier fallback system for robustness
3. API rate limiting (GitHub: 60 req/hour, OSV: 100 req/hour)
4. Comprehensive testing before production use

**ROI Projection**:
- **Implementation Cost**: $8,960 (14 days @ $80/hour for 7 developers)
- **Annual Savings**: $92,712 (research time: $8,352, bad dependencies: $79,360, security: $5,000)
- **First Year ROI**: 9.35x
- **Payback Period**: 35 days

**Risk Mitigation**:
- **GLM4.7 Unavailable**: Multi-tier fallback (Tier 2 internal knowledge → Tier 3 manual research → Tier 4 continue with warnings)
- **API Rate Limits**: Request queuing, exponential backoff, circuit breaker
- **Windows Support**: WSL 2 Ubuntu as MVP (native PowerShell deferred to post-MVP)

## Technical Context

**Language/Version**: JavaScript (Node.js 18+)
**Primary Dependencies**: OpenCode CLI, Claude Code CLI
**Storage**: File-based (specs/, docs/, commands/)
**Testing**: Manual validation + spec-based acceptance testing
**Target Platform**: CLI tool running on developer's machine
**Project Type**: CLI command framework (slash commands in markdown)
**Performance Goals**: Exploration phase completes within 5 minutes for medium complexity features (SC-005). Baseline targets: simple features (≤3 min), medium features (≤5 min), complex features (≤7 min). **Note**: For complex features (8+ entities) with external API dependencies and network latency, 7-minute target is realistic (C #2, H #1).
**Constraints**: Must integrate with existing pipeline (specify → suggest → plan), must work with both OpenCode and Claude Code CLIs, must bypass QuestionTools to orchestrator
**Scale/Scope**: Single feature extension, small-to-medium complexity
**Known Limitations**: Windows native support is limited (no jq, limited bash). WSL with Ubuntu is recommended for full functionality (C #5).

**Windows Testing Acceptance Criteria** (C #2):
- **WSL-Only Acceptable**: YES - WSL 2 with Ubuntu is the officially supported Windows environment for MVP
- **Native Windows Support Required**: NO - Native Windows (PowerShell/CMD) support is **NOT** required for MVP acceptance
- **Windows Testing Scope**:
  - **P1 (Required)**: WSL 2 Ubuntu full functionality testing
  - **P2 (Nice to Have)**: Git Bash with manual jq installation
  - **P3 (Out of Scope for MVP)**: Native PowerShell/CMD support
- **MVP Release Criteria**: System works correctly on WSL 2 Ubuntu
- **Post-MVP Enhancement**: Native Windows support can be added in future phases

## Implementation Blind Spots and Risk Analysis

**Purpose**: This section systematically identifies potential implementation blind spots, unknown unknowns, and systematic risks beyond documented worst-case scenarios.

### Known Unknowns (Identified Risks with Mitigation)

1. **GLM4.7 WebFetch Tool Availability in Sub-Agent Mode**
   - **Risk**: WebFetch tool may not be available in GLM4.7 sub-agent mode, limiting real-time research capability
   - **Detection**: Phase 2 Day 1 WebFetch functionality verification test
   - **Mitigation**: Tier 2 fallback (GLM4.7 internal knowledge) + Bash/curl fallback for API validation
   - **Impact**: Medium - reduces research quality but not functionality

 2. **API Rate Limiting Variability**
    - **Risk**: GitHub, OSV, and npm API rate limits may vary unexpectedly or change over time, potentially causing cascading delays across multiple validation steps (GitHub: 60-5000 req/hour, OSV: 100 req/hour, npm/PyPI: varies)
    - **Detection**: Phase 2 Day 5 API rate limit measurement test
    - **Mitigation**: Request queuing, exponential backoff, circuit breaker, GITHUB_TOKEN support, cache-first approach for repeated queries
    - **Impact**: Medium - may cause delays in validation but not blocking. Cascading delay risk mitigated by sequential validation with fallback to cached data when rate limits hit

 3. **GLM4.7 Model Availability Latency**
    - **Risk**: GLM4.7 model may experience availability issues or increased latency during peak usage
    - **Detection**: Phase 2 Day 1 GLM4.7 access verification
    - **Mitigation**: Multi-tier fallback (Tier 2→3→4), pre-seeded cache, offline mode
    - **Impact**: High - affects core functionality
    - **Alternative Model Option**: If GLM4.7 is persistently unavailable (>3 consecutive failures), set `MODEL_NAME` env var to alternative model (e.g., claude-3.5-sonnet). Note: Alternative models may have different capabilities and API contracts, requiring validation before use.

### Unknown Unknowns (Potential Blind Spots)

1. **Cross-Ecosystem Dependency Conflicts**
   - **Blind Spot**: When a feature requires libraries from multiple ecosystems (e.g., npm + pip), conflicts may arise that are not detectable in single-ecosystem validation
   - **Detection**: None currently - post-MVP enhancement needed
   - **Mitigation**: Manual review for cross-ecosystem features, warning in documentation
   - **Impact**: Low for MVP (single-ecosystem focus)

2. **Library Licensing Compatibility**
   - **Blind Spot**: Suggested libraries may have incompatible licenses with project requirements or existing dependencies
   - **Detection**: None currently - license checking not in validation logic
   - **Mitigation**: Developer manual review, future enhancement to add license validation
   - **Impact**: Low - legal/compliance risk, not technical blocker

3. **Breaking Changes in External APIs**
   - **Blind Spot**: GitHub, OSV, or npm APIs may introduce breaking changes without notice
   - **Detection**: Contract tests (Suite 5) but may not catch all breaking changes
   - **Mitigation**: Version-specific API contracts, graceful degradation, manual fallback
   - **Impact**: Medium - requires updates to validation logic

4. **False Positives in Security Validation**
   - **Blind Spot**: OSV/CVE data may have false positives, causing legitimate libraries to be excluded
   - **Detection**: None currently - no false positive detection
   - **Mitigation**: Manual review of excluded libraries, warning tags for exclusion reason
   - **Impact**: Low - may miss good suggestions but not blocking

5. **Context-Specific Tool Relevance**
   - **Blind Spot**: GLM4.7 exploration may suggest tools that are technically relevant but not contextually appropriate (e.g., enterprise tool for small project)
   - **Detection**: None currently - no context relevance validation
   - **Mitigation**: Developer review (User Story 4), future ML-based relevance scoring
   - **Impact**: Low - developer can reject irrelevant suggestions

### Systematic Risk Analysis

**Risk Matrix**:

| Risk Category | Likelihood | Impact | Priority | Mitigation Strategy |
|---------------|------------|--------|----------|---------------------|
| GLM4.7 Unavailable | Low | High | **HIGH** | Multi-tier fallback, pre-seeded cache |
| API Rate Limit Hit | Medium | Medium | **MEDIUM** | Queuing, backoff, GITHUB_TOKEN |
| WebFetch Unavailable | Medium | Low | **LOW** | Tier 2 fallback, Bash/curl |
| License Conflicts | Low | Medium | **LOW** | Manual review, future enhancement |
| False Positive Security | Medium | Low | **LOW** | Manual review of exclusions |
| Context Irrelevance | High | Low | **LOW** | Developer review |
| API Breaking Changes | Low | Medium | **LOW** | Contract tests, graceful degradation |
| Cross-Ecosystem Conflicts | Low | Low | **LOW** | Manual review (MVP scope) |

**High-Priority Risks Requiring Monitoring**:
1. **GLM4.7 Unavailable**: Monitor daily during Phase 2. If >3 consecutive failures, activate contingency plan (defer to Phase 3 or use alternative model).
2. **API Rate Limit Hit**: Monitor during Phase 2 Days 5-6. If rate limits consistently hit >80%, implement caching more aggressively.

**Low-Priority Risks with Acceptable Mitigation**:
1. **License Conflicts**: Acceptable for MVP to rely on manual review. Future Phase 3 enhancement to add automated license checking.
2. **False Positive Security**: Acceptable to have some false positives. Developer can manually override exclusion if justified.
3. **Context Irrelevance**: Acceptable to rely on developer review (User Story 4). Quality can be improved over time through learning.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

### I. AI優先開発 ✅
- **Compliant**: The suggestion phase uses GLM4.7 (the primary model) for exploration research
- **Rule Check**: All AI-generated suggestions (tools, libraries) will be vetted for maintainability and security before presentation

### II. スキルベースアーキテクチャ ✅
- **Compliant**: The suggestion phase will be implemented as a new command (`/poor-dev.suggest`) following existing command patterns
- **Rule Check**: New command will have clear interface (markdown), documentation, and integration with existing pipeline

### III. レビュー主導品質 ✅
- **Compliant**: Suggestion phase is part of the pipeline before plan review, ensuring all suggestions are documented and traceable
- **Rule Check**: Suggestions will be recorded in spec/ directory for later review

### IV. 重要パスのテストファースト ✅
- **Compliant**: Implementation-level tests for validation and security checks are defined in plan.md (Section: Test Plans for Validation and Security Checks)
- **Rule Check**: Test suites cover maintainability validation, security validation, threshold filtering, conflict resolution, and contract tests for external APIs

### V. 段階的配信とMVP重視 ✅
- **Compliant**: User stories are prioritized (P1: 3 stories, P2: 1 story)
- **Rule Check**: P1 stories can be delivered independently (basic suggestion flow + GLM4.7 exploration + validation)

### VI. スワーム調整 ✅
- **Compliant**: Suggestion phase uses sub-agent (GLM4.7) for exploration
- **Rule Check**: QuestionTools will be bypassed to orchestrator for user interaction

### VII. 可観測性とデバッグ性 ✅
- **Compliant**: ExplorationSession entity tracks status and findings
- **Rule Check**: Status updates during exploration (FR-009) and structured logging will be implemented

### VIII. 検証ゲート ✅
- **Compliant**: Maintainability and security thresholds act as automatic gates before suggestion presentation
- **Rule Check**: Tools/libraries failing critical thresholds are automatically excluded (FR-006)

### IX. メモリと知識管理 ✅
- **Compliant**: SuggestionDecision records developer choices for traceability
- **Rule Check**: Accepted suggestions can be used to improve future suggestion quality

### X. セキュリティとプライバシー ✅
- **Compliant**: Security validation is a core requirement (FR-004, User Story 3)
- **Rule Check**: Known vulnerabilities (CVEs) and security audits are checked for all suggested tools/libraries

**Status**: All gates passed. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/008-add-bestpractice-suggest-phase/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── suggestion-api.md
│   └── validation-rules.md
└── tasks.md             # /poor-dev.tasks output (NOT created by /poor-dev.plan)
```

### Source Code (repository root)

```text
# Single project structure (CLI command framework)
commands/
├── poor-dev.suggest.md       # New: Suggestion phase command
├── poor-dev.md               # Update: Add suggestion to pipeline
├── poor-dev.specify.md       # Update: Integrate suggestion phase
├── poor-dev.plan.md          # Existing: Plan command
├── poor-dev.planreview.md    # Existing: Plan review
└── ... (other existing commands)

agents/
└── suggestion-exploration.md  # New: GLM4.7 exploration agent (optional, may be inline)

lib/
└── suggestion-validator.js   # New: Maintainability/security validation utilities
```

**Structure Decision**: Single project structure - this is a CLI tool extension adding one new command and updating existing orchestration. The existing markdown-based command structure will be maintained for consistency.

## Complexity Tracking

No violations to justify. Constitution check passed all gates.

## Phase Timelines

### Data Backup and Recovery Strategy (C #4)

**Critical State Files**:
- `${FEATURE_DIR}/exploration-session.yaml` - Exploration session status and findings
- `${FEATURE_DIR}/suggestions.yaml` - Filtered suggestions for user review
- `${FEATURE_DIR}/suggestion-decisions.yaml` - User acceptance/rejection decisions

### Pre-Seeded Cache for Cold Start (H #1, simplified)

**Issue**: Three-tier fallback starts with empty cache - initial features may fall back to manual mode before cache populates organically.

**Pre-Seeding Strategy**:
- On suggestion phase start, check if cache exists at `.poor-dev/cache/exploration-cache.yaml`
- If not, initialize with pre-seeded data for common categories: authentication, database, api, logging, testing
- Pre-seeded libraries (high-confidence, vetted):
  - Authentication: passport (85/90), next-auth (90/92), jsonwebtoken (88/85)
  - Database: prisma (92/88), typeorm (88/85), mongoose (90/88)
  - API: express (95/90), fastify (90/92)
  - Logging: winston (88/90), pino (90/92)
  - Testing: jest (92/95), mocha (88/90)
- Use pre-seeded data for cold start scenarios, update cache dynamically as libraries are accepted

**Implementation**: Implement `lib/cache-initializer.mjs` with categories above, add to suggestion phase startup, test cold start scenarios.

**Cache Refresh and Update Strategy** (C #9):

**Issue**: Pre-seeded libraries may become abandoned or have security issues over time. Cache needs periodic refresh.

**Refresh Strategy**:

1. **Automatic Monthly Validation**:
```javascript
// lib/cache-validator.mjs
class CacheValidator {
  async validateAndUpdateCache(cachePath) {
    const cache = await this.loadCache(cachePath);
    const lastUpdated = new Date(cache.last_updated);
    const monthsSinceUpdate = this.getMonthsSince(lastUpdated);

    if (monthsSinceUpdate >= 1) {
      console.log(`Cache is ${monthsSinceUpdate} months old. Validating...`);

      const updatedLibraries = await this.validateLibraries(cache.categories);
      await this.writeUpdatedCache(cachePath, updatedLibraries);

      console.log(`✓ Cache validated and updated ${updatedLibraries.length} libraries`);
    } else {
      console.log(`✓ Cache is fresh (${monthsSinceUpdate} months old). Skipping validation.`);
    }
  }

  async validateLibraries(categories) {
    const validatedCategories = {};

    for (const [category, libraries] of Object.entries(categories)) {
      validatedCategories[category] = [];

      for (const lib of libraries) {
        const validation = await this.validateLibrary(lib);

        if (validation.isValid) {
          validatedCategories[category].push({
            ...lib,
            last_validated: new Date().toISOString(),
            validation_status: 'valid'
          });
        } else {
          console.warn(`⚠ Library ${lib.name} (${category}) failed validation: ${validation.reason}`);
          // Mark as stale but keep in cache with warning
          validatedCategories[category].push({
            ...lib,
            last_validated: new Date().toISOString(),
            validation_status: 'stale',
            validation_reason: validation.reason,
            warning: 'This library may be abandoned or has security issues'
          });
        }
      }
    }

    return validatedCategories;
  }

  async validateLibrary(lib) {
    // Check GitHub API for recent activity
    const githubResponse = await fetch(`https://api.github.com/repos/${lib.github_repo}`);
    const githubData = await githubResponse.json();

    // Check 1: Last commit within 6 months
    const lastCommit = new Date(githubData.pushed_at);
    const monthsSinceLastCommit = this.getMonthsSince(lastCommit);

    if (monthsSinceLastCommit > 6) {
      return { isValid: false, reason: `Last commit ${monthsSinceLastCommit} months ago` };
    }

    // Check 2: Check for open CVEs via OSV API
    const osvResponse = await fetch(`https://api.osv.dev/v1/query?package={"name":"${lib.name}","ecosystem":"${lib.ecosystem}"}`);
    const osvData = await osvResponse.json();

    if (osvData.vulns && osvData.vulns.length > 0) {
      return { isValid: false, reason: `${osvData.vulns.length} known CVEs` };
    }

    return { isValid: true };
  }

  getMonthsSince(date) {
    const now = new Date();
    const diff = now - date;
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  }
}
```

2. **Manual Refresh Command**:
```bash
# Manual cache refresh on demand
poor-dev refresh-suggestion-cache
```

3. **Stale Library Tagging**:
- Libraries failing validation get `[STALE]` tag in suggestions
- Stale libraries still shown but with explicit warnings
- Developer must acknowledge risk before accepting stale suggestions

4. **Cache Versioning**:
- Increment cache_version on each update
- Automatic rollback if validation corrupts cache
- Backup preserved before update (`.backups/cache.backup.*.yaml`)

5. **Refresh Schedule**:
- Automatic: Monthly validation during suggestion phase initiation
- Manual: Developer can trigger refresh via command
- Force: `poor-dev refresh-suggestion-cache --force` bypasses monthly check

**Backup Strategy**:

1. **Automatic Backup on Write**:
   ```javascript
   // lib/backup-manager.mjs
   class BackupManager {
     async backupOnWrite(filePath, data) {
       // Write original file
       await fs.writeFile(filePath, YAML.stringify(data), 'utf8');

       // Create backup with timestamp
       const backupPath = this.generateBackupPath(filePath);
       await fs.writeFile(backupPath, YAML.stringify(data), 'utf8');

       console.log(`✓ Backup created: ${backupPath}`);
     }

     generateBackupPath(originalPath) {
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       const dir = path.dirname(originalPath);
       const basename = path.basename(originalPath, '.yaml');
       return path.join(dir, '.backups', `${basename}.backup.${timestamp}.yaml`);
     }
   }
   ```

2. **Backup Directory Structure**:
   ```text
   ${FEATURE_DIR}/
   ├── exploration-session.yaml
   ├── suggestions.yaml
   ├── suggestion-decisions.yaml
   └── .backups/
       ├── exploration-session.backup.2026-02-12T10-00-00Z.yaml
       ├── exploration-session.backup.2026-02-12T10-30-00Z.yaml
       ├── suggestions.backup.2026-02-12T10-05-00Z.yaml
       └── suggestion-decisions.backup.2026-02-12T10-15-00Z.yaml
   ```

3. **Backup Retention Policy**:
   - Keep last 5 backups per file (rolling backup)
   - Automatically delete older backups after 7 days
   - On successful pipeline completion, archive backups to `.completed-backups/`

4. **Recovery Procedure**:
   ```javascript
   async recoverFromBackup(filePath) {
     const backups = await this.listBackups(filePath);

     if (backups.length === 0) {
       throw new Error(`No backups found for ${filePath}`);
     }

     // Use most recent backup
     const latestBackup = backups[0];
     console.log(`Recovering from: ${latestBackup}`);

     const backupData = await fs.readFile(latestBackup, 'utf8');
     const data = YAML.parse(backupData);

     await fs.writeFile(filePath, YAML.stringify(data), 'utf8');

     return data;
   }

   async listBackups(filePath) {
     const backupDir = path.join(path.dirname(filePath), '.backups');
     const basename = path.basename(filePath, '.yaml');
     const pattern = `${basename}.backup.*.yaml`;

     const files = await fs.readdir(backupDir);
     const backups = files
       .filter(f => f.startsWith(pattern.split('*')[0]))
       .map(f => path.join(backupDir, f))
       .sort()
       .reverse(); // Most recent first

     return backups.slice(0, 5); // Last 5 backups
   }
   ```

5. **Corruption Detection and Recovery**:
   ```javascript
   async writeWithValidation(filePath, data, schema) {
     try {
       // Write to temp file first
       const tempPath = `${filePath}.tmp`;
       await fs.writeFile(tempPath, YAML.stringify(data), 'utf8');

       // Validate schema
       const parsedData = YAML.parse(await fs.readFile(tempPath, 'utf8'));
       await this.validateSchema(parsedData, schema);

       // Backup existing file if it exists
       if (await fs.pathExists(filePath)) {
         await this.backupOnWrite(filePath, data);
       }

       // Atomic rename
       await fs.rename(tempPath, filePath);
     } catch (error) {
       console.error(`Write failed, recovering from backup: ${error}`);
       await this.recoverFromBackup(filePath);
       throw error;
     }
   }
   ```

 6. **Emergency Recovery Command**:
    ```bash
    # Emergency recovery if files are corrupted
    poor-dev recover-suggestions ${FEATURE_DIR} --from-backup
    ```

7. **Specific Recovery Procedures for Critical Scenarios** (C #10):

**Scenario 1: suggestion-decisions.yaml Corruption During User Input**
```javascript
async recoverFromDecisionsCorruption(featureDir) {
  const decisionsPath = `${featureDir}/suggestion-decisions.yaml`;
  const suggestionsPath = `${featureDir}/suggestions.yaml`;

  try {
    // Attempt to validate decisions file
    const decisions = YAML.parse(await fs.readFile(decisionsPath, 'utf8'));
    if (!decisions.decisions || !Array.isArray(decisions.decisions)) {
      throw new Error('Invalid decisions structure');
    }
  } catch (error) {
    console.error('suggestion-decisions.yaml corrupted during user input');
    console.error('Recovery options:');

    const suggestions = YAML.parse(await fs.readFile(suggestionsPath, 'utf8'));

    // Option 1: Re-display suggestions for re-input
    console.log('Option 1: Re-display suggestions and re-collect decisions');
    const recoveredDecisions = await this.recollectUserDecisions(suggestions);
    await fs.writeFile(decisionsPath, YAML.stringify(recoveredDecisions), 'utf8');

    console.log('✓ Recovered: Re-collected user decisions');
    return recoveredDecisions;
  }
}

async recollectUserDecisions(suggestions) {
  const decisions = [];

  for (const suggestion of suggestions.suggestions) {
    console.log(`\nSuggestion: ${suggestion.name}`);
    console.log(`  Type: ${suggestion.type}`);
    console.log(`  Maintainability: ${suggestion.maintainability_score}`);
    console.log(`  Security: ${suggestion.security_score}`);

    const decision = await promptUser(
      'Accept this suggestion? (yes/no)',
      { default: 'yes' }
    );

    decisions.push({
      suggestion_id: suggestion.id,
      action: decision === 'yes' ? 'accepted' : 'rejected',
      reason: decision === 'yes' ? 'User accepted' : 'User rejected',
      decided_at: new Date().toISOString()
    });
  }

  return { decisions };
}
```

**Scenario 2: State Inconsistency (exploration-session.yaml corrupted, suggestions.yaml valid)**
```javascript
async recoverFromStateInconsistency(featureDir) {
  const sessionPath = `${featureDir}/exploration-session.yaml`;
  const suggestionsPath = `${featureDir}/suggestions.yaml`;

  const sessionValid = await this.validateFile(sessionPath);
  const suggestionsValid = await this.validateFile(suggestionsPath);

  if (!sessionValid && suggestionsValid) {
    console.warn('State inconsistency: exploration-session.yaml corrupted, suggestions.yaml valid');
    console.warn('Recovery: Reconstruct session from suggestions.yaml');

    const suggestions = YAML.parse(await fs.readFile(suggestionsPath, 'utf8'));

    // Reconstruct exploration session from suggestions
    const reconstructedSession = {
      id: suggestions.exploration_session_id || generateUUID(),
      feature_id: path.basename(featureDir),
      status: 'completed',
      started_at: suggestions.generated_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      findings_summary: `Reconstructed from ${suggestions.suggestions.length} suggestions (session file corrupted)`,
      suggestions_generated_count: suggestions.suggestions.length,
      recovery_note: 'Session file was corrupted, reconstructed from suggestions.yaml'
    };

    // Write reconstructed session
    await fs.writeFile(sessionPath, YAML.stringify(reconstructedSession), 'utf8');

    console.log('✓ Recovered: Reconstructed exploration session from suggestions.yaml');
    return reconstructedSession;
  }
}
```

**Scenario 3: Recovery Decision Matrix**
```yaml
# Recovery decision matrix for inconsistent state
recovery_scenarios:
  exploration_session_corrupted:
    suggestions_valid: true
    action: "reconstruct_session_from_suggestions"
    recovery_priority: "HIGH"

  suggestions_corrupted:
    exploration_session_valid: true
    action: "regenerate_suggestions_from_session"
    recovery_priority: "CRITICAL"

  both_corrupted:
    backups_available: true
    action: "restore_from_most_recent_backup"
    recovery_priority: "CRITICAL"

  both_corrupted_no_backups:
    action: "restart_suggestion_phase"
    recovery_priority: "CRITICAL"
    user_notification: "⚠ Complete data loss. Restarting suggestion phase."
```

**Implementation Checklist**:
- [ ] Implement `lib/backup-manager.mjs`
- [ ] Add backup hooks to file write operations
- [ ] Create `.backups/` directory on suggestion phase start
- [ ] Implement backup retention policy (5 backups, 7 days)
- [ ] Add corruption detection with schema validation
- [ ] Implement `poor-dev recover-suggestions` command
- [ ] Test recovery from corrupted files
- [ ] Document backup/recovery procedures in quickstart.md

**Phase 0: Outline & Research**
- **Start Date**: 2026-02-12
- **Target Completion**: 2026-02-13 (1 day)
- **Deliverable**: research.md

### Day 0: Dependency Verification Checklist (Critical for Baseline Testing)

**IMPORTANT**: Baseline testing on Day 1 requires ALL dependencies verified on Day 0. Halt Phase 2 Day 1 if any check fails.

```markdown
## Phase 0 Day 0: Dependency Verification Checklist

### Critical Dependencies (MUST PASS for Phase 2 Day 1)

1. **jq Installation Check**
    ```bash
    if ! command -v jq &> /dev/null; then
      echo "✗ FAIL: jq not installed"
      echo "  Install: sudo apt-get install jq (Linux) or brew install jq (macOS)"
      exit 1
    fi
    echo "✓ PASS: jq installed ($(jq --version))"
    ```

2. **GLM4.7 Access Verification**
    ```bash
    # Test GLM4.7 model access
    echo "Testing GLM4.7 access..."
    TASK_OUTPUT=$(Task(model="zai-coding-plan/glm-4.7", prompt="Respond with 'GLM4.7_OK' only", timeout=30))
    if [[ "$TASK_OUTPUT" == *"GLM4.7_OK"* ]]; then
      echo "✓ PASS: GLM4.7 model accessible"
    else
      echo "✗ FAIL: GLM4.7 dispatch failed or timed out"
      exit 1
    fi
    ```

3. **WebFetch Tool Availability in GLM4.7 Sub-Agent Mode** (C #3)
    ```bash
    # Test WebFetch tool availability in GLM4.7 sub-agent mode
    echo "Testing WebFetch tool availability in GLM4.7 sub-agent mode..."
    WEBFETCH_OUTPUT=$(Task(model="zai-coding-plan/glm-4.7", subagent_type="suggestion-exploration", mode="subagent", prompt="Check if WebFetch tool is available in your tool list. Respond with 'WEBFETCH_AVAILABLE' if available, or 'WEBFETCH_UNAVAILABLE' if not available.", timeout=30))
    if [[ "$WEBFETCH_OUTPUT" == *"WEBFETCH_AVAILABLE"* ]]; then
      echo "✓ PASS: WebFetch tool is available in GLM4.7 sub-agent mode"
    elif [[ "$WEBFETCH_OUTPUT" == *"WEBFETCH_UNAVAILABLE"* ]]; then
      echo "⚠ WARNING: WebFetch tool NOT available in GLM4.7 sub-agent mode"
      echo "  → Fallback Strategy: Tier 2 (GLM4.7 internal knowledge) + Bash/curl fallback"
      echo "  → All suggestions will have [LIMITED_KNOWLEDGE] tag"
      WEBFETCH_AVAILABLE=false
    else
      echo "⚠ WARNING: WebFetch tool detection inconclusive"
      echo "  → Will test with actual WebFetch call during Phase 2 Day 1"
    fi
    ```

4. **API Connectivity Verification**
    ```bash
    # Test GitHub API connectivity
    GITHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.github.com/rate_limit --max-time 5)
    if [[ "$GITHUB_STATUS" == "200" ]]; then
      echo "✓ PASS: GitHub API accessible"
    else
      echo "✗ FAIL: GitHub API unreachable (status: $GITHUB_STATUS)"
      exit 1
    fi

    # Test OSV API connectivity
    OSV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.osv.dev/v1/query --max-time 5)
    if [[ "$OSV_STATUS" == "200" ]]; then
      echo "✓ PASS: OSV API accessible"
    else
      echo "✗ FAIL: OSV API unreachable (status: $OSV_STATUS)"
      exit 1
    fi

    # Test npm registry connectivity
    NPM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/express --max-time 5)
    if [[ "$NPM_STATUS" == "200" ]]; then
      echo "✓ PASS: npm registry accessible"
    else
      echo "✗ FAIL: npm registry unreachable (status: $NPM_STATUS)"
      exit 1
    fi
    ```

5. **GITHUB_TOKEN Verification (Optional but Recommended)**
    ```bash
    if [[ -n "$GITHUB_TOKEN" ]]; then
      echo "✓ INFO: GITHUB_TOKEN set (rate limit: 5,000 req/hour)"
    else
      echo "⚠ WARNING: GITHUB_TOKEN not set (rate limit: 60 req/hour)"
      echo "  Setup: https://github.com/settings/tokens"
    fi
    ```

### Pass/Fail Criteria

**PASS**: ALL critical dependencies verified (jq, GLM4.7, GitHub API, OSV API, npm API)
**PARTIAL PASS**: WebFetch unavailable but Bash/curl fallback available
**FAIL**: ANY critical dependency fails (except WebFetch which has fallback) → Halt Phase 2 Day 1, display installation instructions

**Day 0 Exit Codes**:
- Exit 0: All dependencies verified (proceed to Phase 2 Day 1)
- Exit 1: jq not installed
- Exit 2: GLM4.7 access failed
- Exit 3: API connectivity failed
- Exit 4: Multiple dependencies failed
- Exit 5: WebFetch and Bash/curl both unavailable (critical for research)

### Schedule Impact Analysis for Day 0 Failures (C #4)

**CRITICAL**: Day 0 failures cause schedule delays. Documented impact analysis below:

| Failure Type | Exit Code | Schedule Impact | Delay Duration | Resolution Time |
|-------------|-----------|-----------------|----------------|-----------------|
| **jq not installed** | Exit 1 | **BLOCKER** | +1 day | Installation and verification (5-30 minutes) |
| **GLM4.7 access failed** | Exit 2 | **CRITICAL BLOCKER** | +3-7 days | Troubleshoot GLM4.7 availability, may require model change |
| **GitHub API connectivity failed** | Exit 3 | **BLOCKER** | +1 day | Network troubleshooting, proxy configuration |
| **OSV API connectivity failed** | Exit 3 | **BLOCKER** | +1 day | Network troubleshooting, verify OSV API status |
| **npm registry connectivity failed** | Exit 3 | **BLOCKER** | +1 day | Network troubleshooting, check npm registry status |
| **Multiple dependencies failed** | Exit 4 | **CRITICAL BLOCKER** | +3-5 days | Each failure requires separate resolution |
| **WebFetch and Bash/curl unavailable** | Exit 5 | **HIGH PRIORITY** | +2 days | Requires fallback redesign (Tier 2 only) |

**Worst-Case Scenario Analysis**:
- **jq failure only**: +1 day delay → New Phase 2 start: 2026-02-18
- **GLM4.7 failure only**: +3-7 days delay → New Phase 2 start: 2026-02-20 to 2026-02-24
- **API failure only**: +1 day delay → New Phase 2 start: 2026-02-18
- **Multiple failures (jq + GLM4.7)**: +4-8 days delay → New Phase 2 start: 2026-02-21 to 2026-02-25
- **All dependencies fail (worst case)**: +5-10 days delay → New Phase 2 start: 2026-02-22 to 2026-02-27

**Schedule Adjustment Formula**:
```
New Phase 2 Start Date = Original Phase 2 Start Date (2026-02-17) + Failure Delay (days)
New Phase 2 Completion Date = Original Phase 2 Completion (2026-03-02) + Failure Delay (days)
```

**Examples**:
```
Example 1: jq installation failure
  Original start: 2026-02-17
  Delay: +1 day
  New start: 2026-02-18
  New completion: 2026-03-03

Example 2: GLM4.7 access failure
  Original start: 2026-02-17
  Delay: +5 days (troubleshooting time)
  New start: 2026-02-22
  New completion: 2026-03-07

Example 3: Multiple failures (jq + API)
  Original start: 2026-02-17
  Delay: +2 days (jq: 1 day, API: 1 day)
  New start: 2026-02-19
  New completion: 2026-03-04
```

**Mitigation Strategies to Reduce Schedule Impact**:
1. **Pre-Day 0 Preparation** (Reduces failure risk):
   - Verify jq installation during Phase 0
   - Test GLM4.7 access during Phase 0 research
   - Document all installation commands in research.md

2. **Parallel Issue Resolution** (Reduces cumulative delay):
   - If multiple failures occur, resolve in parallel when possible
   - Example: Install jq while troubleshooting GLM4.7 (requires separate teams/priorities)

3. **Partial Proceed** (Reduces delay for partial failures):
   - If GLM4.7 fails but jq/API work, can proceed with Tier 2/3 design work
   - Document architectural decisions while GLM4.7 is being fixed

4. **Escalation Path** (Reduces resolution time):
   - For GLM4.7 failures: Escalate to model availability team within 2 hours
   - For API failures: Check API status page, contact support if API down
   - For jq failures: Auto-install on supported platforms (Linux/macOS)

**Decision Matrix for Proceeding After Day 0 Failure**:
| Failure Type | Can Proceed? | Conditions | Reduced Scope |
|-------------|--------------|------------|---------------|
| jq only | **NO** | jq required for JSON parsing in fallback mode | N/A - Must install jq |
| GLM4.7 only | **PARTIAL** | Can work on Tier 2/3 design while GLM4.7 being fixed | Design fallback logic without implementation |
| API only | **PARTIAL** | Can implement internal validation logic while API fixed | Implement score defaults, add API hooks later |
| Multiple | **NO** | All dependencies required for full implementation | N/A - Must resolve all failures |

**Schedule Communication for Day 0 Failures**:
```yaml
Day 0 Failure Notification Template:
-------------------------------
Subject: ⚠ DAY 0 FAILURE - Suggestion Phase Implementation Delayed

Failure Details:
  - Failure Type: [jq/GLM4.7/API/Multiple]
  - Exit Code: [1/2/3/4/5]
  - Timestamp: [ISO 8601 timestamp]

Schedule Impact:
  - Original Phase 2 Start: 2026-02-17
  - Delay: +[X] days
  - New Phase 2 Start: [calculated date]
  - New Phase 2 Completion: [calculated date]

Resolution Steps:
  1. [Install jq / Troubleshoot GLM4.7 / Fix network issues]
  2. Verify resolution
  3. Re-run Day 0 verification
  4. Confirm proceed to Phase 2 Day 1

Next Update: [provide date/time for next update]
Contact: [provide escalation contact]
```

**Schedule Recovery Timeline**:
```
Day 0 Failure (2026-02-17)
  ↓
Resolution (0-10 days, depending on failure type)
  ↓
Day 0 Re-run (verify resolution)
  ↓
Proceed to Phase 2 Day 1 (original + delay)
  ↓
Baseline Testing (Day 1)
  ↓
Continue Phase 2 implementation (original timeline extended)
```

### Escalation Path for Day 0 Failures (H #2, simplified)

**Issue**: Day 0 dependency verification has halt criteria but no escalation path for when jq/GLM4.7 unavailable.

**Escalation by Failure Type**:

**Exit 1: jq Not Installed**
- Install commands by OS:
  - Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y jq`
  - Fedora/CentOS: `sudo dnf install -y jq`
  - Arch: `sudo pacman -S jq`
  - macOS: `brew install jq`
  - Windows (WSL): `wsl --install -d Ubuntu`, then `sudo apt-get update && sudo apt-get install -y jq`
  - Windows (Chocolatey): `choco install jq`
- Verify: `jq --version`

**Exit 2: GLM4.7 Access Failed**
- Check failure type: timeout vs dispatch error
- Timeout: Check network, try `curl -I https://api.github.com`
- Dispatch error: Verify model name `zai-coding-plan/glm-4.7`, check API key, review `/tmp/glm47-dispatch.log`
- Fallback options:
  1. Tier 2 (GLM4.7 internal knowledge only)
  2. Tier 3 (manual input mode)
  3. Alternative model (set `MODEL_NAME` env var)
  4. Reduce scope to Tier 1+2 (pre-seeded cache only, no AI exploration)
  5. Defer to Phase 3 if unavailable >3 days (critical path blocker)

**Exit 3: API Connectivity Failed**
- Test all APIs: GitHub, OSV, npm/PyPI
- Troubleshoot: Check internet, DNS, firewall/proxy, VPN
- Fallback: Use cached data, offline mode (Tier 2 + pre-seeded), or manual input (Tier 3)

**Exit 4: Multiple Dependencies Failed**
- Run `poor-dev verify-dependencies --verbose`
- Fix each failure per instructions above
- Contact support with logs (`/tmp/poor-dev.log`, `/tmp/glm47-dispatch.log`) if issues persist



### Research Tasks

1. Extract unknowns from Technical Context (NEEDS CLARIFICATION → research tasks).
2. Generate and dispatch research agents for each unknown/technology.
3. Consolidate in `research.md`: Decision, Rationale, Alternatives considered.

**Research Areas**:
- How to integrate suggestion phase into existing pipeline (specify → suggest → plan)
- How to use GLM4.7 for exploration research in sub-agent mode
- How to bypass QuestionTools to orchestrator
- Maintainability metrics sources (GitHub API, npm/PyPI registry)
- Security check sources (OSV, Snyk, npm audit)
- Fallback mechanisms for GLM4.7 exploration failures
- API rate limiting strategies for external services
- WebFetch tool availability verification

**Output**: research.md

**Phase 1: Design & Contracts**
- **Start Date**: 2026-02-14
- **Target Completion**: 2026-02-16 (3 days)
- **Deliverables**: data-model.md, contracts/, quickstart.md

Prerequisites: research.md complete.

1. Extract entities from spec → `data-model.md` (fields, relationships, validation, state transitions).
2. Generate API contracts from functional requirements → `/contracts/` (OpenAPI/GraphQL).

**Output**: data-model.md, /contracts/*, quickstart.md

**Phase 2: Implementation**
- **Start Date**: 2026-02-17
- **Target Completion**: 2026-03-02 (14 days) - **Extended to 14 days to accommodate full implementation scope, complex API integrations, and comprehensive fallback testing**
- **Deliverables**: Fully implemented suggestion phase with tests
- **Note**: Timeline extension addresses aggressive 11-day timeline concern with API integrations and complex pipeline changes

**Explicit P2 Feature Deferral Option to Phase 3** (H #1, simplified):
- **Defer-to-Phase-3 Triggers** (evaluated at Day 7):
  - API integration complexity exceeds estimates (>4 days spent)
  - Multi-tier fallback testing uncovers critical issues requiring >3 days
  - Pipeline integration issues would cause Day 10+ delays
- **Features Eligible for Phase 3 Deferral**:
  - Test Suite 8: Persistent failure detection with monitoring (deferred if rate limiting takes >4 days)
  - Advanced caching: Tiered invalidation, cache warming (deferred if basic caching takes >3 days)
  - Enhanced UX features: Developer feedback, suggestion improvement (deferred if core takes >12 days)
- **Deferral Process**: At Day 7 evaluation, assess critical path, if delayed >2 days, document deferral in `phase2-deferral-log.md`, update deliverables, add to Phase 3 roadmap
- **Phase 2 Core (Cannot be deferred)**: Tier 1-3 fallback, core API integration (GitHub/OSV/npm/PyPI), validation logic, pipeline integration, baseline testing, WebFetch verification

**Contingency Plan for Schedule Pressure** (simplified):
| Scenario | Trigger | Action | Impact |
|----------|---------|--------|--------|
| API Integration Delays | Testing fails >3 days | Defer Test Suite 8 to Phase 3 | Adjust priorities |
| Fallback Testing Complexity | Tier 2→3→4 fails repeatedly | Simplify to 2-tier (Tier 1 → Tier 4) | Adjust priorities |
| Windows Issues | Native PowerShell needs fixes | Scope to WSL only | Adjust priorities |
| Circuit Breaker Complexity | Implementation takes >4 days | Use simple backoff only | Adjust priorities |
| Rate Limiting Overruns | Requires extensive testing | Accept 60 req/hour unauth, document GITHUB_TOKEN | No change |

**Timeline Evaluation Points**:
- **Day 7 (2026-02-23)**: If >2 tasks behind → Defer Test Suite 8
- **Day 10 (2026-02-26)**: If >4 days behind → Defer Windows native, simplify circuit breaker
- **Day 12 (2026-03-01)**: If >6 days behind → Critical re-evaluation, defer non-critical features, consider Phase 2 split or extension

**Contingency Buffer**: Days 12-14 provide 3 days of buffer for unexpected issues. Windows support scoped to WSL (remove native PowerShell testing).

**Timeline Justification and Risk Acknowledgment** (Iteration 8):
- **14-Day Timeline Justification**: The 14-day Phase 2 timeline (Feb 17 - Mar 2, 2026) is aggressive but achievable with focused scope and clear deferral options. Timeline assumes: (1) GLM4.7 model availability and WebFetch capability verified on Day 0, (2) P2 features can be deferred if schedule pressure arises, (3) API integration uses existing, well-documented endpoints (GitHub, OSV, npm/PyPI), (4) Windows support limited to WSL 2 MVP. Days 12-14 contingency buffer (21% of timeline) provides reasonable risk coverage for unknown delays.
- **Success Targets Acknowledgment**: Success targets (80-90% pass rates, 5-minute exploration time) are ambitious for a first implementation. These represent aspirational goals; actual performance may be lower initially. Post-implementation measurement (Phase 3) will validate and adjust targets if needed. Baseline testing on Day 1 will provide empirical data to validate or adjust 5-minute target before full implementation. If baseline testing shows <60% pass rate for 5-minute target, SC-005 will be automatically adjusted to 7 minutes (see "Explicit Go/No-Go Criteria" in Performance Validation section).

**Phase 2 Implementation Schedule**:
- **Day 1 (P1 - CRITICAL)**: Environment verification, QuestionTools bypass integration test, WebFetch availability verification test (pass/fail criteria), jq installation, GLM4.7 sub-agent dispatch test, library existence validation mechanism implementation
  - **Day 1 ADD-ON: Simplified Baseline Measurement** (C #7, PR-25):
    - **Task**: Record baseline metrics for ROI calculation (simplified for Day 1 feasibility)
    - **Objective**: Establish empirical baseline with minimal time investment
    - **Simplified Measurement** (15 minutes):
      ```bash
      # Phase 2 Day 1: Quick Baseline Measurement (15 minutes)

      echo "Quick Baseline Measurement (15 minutes)"
      echo "Using industry averages + single manual research task"
      echo ""

      # Task 1: Quick manual library research (10 minutes)
      echo "Task: Quick research of passport.js (10 minutes)"
      echo "  1. Quick check of GitHub repo (stars, last commit)"
      echo "  2. Quick check of npm stats"
      echo "  3. Record time: _____ minutes"
      echo ""

      # Task 2: Use industry averages (5 minutes)
      echo "Industry Averages (documented in baseline-measurements.yaml):"
      echo "  Average research time: 72 minutes/feature"
      echo "  Bad dependency rate: 60%"
      echo "  Replacement cost: $1,280/bad_dep"
      echo "  Security incidents: 1-2/year @ $5,000 each"
      echo ""

      # Document baseline
      echo "Baseline measurement complete. Document in baseline-measurements.yaml"
      ```

    - **Measurement Template** (C #7):
      ```yaml
      # ${FEATURE_DIR}/baseline-measurements.yaml
      baseline_measurement:
        measurement_date: "2026-02-17"
        measurement_phase: "Phase 2 Day 1 (Pre-Implementation)"
        measured_by: "Project Lead"
        measurement_method: "Quick manual task + industry averages"

        # Task 1: Quick Manual Research Task
        manual_research_time:
          feature_description: "Add user authentication with passport.js"
          total_time_minutes: 15  # Quick research, not comprehensive
          notes: "Simplified measurement for Day 1 feasibility"

        # Task 2: Industry Averages (Source: industry research)
        industry_averages:
          average_research_time_per_feature_minutes: 72
          average_research_time_per_feature_hours: 1.2
          bad_dependency_rate_percent: 60
          time_to_replace_bad_dependency_hours: 16
          cost_to_replace_bad_dependency_usd: 1280
          security_incidents_per_year: 1
          average_security_incident_cost_usd: 5000

        # Task 3: Baseline Calculation
        baseline_calculation:
          # Research Time Cost
          cost_per_feature_usd: 96  # 1.2 hours × $80/hour
          features_per_year: 120
          annual_research_cost_usd: 11520  # 96 × 120

          # Bad Dependency Cost
          bad_deps_per_year: 72  # 6 bad deps/month × 12 months
          annual_bad_dependency_cost_usd: 92160  # 72 × $1280

          # Security Incident Cost
          security_incidents_per_year: 1
          annual_security_cost_usd: 5000

          # Total Baseline Annual Cost
          total_annual_baseline_cost_usd: 108680  # 11520 + 92160 + 5000

          # Baseline Per-Feature Cost
          total_cost_per_feature_usd: 905.67  # 108680 / 120
          research_cost_per_feature_usd: 96  # 11520 / 120
          bad_dependency_cost_per_feature_usd: 768  # 92160 / 120
          security_cost_per_feature_usd: 41.67  # 5000 / 120

      # Post-Implementation Comparison Template
      post_implementation_comparison:
        measurement_date: "POST_IMPLEMENTATION_DATE_TO_BE_FILLED"
        implementation_date: "2026-03-02"

        # Research Time Savings
        research_time_savings:
          pre_impl_avg_minutes_per_feature: 72
          post_impl_avg_minutes_per_feature: 20
          time_saved_per_feature_minutes: 52
          time_saved_per_feature_hours: 0.87
          annual_time_saved_hours: 104.4  # 52 min × 120 features / 60
          annual_cost_saved_usd: 8352  # 104.4 hours × $80/hour

        # Bad Dependency Reduction
        bad_dependency_reduction:
          pre_impl_bad_dep_rate_percent: 60
          post_impl_bad_dep_rate_percent: 9  # 85% reduction
          bad_deps_avoided_per_year: 62  # 72 - 10
          annual_cost_saved_usd: 79360  # 62 × $1280

        # Security Risk Reduction
        security_risk_reduction:
          pre_impl_security_incident_rate_percent: 8.33  # 1/12 features
          post_impl_security_incident_rate_percent: 1.67  # 80% reduction
          incidents_avoided_per_year: 1
          annual_cost_saved_usd: 5000

        # Total Savings
        total_savings:
          annual_research_savings_usd: 8352
          annual_bad_dependency_savings_usd: 79360
          annual_security_savings_usd: 5000
          total_annual_savings_usd: 92712

        # ROI Calculation
        roi_calculation:
          implementation_cost_usd: 8960
          first_year_roi: 9.35  # (92712 - 8960) / 8960
          second_year_roi: 48.29  # 92712 / 1920
          payback_period_months: 1.16  # 8960 / (92712 / 12)
          payback_period_days: 35
      ```

    - **Measurement Success Criteria** (C #7, PR-30):
      - Complete manual library research task with recorded times (15 minutes)
      - Document baseline cost per feature using industry averages
      - Document bad dependency rate (industry estimate: 60%)
      - Document security incident history (industry estimate: 1-2/year)
      - Save baseline-measurements.yaml to specs/ directory

    - **EXPLICIT GO/NO-GO GATE** (C #7):
      - **GO (Proceed to Day 2)**: All tasks completed:
        - [x] Manual library research task completed with recorded times
        - [x] Baseline cost per feature calculated using industry averages
        - [x] baseline-measurements.yaml saved to specs/ directory
      - **NO-GO (Block Day 2)**: Baseline cost data is incomplete
      - **NO-GO RECOVERY**: Document incomplete tasks, proceed with conservative estimates (use industry averages)

    - **Baseline Measurement Methodology Note** (C #11):
      - **Known Limitation**: Surveying 5-10 developers provides limited statistical significance
      - **Mitigation**: Use conservative (pessimistic) estimates when survey data is incomplete
      - **Fallback**: If surveys cannot be completed, use industry averages:
        - Average research time: 60-90 minutes per feature
        - Bad dependency rate: 40-60% (industry estimates)
        - Replacement cost: $1,000-$1,500 per dependency
      - **Validation**: Post-implementation will measure actual savings to validate ROI assumptions
      - **Conservative Bias**: When in doubt, assume higher baseline cost (more conservative ROI projection)

    - **Baseline Measurement Validation** (C #7):
      ```javascript
      // tests/baseline/baseline-measurement.test.mjs
      describe('Baseline Measurement Validation', () => {
        test('Baseline file exists with all required fields', async () => {
          const baseline = await loadBaselineMeasurements();
          
          expect(baseline).toHaveProperty('measurement_date');
          expect(baseline).toHaveProperty('manual_research_time');
          expect(baseline).toHaveProperty('developer_survey');
          expect(baseline).toHaveProperty('baseline_calculation');
        });

        test('Research time is within reasonable range (50-100 minutes)', async () => {
          const baseline = await loadBaselineMeasurements();
          
          const researchMinutes = baseline.manual_research_time.total_time_minutes;
          expect(researchMinutes).toBeGreaterThanOrEqual(50);
          expect(researchMinutes).toBeLessThanOrEqual(100);
        });

        test('Annual baseline cost is calculated correctly', async () => {
          const baseline = await loadBaselineMeasurements();
          
          const expectedAnnualCost = 
            baseline.baseline_calculation.annual_research_cost_usd +
            baseline.baseline_calculation.annual_bad_dependency_cost_usd +
            baseline.baseline_calculation.annual_security_cost_usd;
          
          expect(baseline.baseline_calculation.total_annual_baseline_cost_usd)
            .toBe(expectedAnnualCost);
        });

        test('Cost per feature is positive and reasonable', async () => {
          const baseline = await loadBaselineMeasurements();
          
          const costPerFeature = baseline.baseline_calculation.total_cost_per_feature_usd;
          expect(costPerFeature).toBeGreaterThan(0);
          expect(costPerFeature).toBeLessThan(2000); // Reasonable upper bound
        });
      });
      ```

    - **If Baseline Measurement Fails** (C #7):
      - If cannot complete manual research task: Use estimated 75 minutes per feature
      - If cannot survey developers: Use industry average 60-90 minutes per feature
      - If bad dependency rate unknown: Use industry estimate 60%
      - Document all assumptions in baseline-measurements.yaml
      - Proceed with implementation (baseline is required but not blocking)

 - **Day 1-2 (P1 - CRITICAL)**: Implement core validation logic (unit tests Suites 1-3), offline mode detection
- **Day 3-4 (P1 - CRITICAL)**: Implement suggestion exploration agent with fallback mechanism, Tier 4 fallback, [STALE_RISK] tagging for outdated libraries
- **Day 5-6 (P1 - CRITICAL)**: **PRIORITY: Fallback mechanism testing (Tier 2→3→4 transitions)** before pipeline integration
- **Day 7-8 (P1 - CRITICAL)**: Implement pipeline integration (specify → suggest → plan transitions)
 - **Day 9-10 (P1 - CRITICAL)**: Implement external API integration with concrete rate limiting (GitHub: 60 req/hour unauthenticated, OSV: 100 req/hour), request queuing, API downtime handling with exponential backoff and circuit breaker. **Note**: This is core API integration. Additional API validation and testing occurs during Day 13 comprehensive fallback testing, providing total of ~3-4 days for API-related work including validation and contingency handling (addresses PR-24 timeline concern).

  - **Day 9 Add-on: Rate Limit Measurement Task** (H #3):
    - **Task**: Document actual API rate limit behavior during Phase 2 to ensure 60 req/hour GitHub and 100 req/hour OSV limits are realistic with parallel WebFetch
    - **Measurement Procedure**:
       ```bash
       # Phase 2 Day 9: API Rate Limit Measurement Test

      # Test 1: GitHub API actual rate limit
      echo "Testing GitHub API rate limit..."
      GITHUB_LIMIT_TEST=0
      while [ $GITHUB_LIMIT_TEST -lt 100 ]; do
        curl -s -o /dev/null -w "%{http_code}" https://api.github.com/rate_limit
        GITHUB_LIMIT_TEST=$((GITHUB_LIMIT_TEST + 1))
      done

      # Test 2: OSV API actual rate limit
      echo "Testing OSV API rate limit..."
      OSV_LIMIT_TEST=0
      while [ $OSV_LIMIT_TEST -lt 100 ]; do
        curl -s -X POST "https://api.osv.dev/v1/query" \
          -H "Content-Type: application/json" \
          -d '{"package":{"name":"express","ecosystem":"npm"}}' \
          -o /dev/null -w "%{http_code}"
        OSV_LIMIT_TEST=$((OSV_LIMIT_TEST + 1))
      done

    # Test 3: Parallel WebFetch rate impact
    echo "Testing parallel WebFetch rate impact..."
    # Run 5 parallel WebFetch requests to measure burst capacity
    for i in {1..5}; do
      webfetch https://api.github.com/repos/expressjs/express &
    done
    wait
    ```

### WebFetch Functionality Verification (C #8)

**CRITICAL**: Before production use, verify WebFetch actually works in sub-agent mode with real URLs.

**Verification Test** (Phase 2 Day 1, after tool availability check):
```bash
# Phase 2 Day 1: WebFetch Functionality Verification

echo "=============================================="
echo "WEbFETCH FUNCTIONALITY VERIFICATION"
echo "=============================================="
echo ""

# Test 1: Actual WebFetch call to known URL
echo "Test 1: Actual WebFetch call to GitHub API..."
WEBFETCH_RESULT=$(webfetch "https://api.github.com/repos/expressjs/express" 2>&1)

if echo "$WEBFETCH_RESULT" | grep -q '"stargazers_count"'; then
  echo "✓ PASS: WebFetch successfully retrieved GitHub API data"
  echo "  Sample response: $(echo "$WEBFETCH_RESULT" | head -c 100)..."
else
  echo "✗ FAIL: WebFetch did not return expected JSON"
  echo "  Error: $WEBFETCH_RESULT"
  echo "  → Fallback: Use Tier 2 (internal knowledge only)"
  exit 1
fi

# Test 2: WebFetch timeout behavior
echo ""
echo "Test 2: WebFetch timeout verification..."
TIMEOUT_TEST=$(timeout 5 webfetch "https://httpstat.us/200?sleep=2000" 2>&1)
TIMEOUT_EXIT=$?

if [ $TIMEOUT_EXIT -eq 0 ] && echo "$TIMEOUT_TEST" | grep -q "200"; then
  echo "✓ PASS: WebFetch timeout handling works correctly"
else
  echo "⚠ WARNING: WebFetch timeout behavior unexpected (exit code: $TIMEOUT_EXIT)"
fi

# Test 3: WebFetch in sub-agent mode (GLM4.7)
echo ""
echo "Test 3: WebFetch functionality in GLM4.7 sub-agent mode..."
SUBAGENT_OUTPUT=$(Task(model="zai-coding-plan/glm-4.7", subagent_type="suggestion-exploration", mode="subagent", prompt="Use WebFetch to fetch https://api.github.com/repos/expressjs/express and respond with the star count only.", timeout=30))

if echo "$SUBAGENT_OUTPUT" | grep -qE "[0-9]+"; then
  echo "✓ PASS: WebFetch works in GLM4.7 sub-agent mode"
  echo "  Star count retrieved: $SUBAGENT_OUTPUT"
else
  echo "✗ FAIL: WebFetch not functional in GLM4.7 sub-agent mode"
  echo "  Output: $SUBAGENT_OUTPUT"
  echo "  → Fallback: Use Tier 2 (internal knowledge only)"
  exit 1
fi

echo ""
echo "=============================================="
echo "WEbFETCH VERIFICATION COMPLETE"
echo "=============================================="
```

**Verification Pass/Fail Criteria** (C #8):
- **PASS**: All 3 tests pass (actual WebFetch, timeout, sub-agent mode)
- **FAIL**: Any test fails → Use Tier 2 fallback, mark suggestions with `[LIMITED_KNOWLEDGE]` tag
- **PARTIAL PASS**: WebFetch works but timeout unexpected → Proceed with Tier 1 but monitor closely
      - GitHub API: Document actual limit (unauth: verify 60 req/hour, auth: verify 5000 req/hour)
      - OSV API: Document actual limit (conservative: 100 req/hour)
      - Parallel WebFetch: Measure if 3 concurrent requests trigger rate limits faster
      - **Documentation Output**: `docs/api-rate-limits-measured.md`
        ```markdown
        # API Rate Limit Measurement Results (2026-02-21)

        ## GitHub API
        - Unauthenticated limit: 60 req/hour (documented: 60 req/hour) ✓ Confirmed
        - Authenticated limit: 5000 req/hour (with GITHUB_TOKEN)
        - Parallel burst: 5 concurrent requests OK, 10 requests trigger 429 after 3rd

        ## OSV API
        - Conservative limit: 100 req/hour (estimated)
        - Actual observed limit: ~150 req/hour (no official documentation)
        - Parallel burst: 10 concurrent requests OK, 15 requests trigger 429

        ## Recommendations
        - Use GITHUB_TOKEN for 83x capacity increase
        - Conservative OSV limit of 100 req/hour is safe
         - Parallel WebFetch limited to 3 concurrent requests to avoid rate limits
         ```
     - **If Measurement Fails**:
       - If GitHub limit <60 req/hour or triggers earlier: Update rate-limiter.mjs limits
       - If OSV limit <100 req/hour: Update rate-limiter.mjs to 50 req/hour (half)
       - If parallel requests cause issues: Reduce concurrent requests from 3 to 2
 - **Day 11 (P2 - IMPORTANT)**: Implement orchestrator-based user interaction
- **Day 12 (P2 - IMPORTANT)**: Pre-seed cache implementation for common feature categories (auth, database, API, logging, testing, async), offline mode implementation
- **Day 13 (P1 - CRITICAL)**: **COMPREHENSIVE FALLBACK TESTING**: Integration tests for Tier 2→3→4 transitions, partial failure scenarios, persistent failure detection with monitoring alerts (CRITICAL PATH)
- **Day 14 (P3 - NICE_TO_HAVE)**: Final integration testing, bug fixes, documentation, Windows compatibility testing (WSL 2 only)

**Priority Notes**:
- **CRITICAL**: Fallback mechanism testing (Day 5-6, 13) must complete before final integration testing
- **BLOCKER**: Do not proceed to Day 7 (pipeline integration) if fallback mechanism tests (Day 5-6) fail
- **RATIONALE**: GLM4.7 dispatch failure scenarios are critical path - three-tier fallback system must be thoroughly tested first

**Test Suites Implementation Schedule**:
- Suites 1-3 (Unit tests): Day 1-2
- Suite 4 (Integration tests): Day 3-4
- Suite 5 (Contract tests): Day 9-10
- Suite 6 (Manual acceptance tests): Day 11-12
- Additional Tier transition tests: Day 13

## Performance Validation

### SC-005: 5-Minute Exploration Target Validation

**Current Status**: The 5-minute target in spec SC-005 requires validation against GLM4.7 capabilities.

**CRITICAL REQUIREMENT**: Baseline testing on Phase 2 Day 1 is **MANDATORY** before proceeding with implementation. The 5-minute target cannot be assumed without empirical measurement in production-like environment.

**Circular Dependency Resolution** (C #13):
- **Issue**: Baseline testing requires suggestion phase infrastructure, but baseline must be measured before implementation
- **Solution**: Use two-phase testing approach:
  1. **Phase 2 Day 1 - Minimal Prototype Baseline**:
     - Deploy minimal GLM4.7 exploration script (full suggestion phase not required)
     - Measure raw GLM4.7 exploration time without validation/pipeline overhead
     - Establish baseline for AI model performance only
     - Pass/Fail criterion: GLM4.7 raw exploration time ≤ 4 minutes per feature
  2. **Phase 2 Day 11-13 - Full System Validation**:
     - After full implementation, measure end-to-end performance including validation/pipeline
     - Compare actual performance with Day 1 baseline
     - Adjust SC-005 target if actual performance differs significantly (>20%)

**Explicit Go/No-Go Criteria After Baseline Testing** (H #5):
- **Go Criteria (Proceed with 5-minute target)**:
  - ≥8 out of 10 test sessions meet 5-minute target (≥80% pass rate)
  - OR ≥6 out of 10 sessions meet 5-minute target with ≥10% improvement potential identified
  - AND no session exceeds 7 minutes (hard timeout)
  - **Action**: Proceed with implementation, SC-005 remains "Average exploration phase completes within 5 minutes"

- **No-Go Criteria (Automatic target adjustment to 7 minutes)**:
  - <6 out of 10 test sessions meet 5-minute target (<60% pass rate)
  - OR ≥3 sessions exceed 7-minute hard timeout
  - OR median completion time >6 minutes
  - **Action**: Automatically adjust SC-005 to "Average exploration phase completes within 7 minutes"
  - **Decision Documentation**:
    ```yaml
    # ${FEATURE_DIR}/baseline-decision.yaml
    baseline_testing_decision:
      date: "2026-02-17"
      phase_2_day: "1"
      total_sessions: 10
      sessions_meeting_5min_target: 4
      sessions_meeting_7min_target: 8
      sessions_exceeding_hard_timeout: 2
      median_completion_time_minutes: 6.2
      go_no_go_decision: "NO_GO"
      adjusted_target_minutes: 7
      rationale: "Less than 60% of sessions met 5-minute target (4/10 = 40%). Adjusting to 7-minute target based on empirical baseline."
      approved_by: "Project Lead"
    ```
  - **Spec Update Process**:
    1. Update spec.md SC-005: "Average exploration phase completes within 7 minutes"
    2. Update complexity classification matrix targets:
       - Simple: ≤3 minutes → ≤4 minutes
       - Medium: ≤5 minutes → ≤7 minutes
       - Complex: ≤7 minutes → ≤10 minutes
    3. Update performance targets in plan.md accordingly
    4. Document adjustment rationale in baseline-decision.yaml

- **Re-Test Criteria (If borderline)**:
  - 6-7 out of 10 sessions meet 5-minute target (60-70% pass rate)
  - **Action**: Run 5 additional test sessions with optimization attempts
  - **If re-test passes** (≥8/15 total): Go with 5-minute target
  - **If re-test fails** (<12/15 total): No-Go, adjust to 7-minute target

**Validation Strategy**:

1. **Baseline Testing (Phase 2, Day 1) - MANDATORY PRE-IMPLEMENTATION REQUIREMENT**:
    - **Blocking Condition**: Do NOT proceed with Phase 2 Day 2 implementation until baseline testing completes with documented results
    - **Test Environment**: MUST use production-like environment with actual API calls (not simulated)
    - Run 10 exploration sessions with varying feature complexity (simple, medium, complex)
    - Measure actual completion times for each
    - Calculate mean, median, and 95th percentile
    - **Document approach**: Use 5 controlled test features (simple: "add logging", medium: "user authentication", complex: "payment processing") × 2 iterations each for statistical significance
    - **Baseline Measurement Requirement**: Before implementation, measure and document:
      - Average developer research time per feature without suggestion phase (baseline for ROI calculation)
      - Time spent on library evaluation (research, verification, decision-making)
      - Time spent on best practice research
      - Estimated developer time saved per feature
      - Cost avoided by filtering bad dependencies (16 hours per avoided dependency replacement)

2. **Performance Targets**:
    - Simple features (1-3 entities): ≤ 3 minutes
    - Medium features (4-7 entities): ≤ 5 minutes
    - Complex features (8+ entities): ≤ 7 minutes
    - Overall average: ≤ 5 minutes (SC-005 target)

3. **Complexity Classification Matrix** (H #4):
    To make SC-005 measurable, feature complexity is defined by entity count:

    | Complexity Level | Entity Count | Description | Examples | Target Time |
    |-----------------|--------------|-------------|-----------|-------------|
    | **Simple** | 1-3 entities | Single-domain features with minimal dependencies | Add logging, add input validation, add unit tests | ≤ 3 minutes |
    | **Medium** | 4-7 entities | Multi-domain features with moderate dependencies | User authentication, database migration, API endpoint + validation | ≤ 5 minutes (SC-005) |
    | **Complex** | 8+ entities | Cross-domain features with heavy dependencies | Payment processing, file upload + storage + validation + notifications | ≤ 7 minutes |

    **Entity Definition**:
    - An "entity" is one of:
      - A library/package to be suggested (e.g., passport, prisma, jest)
      - A best practice pattern (e.g., OAuth2 flow, REST API design)
      - A tool requirement (e.g., Docker, Redis, Nginx)
      - A usage pattern/template (e.g., repository structure, CI/CD pipeline)

    **Classification Examples**:
    ```yaml
    # Simple (1-3 entities)
    feature: "Add logging to API"
    entities:
      - winston (logging library)
      - log format pattern
      - log levels
    entity_count: 3
    complexity: simple
    target_time: 3 minutes

    # Medium (4-7 entities)
    feature: "Add user authentication"
    entities:
      - passport (auth library)
      - bcrypt (password hashing)
      - JWT (token management)
      - OAuth2 flow pattern
      - session management
    entity_count: 5
    complexity: medium
    target_time: 5 minutes

    # Complex (8+ entities)
    feature: "Add payment processing"
    entities:
      - stripe (payment gateway)
      - webhooks (payment confirmation)
      - database schema (transactions table)
      - Redis (rate limiting)
      - validation (card format)
      - error handling (payment failures)
      - retry logic (failed payments)
      - logging (payment audits)
      - monitoring (payment success rate)
    entity_count: 9
    complexity: complex
    target_time: 7 minutes
    ```

    **Auto-Classification Algorithm**:
    ```javascript
    function classifyFeatureComplexity(entities) {
      const entityCount = entities.length;
      let complexity;

      if (entityCount <= 3) {
        complexity = 'simple';
      } else if (entityCount <= 7) {
        complexity = 'medium';
      } else {
        complexity = 'complex';
      }

      return {
        entityCount,
        complexity,
        targetTime: getTargetTime(complexity)
      };
    }

    function getTargetTime(complexity) {
      const targets = {
        simple: 3 * 60 * 1000,    // 3 minutes in ms
        medium: 5 * 60 * 1000,    // 5 minutes in ms
        complex: 7 * 60 * 1000    // 7 minutes in ms
      };
      return targets[complexity];
    }
    ```

3. **Performance Optimization Techniques**:
   - Parallel WebFetch requests (up to 3 concurrent)
   - Caching of frequently accessed documentation
   - Source prioritization (check GitHub API before web search)
   - Result truncation for complex features (limit to top 5 suggestions)

4. **Fallback Targets**:
    - If 80%+ of sessions meet 5-minute target → target validated
    - If 60-80% meet target → optimize sources or increase target to 7 minutes
    - If <60% meet target → implement incremental exploration with user confirmation checkpoints

5. **Optimization Path (if 60-80% meet 5-minute target)** (C #1):
    If baseline testing shows 60-80% of sessions meet the 5-minute target:
    - **Reduced API calls**: Batch API requests (GitHub, OSV, npm/PyPI) into single parallel batch
      - Before: Sequential API calls for each suggestion (5-10 API calls × 3-5 suggestions = 15-50 calls)
      - After: Single batch request to each API (3-4 total calls)
      - Expected savings: 2-3 minutes per session
    - **Parallel requests**: Execute API calls concurrently (Promise.all) instead of sequentially
      - Before: GitHub API (500ms) → OSV API (300ms) → npm API (200ms) = 1s per suggestion
      - After: All APIs in parallel = max(500ms, 300ms, 200ms) = 500ms per suggestion
      - Expected savings: 30-60 seconds per session
    - **Caching**: Cache frequently accessed documentation and API responses
      - Cache popular libraries (express, passport, prisma, etc.) for 24 hours
      - Expected hit rate: 40-60% for common feature categories
      - Expected savings: 1-2 minutes per cached session
    - **Simplified validation**: Skip optional validation steps for high-confidence suggestions
      - Skip issue resolution rate for libraries with >10k stars (already trusted)
      - Skip transitive dependency scan for libraries with security_score >90
      - Expected savings: 30-60 seconds per session

6. **Success Criteria for Validation**:
     - At least 8/10 test sessions complete within 5 minutes
     - Timeout mechanism works correctly for failed sessions
     - Fallback triggers appropriately on slow sessions
     - **Clear Pass/Fail Criteria** (C #1, C #4):
       - **PASS**: ≥8/10 sessions meet target (simple ≤3 min, medium ≤5 min, complex ≤7 min)
       - **FAIL**: <8/10 sessions meet target OR any session exceeds 10 minutes (hard timeout)
       - **OPTIMIZE**: 6-7/10 sessions meet target (proceed with optimization path above)
       - **ADJUST TARGET (C #4)**: <6/10 sessions meet target AND optimization doesn't improve >20% → increase SC-005 to 7 minutes

**Validation and Adjustment Plan** (C #4):
- **Baseline Testing Execution**:
  1. Run 10 exploration sessions with 3 test features × 2 iterations each for statistical significance
  2. Record actual completion times for each session
  3. Calculate mean, median, and 95th percentile
- **Decision Logic**:
  - **If ≥8/10 sessions meet 5-minute target**: Validation passed, proceed with current spec
  - **If 6-7/10 sessions meet 5-minute target**: Apply optimization path (batching, parallel requests, caching, simplified validation)
  - **If <6/10 sessions meet 5-minute target**:
    1. Apply optimization path first
    2. Re-test with optimizations applied
    3. **If still <6/10 sessions meet target after optimization**: Update SC-005 to 7 minutes
    4. **If optimization improves >20%**: Consider keeping 5-minute target with optimization documented
- **Spec Adjustment Process**:
  1. If SC-005 target adjustment is required:
     - Update spec.md SC-005: "Average exploration phase completes within 7 minutes"
     - Document baseline testing results in quickstart.md
     - Update complexity classification matrix with adjusted targets
     - Add note to plan.md explaining adjustment rationale
  2. Log all optimization attempts and results for future reference

**Adjustment Plan**:
- If validation fails, update SC-005 to "Average exploration phase completes within 7 minutes"
- Document actual performance metrics in quickstart.md for user expectations
- Log optimization path taken if 60-80% meet target (document which optimizations were applied)
- **Critical Note (C #4)**: For complex features (8+ entities), 7-minute target is realistic given API performance and network latency. Baseline testing will validate this assumption.

### Suggestion Quality vs Speed Tradeoff Analysis

**Issue**: Aggressive timeouts may produce superficial suggestions with limited research depth.

**Research Depth by Timeout Duration**:

| Timeout | Research Depth | Suggestion Quality | Expected Use Case |
|---------|---------------|-------------------|-------------------|
| 3 minutes (Simple) | Single source validation (GitHub API only) | Basic: Stars, last commit, basic CVE check | Simple features with 1-3 entities |
| 5 minutes (Medium) | Multi-source validation (GitHub + OSV + npm/PyPI) | Good: Maintainability scores, security scores, alternatives | Medium features with 4-7 entities |
| 7 minutes (Complex) | Comprehensive validation + comparative analysis | Excellent: Deep research, multiple alternatives, trade-offs | Complex features with 8+ entities |
| 10 minutes (Extended) | All sources + web search + documentation review | Premium: Exhaustive research, niche tools considered | Critical infrastructure features |

**Quality Indicators by Timeout**:

**3 minutes (Basic)**:
- GitHub API data: stars, last update, open issues
- OSV CVE check (single query)
- No alternative suggestions
- No usage examples
- No comparative analysis

**5 minutes (Good)**:
- All GitHub metrics + issue resolution rate
- OSV CVE check + security audit indicators
- 2-3 alternative suggestions
- Basic usage examples (from README)
- Simple comparison (stars/score only)

**7 minutes (Excellent)**:
- All GitHub metrics + maintainer responsiveness
- OSV CVE check + npm/PyPI audit integration
- 3-5 alternative suggestions with scores
- Detailed usage examples from docs
- Comparative analysis (pros/cons table)

**10 minutes (Premium)**:
- All sources + web search for niche tools
- Full transitive dependency security analysis
- 5+ alternatives including niche options
- Code examples from multiple sources
- Deep dive on trade-offs and decision criteria

**Recommended Strategy**:
- **Default**: Use feature-based timeout (simple/medium/complex) with corresponding quality level
- **Override**: Allow manual timeout override in config for critical features
- **Quality Warning**: If using 3-minute timeout on complex features, display warning about limited research depth
- **Quality Metrics**: Track suggestion acceptance rate by timeout to validate quality assumptions

**Implementation**:
```javascript
// In suggestion-exploration agent
function getQualityTarget(timeout) {
  if (timeout <= 180) return 'basic';
  if (timeout <= 300) return 'good';
  if (timeout <= 420) return 'excellent';
  return 'premium';
}

async function exploreWithQuality(prompt, timeout) {
  const quality = getQualityTarget(timeout);
  const maxAlternatives = quality === 'basic' ? 1 :
                         quality === 'good' ? 3 :
                         quality === 'excellent' ? 5 : 10;

  // Adjust research depth based on quality target
  // ...
}
```

## GLM4.7 Fallback Mechanism

### Concrete Fallback Definition

While research.md identified fallback as a research area, this plan defines the concrete fallback strategy for production use.

**Fallback Architecture**: Three-tier cascading fallback system

#### Tier 1: GLM4.7 Native Execution (Primary)
**Trigger**: GLM4.7 available and accessible
**Behavior**:
```markdown
Task(subagent_type="suggestion-exploration", model="zai-coding-plan/glm-4.7", prompt=<exploration prompt>)
```
- Uses WebFetch for research
- 5-minute timeout enforced
- Full maintainability/security validation

#### Tier 2: GLM4.7 Internal Knowledge (Secondary)
**Trigger**: GLM4.7 available but WebFetch fails or unavailable
**Behavior**:
```markdown
Task(subagent_type="suggestion-exploration", model="zai-coding-plan/glm-4.7", prompt=<exploration prompt with no-webfetch mode>)
```
- Exploration relies on training data (knowledge cutoff: October 2024)
- Maintainability scores based on historical data (may be outdated)
- Security scores based on known CVEs up to knowledge cutoff
- Adds `[LIMITED_KNOWLEDGE]` tag to all suggestions
- Prompts user to manually verify current status
- **[STALE_RISK] tag for outdated libraries** (H #2): When using internal knowledge, libraries with last update >6 months from GLM4.7 knowledge cutoff (April 2024) are tagged with `[STALE_RISK]`

**User Guidance for STALE_RISK Warnings** (C #2):
When `[STALE_RISK]` tag is displayed in Tier 2 fallback:
1. **Display Format**:
    ```yaml
    suggestion:
      name: "example-library"
      tags: ["[LIMITED_KNOWLEDGE]", "[STALE_RISK]"]
      stale_risk_warning: |
        ⚠ Warning: This library may be outdated.
        Last known update: 2024-03-15 (>6 months old as of October 2024)
        Data source: GLM4.7 internal knowledge (knowledge cutoff: October 2024)
    ```

**[LIMITED_KNOWLEDGE] Tag Behavior Documentation** (C #2):
When WebFetch tool is unavailable in GLM4.7 sub-agent mode, all suggestions will be tagged with `[LIMITED_KNOWLEDGE]`:

**Tag Meaning**:
- **[LIMITED_KNOWLEDGE]** indicates suggestions are based on GLM4.7's training data (knowledge cutoff: October 2024)
- Suggestions may not reflect the latest library versions, CVEs, or maintenance status
- User must manually verify current status before accepting
- Quality is **LOWER** than Tier 1 (WebFetch enabled) due to stale data

**User Acceptance Criteria for [LIMITED_KNOWLEDGE]**:
- User acknowledges data is stale (pre-knowledge cutoff)
- User manually verifies library status (check GitHub repo, npm version)
- User accepts risk of potential incompatibility or new CVEs
- Decision is documented in suggestion-decisions.yaml with explicit acceptance of limited knowledge

**Fallback Behavior**:
- If WebFetch unavailable → Tier 2 (internal knowledge only)
- If Bash/curl unavailable → Tier 2 (internal knowledge only)
- If both WebFetch and Bash/curl unavailable → Tier 2 (internal knowledge only)
- If GLM4.7 unavailable → Tier 3 (manual input)
- If all tiers fail → Tier 4 (continue with warnings only)

**Measurable Quality Differences Between Tier 1 and Tier 2** (H #6):

**Quality Comparison Table**:

| Quality Metric | Tier 1 (WebFetch Enabled) | Tier 2 (WebFetch Unavailable) | Expected Impact |
|--------------|---------------------------|-------------------------------|-----------------|
| **CVE Detection Rate** | ~95% (real-time OSV queries) | ~75% (knowledge cutoff: Oct 2024) | 20% lower, may miss recent CVEs |
| **Data Staleness** | Real-time (≤1 hour old) | Up to 16 months old (cutoff to now) | Significantly higher stale risk |
| **Maintainability Score Accuracy** | ±5% (current GitHub data) | ±15% (historical data, may be outdated) | 3x lower accuracy |
| **Library Trend Awareness** | Includes trending libraries (last 30 days) | Misses libraries popularized after Oct 2024 | May suggest deprecated tools |
| **Alternative Suggestions** | 3-5 alternatives with current comparisons | 2-3 alternatives (limited to pre-2024 knowledge) | Fewer, potentially outdated options |
| **Usage Examples** | Latest documentation (current version) | Documentation may be outdated | May suggest deprecated APIs |
| **Expected User Acceptance Rate** | ~70-75% (high quality) | ~50-60% (quality concerns) | 15-25% lower adoption |

**Quantified Quality Impact Examples**:

**Example 1: CVE Detection**
- **Tier 1**: WebFetch queries OSV API → Returns CVE-2024-12345 (discovered Jan 2024) → Library tagged with security risk → Excluded
- **Tier 2**: GLM4.7 internal knowledge (cutoff Oct 2024) → CVE-2024-12345 not in training data → Library tagged as "secure" (false positive) → User accepts vulnerable library
- **Expected Impact**: Tier 2 has ~20% higher false negative rate for recent CVEs (CVEs discovered 6-12 months after knowledge cutoff)

**Example 2: Library Popularity**
- **Tier 1**: WebFetch queries GitHub → Express.js: 75,000 stars (current) → Score: 95
- **Tier 2**: GLM4.7 internal knowledge (Oct 2024) → Express.js: 68,000 stars (historical) → Score: 90
- **Expected Impact**: Tier 2 scores are 5-10 points lower on average for actively maintained libraries

**Example 3: Alternative Discovery**
- **Tier 1**: WebFetch researches "authentication libraries" → Returns: passport, next-auth, @auth/nextauth, Lucia, Clerk (5 alternatives, including 2 popularized after Oct 2024)
- **Tier 2**: GLM4.7 internal knowledge → Returns: passport, next-auth, @auth/nextauth, Lucia (4 alternatives, misses Clerk released Nov 2024)
- **Expected Impact**: Tier 2 misses libraries popularized after knowledge cutoff, reducing options by 15-25%

**Quality Monitoring Metrics (Tier 2 Usage)**:

```javascript
// lib/quality-tracker.mjs
class QualityTracker {
  constructor() {
    this.tierQualityMetrics = {
      tier1: {
        cveDetectionRate: 0.95,      // 95% of recent CVEs detected
        stalenessAvgDays: 0.5,        // Average data age: 0.5 days
        maintainabilityAccuracy: 0.95,   // ±5% accuracy
        suggestionAdoptionRate: 0.75   // 75% user acceptance
      },
      tier2: {
        cveDetectionRate: 0.75,      // 75% (20% lower)
        stalenessAvgDays: 240,       // Average: 8 months (240 days)
        maintainabilityAccuracy: 0.85,   // ±15% accuracy (3x lower)
        suggestionAdoptionRate: 0.55   // 55% user acceptance (20% lower)
      }
    };
  }

  recordTierUsage(tier, suggestions) {
    const metrics = this.tierQualityMetrics[`tier${tier}`];

    // Track CVE detection effectiveness
    suggestions.forEach(suggestion => {
      const cveCheck = this.validateCVEsWithLiveAPI(suggestion);
      suggestion.cveDetectionAccuracy = cveCheck.accuracy;
      this.updateTierMetric(tier, 'cveDetectionRate', cveCheck.accuracy);
    });

    // Track data staleness
    const avgStaleness = this.calculateAverageStaleness(suggestions);
    this.tierQualityMetrics[`tier${tier}`].stalenessAvgDays = avgStaleness;

    // Track user acceptance (from suggestion-decisions.yaml)
    const adoptionRate = this.calculateAdoptionRate(suggestions);
    this.tierQualityMetrics[`tier${tier}`].suggestionAdoptionRate = adoptionRate;
  }

  validateCVEsWithLiveAPI(suggestion) {
    // Cross-check GLM4.7 CVE suggestions with live OSV API
    const liveCVEs = await fetchOSVVulnerabilities(suggestion.name, suggestion.ecosystem);
    const glm4_7CVEs = suggestion.securityIssues || [];

    const missedCVEs = liveCVEs.filter(live => 
      !glm4_7CVEs.some(glm => glm.id === live.id)
    );

    const falseNegatives = missedCVEs.length;
    const totalCVEs = liveCVEs.length;

    return {
      accuracy: Math.max(0, (totalCVEs - falseNegatives) / totalCVEs),
      missedCVEs,
      totalCVEs
    };
  }

  calculateAverageStaleness(suggestions) {
    const now = Date.now();
    const stalenessDays = suggestions.map(s => {
      const lastVerified = new Date(s.last_verified || '2024-10-01').getTime();
      return (now - lastVerified) / (1000 * 60 * 60 * 24);
    });
    return stalenessDays.reduce((a, b) => a + b, 0) / stalenessDays.length;
  }

  getQualityReport(tier) {
    const metrics = this.tierQualityMetrics[`tier${tier}`];
    return {
      tier,
      cveDetectionRatePercent: (metrics.cveDetectionRate * 100).toFixed(1),
      expectedMissedCVEsPer100: Math.round((1 - metrics.cveDetectionRate) * 100),
      stalenessAvgDays: metrics.stalenessAvgDays.toFixed(1),
      maintainabilityAccuracyPercent: (metrics.maintainabilityAccuracy * 100).toFixed(1),
      suggestionAdoptionRatePercent: (metrics.suggestionAdoptionRate * 100).toFixed(1),
      overallQualityScore: (
        metrics.cveDetectionRate * 0.4 +
        (1 - metrics.stalenessAvgDays / 365) * 0.3 +
        metrics.maintainabilityAccuracy * 0.2 +
        metrics.suggestionAdoptionRate * 0.1
      ) * 100
    };
  }
}

const qualityTracker = new QualityTracker();
```

**Quality Warning Display for Tier 2**:

```yaml
# When Tier 2 is active, display quality warning in suggestions.yaml
quality_warning: |
  ⚠ QUALITY REDUCED: WebFetch unavailable, using GLM4.7 internal knowledge (Tier 2)

  Expected Quality Impact:
    - CVE Detection: 75% (Tier 1: 95%) - 20% lower, may miss recent vulnerabilities
    - Data Staleness: ~8 months average (Tier 1: <1 day)
    - Maintainability Accuracy: ±15% (Tier 1: ±5%)
    - Suggestion Acceptance: 55% (Tier 1: 75%)

  Recommendations:
    1. Manually verify library status on GitHub before accepting
    2. Check for recent CVEs: https://osv.dev/vulnerability
    3. Verify library is actively maintained (last commit <6 months ago)
    4. Consider installing GITHUB_TOKEN for 83x API capacity increase

  To improve quality:
    - Set GITHUB_TOKEN: export GITHUB_TOKEN="ghp_your_token"
    - Re-run suggestion phase with WebFetch enabled
    - Provide manual input (Tier 3) for critical libraries
```

**Quality Dashboard Tracking**:

```javascript
// Add to quality_metrics in suggestions.yaml
quality_metrics:
  tier_used: 2
  webfetch_available: false
  cve_detection_rate: 0.75
  expected_missed_cves_per_100: 25
  data_staleness_avg_days: 240
  maintainability_accuracy: 0.85
  suggestion_adoption_rate: 0.55
  overall_quality_score: 67.5  // Tier 1 would be ~92.5
```
    - **Option C**: "Reject suggestion and request alternative"
      - System excludes suggestion from final list
      - Provides alternative suggestions without STALE_RISK tag if available
3. **Alternative Suggestions**:
    - If all suggestions have STALE_RISK tag, display fallback message:
      "All suggestions have [STALE_RISK] tag. Consider manual research or skip suggestions phase."
4. **Documentation in quickstart.md**:
    - Add section: "How to handle [STALE_RISK] warnings"
    - Provide checklist for manual verification of outdated libraries
    - Document [LIMITED_KNOWLEDGE] tag behavior and implications
    - Document Tier 2 fallback behavior when WebFetch unavailable

**Offline Mode Enhancement for Tier 2**:
- When WebFetch unavailable AND network connectivity detected as restricted:
  - Enable explicit offline mode flag
  - Use pre-seeded cache (from cache seeding strategy below) as primary data source
  - Augment GLM4.7 internal knowledge with cached high-confidence suggestions
  - Add `[OFFLINE_MODE]` tag in addition to `[LIMITED_KNOWLEDGE]`
  - Cache-first approach: Check pre-seeded cache before relying on internal knowledge
  - Display warning: "⚠ Offline mode active. Using cached data (last updated: [timestamp])"

#### Tier 3: Manual Research with Orchestrator (Tertiary)
**Trigger**: GLM4.7 unavailable or dispatch fails completely
**Behavior**:
```markdown
# Orchestrator takes over (not sub-agent)
1. Display: "⚠ GLM4.7探索に失敗しました。手動調査モードに切り替えます。"
2. AskUserQuestion (via orchestrator, not QuestionTools):
    - Option A: "手動でツール/ライブラリを入力する" → Provide input form
    - Option B: "提案なしでプランフェーズに進む" → Create empty suggestions.yaml
    - Option C: "共通ベストプラクティスを表示する" → Show generic best practices
3. If Option A:
    - User provides suggestion details (name, type, source URLs)
    - Orchestrator runs validation checks (Bash-based API calls to GitHub/OSV)
    - System validates and saves with scores
4. If Option B or user declines all options:
    - Create empty suggestions.yaml
    - Pipeline continues to plan phase
    - Log warning for monitoring
5. If Option C:
    - Display curated best practices by feature category (hardcoded in plan.md)
    - Examples: authentication (OAuth2, JWT), database (migration tools), API (REST vs GraphQL)
```

#### Tier 4: Continue with Warnings Only (Fallback for All Tiers Failed)
**Trigger**: All tiers fail or user declines all manual input options
**Behavior**:
```markdown
# Last resort: Continue pipeline without suggestions
IF Tier 3 user declines all options OR all tiers fail:
  → Display: "⚠ すべての提案ソースが利用不可または失敗しました。警告のみでプランフェーズに進みます。"
  → Create empty suggestions.yaml with warning metadata:
    ```yaml
    exploration_session:
      id: "<uuid>"
      status: "completed_with_warnings"
      findings_summary: "No suggestions available due to cascading failures"
      warnings:
        - "Tier 1 (GLM4.7 + WebFetch): Failed - [reason]"
        - "Tier 2 (GLM4.7 Internal Knowledge): Failed - [reason]"
        - "Tier 3 (Manual Input): User declined or unavailable"
    suggestions: []
    ```
  → Pipeline continues to plan phase
  → Log critical warning for monitoring
  → Add prompt in plan phase: "Consider manual tool/library research based on feature requirements"

**Handling Worst-Case Scenarios** (H #6):
1. **All tiers fail cascade**: Tier 4 ensures pipeline never gets stuck
2. **Malicious/hallucinated suggestions**: Library existence validation (H #4) filters these out before Tier 4
3. **Cascading failures with partial data**: Save partial results with warnings rather than failing completely
4. **User decision to skip**: Tier 4 provides explicit "continue without suggestions" path
```

**Decision Flow** (Updated with Tier 4):
```
START
  ↓
[GLM4.7 Available?] → YES → [WebFetch Working?] → YES → TIER 1 (Full)
                              ↓ NO
                            TIER 2 (Internal Knowledge + Warning)
  ↓ NO
[Try Dispatch?] → YES → [Dispatch Success?] → YES → [WebFetch?] → YES → TIER 1
                                          ↓ NO
                                        TIER 2
                              ↓ NO
                            TIER 3 (Manual via Orchestrator)
  ↓ NO (or Tier 3 declined)
TIER 4 (Continue with warnings only)
```

**Tier 4 Implementation**:
```javascript
// In poor-dev.suggest.md
function handleCompleteFailure(failureReasons) {
  const warnings = [
    `Tier 1 (GLM4.7 + WebFetch): Failed - ${failureReasons.tier1 || 'Unknown'}`,
    `Tier 2 (GLM4.7 Internal Knowledge): Failed - ${failureReasons.tier2 || 'Unknown'}`,
    `Tier 3 (Manual Input): ${failureReasons.tier3 || 'User declined'}`
  ];

  const suggestions = {
    exploration_session: {
      id: generateUUID(),
      status: 'completed_with_warnings',
      findings_summary: 'No suggestions available due to cascading failures',
      warnings
    },
    suggestions: []
  };

  writeSuggestions(suggestions);

  // Log critical warning
  console.error('[CRITICAL] All suggestion tiers failed. Continuing without suggestions.');
  console.error('[WARNINGS]', JSON.stringify(warnings, null, 2));

  // Pipeline continues to plan phase
}
```

### Fallback Trigger Conditions

**WebFetch Unavailable**:
```markdown
# Detection in suggestion-exploration agent
IF WebFetch throws error OR WebFetch not in tool list:
  → Switch to Tier 2 (internal knowledge)
  → Add [LIMITED_KNOWLEDGE] tag to all suggestions
  → Log: "WebFetch unavailable, using internal knowledge base"
```

**GLM4.7 Dispatch Failure**:
```markdown
# Detection in poor-dev.suggest.md
IF Task() returns error OR Bash dispatch fails:
  → Check error type:
    - Rate limit: Wait 60s, retry once, then Tier 3
    - Model unavailable: Tier 3 immediately
    - Timeout: Tier 3 immediately
    - Other: Log and Tier 3
```

**Network/Infrastructure Issues**:
```markdown
# Detection via connectivity checks
IF GitHub API unreachable AND npm/PyPI unreachable:
  → Assume network issue
  → Tier 3 with message: "外部サービスにアクセスできません。手動入力モードまたは提案なしで進みます。"
```

### Bash/Curl Fallback for API Validation

When GLM4.7 is unavailable but validation is still possible via direct API calls:

```bash
# GitHub API for maintainability
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
gh api repos/${repo_name} --jq '{stars,stargazers_count,updated_at,open_issues_count}' --method GET

# npm registry (no auth needed for public)
npm view ${package_name} | grep -E '(time|maintainers|keywords|homepage)'

# OSV API for security (no auth)
curl -s "https://api.osv.dev/v1/query?package={name:${package_name},ecosystem:npm}"

# PyPI (no auth for public)
curl -s "https://pypi.org/pypi/${package_name}/json" | jq '.info | {author,home_page,license,summary}'
```

### Fallback State Machine

```
START
  ↓
[GLM4.7 Available?] → YES → [WebFetch Working?] → YES → TIER 1 (Full)
                              ↓ NO
                            TIER 2 (Internal Knowledge + Warning)
  ↓ NO
[Try Dispatch?] → YES → [Dispatch Success?] → YES → [WebFetch?] → YES → TIER 1
                                          ↓ NO
                                        TIER 2
                              ↓ NO
                            TIER 3 (Manual via Orchestrator, includes "continue without")
```

### Fallback Metrics Tracking

Log fallback usage for monitoring:
```javascript
// In poor-dev.suggest.md
{
  feature_id: "008",
  tier_used: 2,
  reason: "webfetch_unavailable",
  suggestions_generated: 3,
  user_action: "proceeded_with_warnings"
}
```

**Monitoring Alerts**:
- Tier 2 usage > 20% → Investigate WebFetch stability
- Tier 3 usage > 15% → Investigate GLM4.7 availability
- If Tier 3 "continue without" > 10% → Investigate manual input UX
- **Tier 4 usage > 5% → CRITICAL ALERT for systematic GLM4.7 unavailability** (C #3):

**Escalation Path for "All Tiers Fail → BLOCKER"** (PR-23):

**Scenario**: All three tiers fail (GLM4.7 unavailable, WebFetch unavailable, Bash/curl unavailable)

**Escalation Steps**:
1. **Immediate (Hour 0)**:
   - Halt Phase 2 Day 5 implementation
   - Log critical error with full diagnostic output
   - Notify project lead with escalation summary
   - Create ticket in issue tracker

2. **Diagnostic Phase (Hours 0-2)**:
   - Run dependency verification checklist (jq, GLM4.7, API connectivity)
   - Check network connectivity and proxy settings
   - Test WebFetch availability in standalone mode (not sub-agent)
   - Review GLM4.7 model dispatch logs
   - Document all findings in `${FEATURE_DIR}/tier4-failure-diagnostic.md`

3. **Decision Point (Hour 2)**:
   - **If quick fix identified** (e.g., network issue, proxy config):
     - Apply fix
     - Re-run dependency verification
     - Resume implementation (same day)
   - **If systematic issue** (e.g., GLM4.7 model down, WebFetch permanently unavailable):
     - Activate fallback plan: Tier 2-only implementation (internal knowledge)
     - Proceed with degraded functionality (all suggestions tagged [LIMITED_KNOWLEDGE])
     - Document trade-off in plan.md
   - **If critical blocker** (no workaround available):
     - Defer suggestion phase to Phase 3
     - Continue with specify → plan pipeline only
     - Document blocker in `phase2-deferral-log.md`

4. **Recovery Timeline**:
   - Quick fix (network/config): Resume same day (0 delay)
   - Systematic issue with workaround: Resume next day (+1 day)
   - Critical blocker requiring deferral: +7-14 days (Phase 3 timeline)

5. **Documentation Requirements**:
   - All Tier 4 failures must create `tier4-failure-diagnostic.md`
   - Escalation decisions must be logged with timestamp and rationale
   - Recovery attempts must be documented with timestamps
   - Final resolution must update `plan.md` contingency plan

**Tier 3 Usage Threshold UX Research** (H #8, simplified for MVP):

**Issue**: Manual research mode (Tier 3) may defeat purpose of automation if triggered frequently (>15% Tier 3 usage).

**MVP Research Approach**:
- Conduct brief developer survey (10 participants, 15-minute online form)
- Key questions: At what Tier 3 usage frequency would you disable suggestion phase? What UX improvements would help?
- Validate monitoring threshold of 15-20% Tier 3 usage
- Phase 3: Post-release monitoring with alerts at 20% (warning) and 30% (critical)

**Tier 4 Failure Monitoring**:
- **5% threshold**: Indicates systematic issue requiring emergency response
- If >5% features hit Tier 4 daily for 3 consecutive days → investigate GLM4.7/WebFetch/API issues

## Competitive Analysis

### Architectural Alternatives Evaluation (C #7)

**Alternative Implementation Approaches**:

| Approach | Description | Pros | Cons | Selected Approach |
|----------|-------------|------|------|------------------|
| **Document-Based** | Suggestions stored as markdown documents in specs/ | Simple, version control friendly, human readable | No structure validation, difficult to query/analyze, manual parsing | ✅ SELECTED - Best balance for CLI tool |
| **Inline Scripts** | Suggestions embedded directly in command files | Single file, easy to deploy | Tightly coupled to commands, difficult to test independently | ❌ Not selected - Separation of concerns needed |
| **Node.js Modules** | Suggestions as installable npm packages | Reusable across projects, typed interfaces | Requires build/publish process, over-engineering for single use | ❌ Not selected - Out of scope for MVP |
| **External Microservices** | Suggestions via external API/HTTP service | Language agnostic, centralized updates | Requires infrastructure, adds network dependency, over-engineering | ❌ Not selected - Should be CLI-local |
| **SQLite Database** | Suggestions stored in local SQLite database | Fast queries, structured data, transaction support | Requires schema management, additional dependency | ❌ Not selected - File-based sufficient |

**Rationale for Document-Based Approach**:
- Fits existing CLI command structure (markdown-based)
- Native version control integration
- Human-readable for review/debugging
- No additional database dependency
- Simple to implement and maintain
- Scales adequately for feature-level suggestions

### AI Pair Programming Tools

**GitHub Copilot**:
- **Approach**: Inline code suggestions based on current context
- **Strengths**: Real-time, context-aware, low friction
- **Limitations**: Limited to code completion, no maintainability/security validation, no best practice research
- **Differentiation**: Our suggestion phase provides vetted tools/libraries with validation metrics before coding begins

**Cursor AI**:
- **Approach**: Context-aware code generation and file editing
- **Strengths**: Multi-file editing, project-wide understanding
- **Limitations**: Primarily focused on code generation, limited tool/library research capabilities
- **Differentiation**: Our suggestion phase focuses on architectural decisions and tool selection with validation

**Continue.dev**:
- **Approach**: Open-source code completion with local-first approach
- **Strengths**: Privacy-focused, extensible
- **Limitations**: Limited research capabilities for external tools/libraries
- **Differentiation**: Our suggestion phase actively researches and validates external dependencies

### CLI Suggestion Systems

**CLI scaffolding tools (Create React App, Vue CLI, etc.)**:
- **Approach**: Template-based project initialization with built-in best practices
- **Strengths**: Opinionated, quick start, consistent patterns
- **Limitations**: Static templates, no dynamic research, no maintainability validation
- **Differentiation**: Our suggestion phase provides dynamic research for any feature, maintainability validation, and user choice

**Package recommendation systems (npm suggest, etc.)**:
- **Approach**: Suggest packages based on keywords
- **Strengths**: Simple, fast, integrated with package managers
- **Limitations**: No validation, no maintainability assessment, no security checks
- **Differentiation**: Our suggestion phase validates suggestions for maintainability and security before presentation

### Ecosystem-Specific Package Recommendation Systems (C #5)

**libraries.io**:
- **Approach**: Aggregates package information from multiple ecosystems (npm, PyPI, RubyGems, etc.)
- **Strengths**: Cross-ecosystem search, dependency visualization, open source metrics
- **Limitations**: No maintainability validation, no security scoring, limited integration with development workflow
- **Differentiation**: Our suggestion phase provides maintainability/security validation and integrates with feature development pipeline

**Dependabot**:
- **Approach**: Automated dependency updates for GitHub repositories
- **Strengths**: Continuous monitoring, automatic PR creation, security alerts
- **Limitations**: Only for existing dependencies, no initial suggestion capability, reactive (not proactive)
- **Differentiation**: Our suggestion phase proactively suggests tools for new features before implementation

**Renovate**:
- **Approach**: Automated dependency updates with configurable rules
- **Strengths**: Cross-platform, highly customizable, supports monorepos
- **Limitations**: Only for existing dependencies, no maintainability assessment for new suggestions
- **Differentiation**: Our suggestion phase provides upfront maintainability scoring and best practice recommendations

**Snyk**:
- **Approach**: Security-focused dependency management and vulnerability scanning
- **Strengths**: Real-time security alerts, license compliance checking, deep dependency analysis
- **Limitations**: Security-focused only, no maintainability assessment, premium features require subscription
- **Differentiation**: Our suggestion phase provides balanced maintainability AND security validation for free

### Dependency Analysis and ADR Systems (C #5)

**ADR (Architecture Decision Record) Systems**:
- **adr-tools**: CLI tool for managing architecture decisions (Markdown-based)
- **Madr**: Minimal ADR template and process
- **Approach**: Track architectural decisions in version control
- **Strengths**: Decision traceability, team communication, historical context
- **Limitations**: Manual process, no validation of decisions, no suggestion capability
- **Differentiation**: Our suggestion phase integrates with ADR workflow by documenting tool/library selection decisions with validation metrics

**Dependency Management Systems**:
- **npm audit**: Built-in npm security auditing
- **yarn audit**: Yarn's security vulnerability scanner
- **pip-audit**: Python dependency vulnerability scanner
- **cargo-audit**: Rust dependency vulnerability scanner
- **Approach**: Scan existing dependencies for known vulnerabilities
- **Strengths**: Security-focused, ecosystem-specific, automated
- **Limitations**: Reactive (scans after installation), no upfront suggestion, no maintainability assessment
- **Differentiation**: Our suggestion phase provides proactive security validation BEFORE adoption, plus maintainability assessment

### Key Differentiators

1. **Validation-First Approach**: All suggestions validated for maintainability and security before presentation
2. **GLM4.7-Powered Research**: Active research rather than static templates
3. **User Agency**: Developers choose which suggestions to adopt
4. **Traceability**: All suggestions and decisions tracked in spec/
5. **Fallback Robustness**: Three-tier fallback ensures system always provides value
6. **Proactive Security**: Validates security BEFORE adoption, not after installation
7. **Balanced Scoring**: Combines maintainability AND security metrics (not security-only)

### Competitive Advantages

- **Quality over Speed**: Prioritizes validated, high-quality suggestions over quick but unvetted suggestions
- **Educational Value**: Provides rationale and usage examples with suggestions
- **Integration**: Seamlessly integrates into existing pipeline (specify → suggest → plan)
- **Customizable**: Can be configured per project/team preferences
- **Multi-Ecosystem**: Supports npm, PyPI, crates.io, Maven Central, RubyGems with ecosystem-specific validation

### Deferred Implementation Phases (PR-16, PR-2)

**Phase 2 (MVP - Current Implementation)**:
- **IN SCOPE**:
  - npm ecosystem support (primary)
  - Three-tier fallback mechanism
  - Basic maintainability/security validation
  - Pipeline integration (specify → suggest → plan)
  - Web-based exploration (GLM4.7 + WebFetch)
  - Pre-seeded cache for npm libraries
  - WSL 2 Windows support

**Phase 3 (Post-MVP - Planned but not scheduled)**:
- **DEFERRED (No concrete timeline)**:
  - Multi-ecosystem support (PyPI, crates.io, Maven Central, RubyGems)
  - Learning mechanism from accepted/rejected suggestions
  - Conflict resolution for competing suggestions
  - Native Windows PowerShell support
  - Advanced caching strategies (cache warming, tiered invalidation)
  - Developer feedback collection and analysis
  - Persistent failure detection with monitoring integration

**Phase 4 (Future - No timeline)**:
- **DEFERRED (No concrete timeline)**:
  - Autonomous suggestion improvement (machine learning)
  - Cross-project suggestion learning
  - A/B testing for suggestion ranking
  - Suggestion personalization per developer

## Pipeline Integration Points

### specify → suggest → plan Orchestration Bypass Contracts

This section documents specific contracts for integrating the suggestion phase into the existing pipeline while bypassing QuestionTools.

#### Integration Contract 1: specify → suggest Transition

**Trigger**: Completion of `/poor-dev.specify` command

**Contract Interface**:
```yaml
# Input to suggestion phase (passed via file)
${FEATURE_DIR}/spec.md:
  feature_branch: "008-add-bestpractice-suggest-phase"
  spec_complete: true
  spec_output_path: "${FEATURE_DIR}/spec.md"
  feature_context:
    description: "<feature description from specify>"
    tech_stack: "<detected tech stack>"
    user_stories: [<array from spec>]
```

**Transition Command** (in `/poor-dev.specify.md`):
```markdown
# After spec.md is written successfully

## Suggestion Phase Transition
Read "${FEATURE_DIR}/spec.md"
IF spec.md exists and valid:
  Bash: poor-dev suggest ${FEATURE_DIR} (run_in_background: false)
  # Direct dispatch, NOT via QuestionTools
ELSE:
  Error: "Specification incomplete, cannot proceed to suggestion phase"
```

**QuestionTools Bypass Rationale**:
- Suggestion phase is automated, not interactive
- User interaction happens AFTER suggestions are generated (orchestrator-based)
- Bypassing QuestionTools prevents unnecessary prompts and reduces friction

#### Integration Contract 2: suggest → plan Transition

**Trigger**: Completion of `/poor-dev.suggest` command

**Contract Interface**:
```yaml
# Output from suggestion phase (passed via file)
${FEATURE_DIR}/suggestions.yaml:
  exploration_session:
    id: "<uuid>"
    status: "completed"
    findings_summary: "<summary>"
  suggestions:
    - id: "<uuid>"
      type: "library"
      name: "<library_name>"
      maintainability_score: 85
      security_score: 90
      selected: false  # User will set this
    - ... (additional suggestions)

${FEATURE_DIR}/suggestion-decisions.yaml:
  decisions: []  # Populated after user review
```

**Transition Command** (in `/poor-dev.suggest.md`):
```markdown
# After suggestions.yaml is written successfully

## Plan Phase Transition
Read "${FEATURE_DIR}/suggestions.yaml"
Read "${FEATURE_DIR}/suggestion-decisions.yaml"
IF both files exist and valid:
  # Ask user for decision on suggestions (orchestrator-based, NOT QuestionTools)
  AskUserQuestion (via orchestrator, direct call):
    title: "提案の確認"
    description: "以下の提案から採用するものを選択してください"
    options:
      - "すべて採用する"
      - "一部採用する (選択画面へ)"
      - "すべて却下してプランに進む"
      - "提案を見直す"

  IF user selects "一部採用する":
    Display suggestions with details (maintainability/security scores)
    AskUserQuestion:
      title: "提案を選択"
      type: multiselect
      options: [<all suggestion IDs>]

  Save user selections to "${FEATURE_DIR}/suggestion-decisions.yaml"

  # Proceed to plan phase
  Bash: poor-dev plan ${FEATURE_DIR} (run_in_background: false)
ELSE:
  Error: "Suggestions incomplete, cannot proceed to plan phase"
```

#### Integration Contract 3: Orchestrator Bypass Specifics

**QuestionTools Bypass Mechanism**:

QuestionTools is designed for CLI-user interactions via markdown-based tools. The suggestion phase bypasses QuestionTools by:

1. **Direct Orchestrator Calls**:
   - Use `AskUserQuestion` directly from orchestrator context (not via /QuestionTools.ask)
   - Orchestrator runs suggestion phase inline, not as separate tool invocation
   - User interaction happens within suggestion phase command execution

2. **Non-Interactive Exploration**:
   - GLM4.7 sub-agent runs with `mode: subagent` (QuestionTools restricted)
   - Sub-agent prompt includes: `Do NOT use AskUserQuestion. Include questions as [NEEDS CLARIFICATION: question] markers.`
   - All user questions deferred to orchestrator level after exploration

3. **Flow Comparison**:

```yaml
# Traditional flow (with QuestionTools)
specify → QuestionTools.ask → user_input → plan

# New suggestion flow (bypassing QuestionTools)
specify → suggest (automated exploration) → Orchestrator.ask → user_input → plan
                                      ↑
                            GLM4.7 runs non-interactively
```

#### Integration Contract 4: State Persistence

**State File Contract**:
```yaml
# ${FEATURE_DIR}/.pipeline-state.json (shared across phases)
{
  "current_phase": "suggest",
  "phases_completed": ["specify"],
  "phase_status": {
    "specify": {"status": "completed", "completed_at": "2026-02-12T10:00:00Z"},
    "suggest": {"status": "in_progress", "started_at": "2026-02-12T10:05:00Z"},
    "plan": {"status": "pending"}
  },
  "suggestion_phase": {
    "exploration_id": "uuid-123",
    "fallback_tier_used": 1,
    "suggestions_count": 5,
    "user_decisions_recorded": false
  }
}
```

**State Transition Rules**:
1. `suggest` phase starts when `specify.status = completed`
2. `suggest` phase completes when `suggestion-decisions.yaml` is written with user selections
3. `plan` phase starts when `suggest.status = completed`
4. Each phase reads `.pipeline-state.json` on entry and updates on exit

#### Integration Contract 5: Error Propagation

**Error Handling Contract**:
```yaml
# If suggestion phase fails
${FEATURE_DIR}/exploration-failure.log:
  timestamp: "2026-02-12T10:10:00Z"
  phase: "suggest"
  error_type: "timeout|dispatch_failure|validation_error"
  error_message: "<detailed error>"
  fallback_tier_used: 2
  recovery_action: "continued_with_manual_input|proceeded_without_suggestions"
```

**Error Propagation Flow**:
```
suggest phase fails
  ↓
Write exploration-failure.log
  ↓
Update .pipeline-state.json (suggest.status = "failed")
  ↓
Display error to user (orchestrator)
  ↓
Offer recovery options (fallback tiers)
  ↓
User selects recovery action
  ↓
Proceed to plan phase (with or without suggestions)
```

#### Integration Contract 6: Backward Compatibility

**Existing Features** (feature branches < 008):
- Skip suggestion phase
- Direct specify → plan transition
- No changes to existing flow

**New Features** (feature branches >= 008):
- include suggestion phase
- specify → suggest → plan transition
- Configurable via `.poor-dev/config.json`:

```json
{
  "default": {
    "cli": "opencode",
    "model": "zai-coding-plan/glm-4.7"
  },
  "features": {
    "enable_suggestion_phase": true,
    "suggestion_required": false  # Can proceed without suggestions if failed
  }
}
```

### Implementation Sequence for Integration

1. **Phase 1 (Design)**:
    - Update `/poor-dev.specify.md` to call `/poor-dev.suggest.md`
    - Define `/poor-dev.suggest.md` transition to `/poor-dev.plan.md`
    - Design `.pipeline-state.json` schema

2. **Phase 2 (Implementation)**:
    - **Day 1**: Implement QuestionTools bypass integration test (critical path)
    - **Day 1-2**: Implement suggestion phase transition in `poor-dev.specify.md`
    - **Day 2-3**: Implement orchestrator-based user interaction in `poor-dev.suggest.md`
    - **Day 3-4**: Implement plan phase transition in `poor-dev.suggest.md`
    - **Day 4-5**: Implement state persistence logic

3. **Phase 3 (Testing)**:
    - E2E test: specify → suggest → plan flow
    - Test fallback scenarios: suggestion failure → manual → plan
   - Test backward compatibility: existing features skip suggestion
   - Test QuestionTools bypass: no prompts during exploration

### QuestionTools Bypass Integration Test (H #8)

**Critical Integration Test** (Phase 2 Day 1):
```javascript
// tests/integration/questiontools-bypass.test.mjs

describe('QuestionTools Bypass Integration', () => {
  describe('Suggestion Phase Non-Interactive Execution', () => {
    test('GLM4.7 sub-agent runs without QuestionTools prompts', async () => {
      // Mock GLM4.7 sub-agent execution
      const subAgentOutput = await runGLM4.7Exploration({
        feature: 'user authentication',
        mode: 'subagent', // QuestionTools restricted
        prompt: 'Do NOT use AskUserQuestion'
      });

      // Verify no QuestionTools interactions occurred
      expect(subAgentOutput.questionToolsCalls).toHaveLength(0);
      expect(subAgentOutput.askUserQuestions).toHaveLength(0);
    });

    test('User interaction deferred to orchestrator after exploration', async () => {
      // Run full suggestion phase
      const result = await runSuggestionPhase('auth-feature');

      // Verify orchestrator handled user interaction
      expect(result.userInteractionHandledBy).toBe('orchestrator');
      expect(result.questionToolsUsed).toBe(false);

      // Verify user questions were captured in orchestrator context
      expect(result.orchestratorQuestions).toBeDefined();
      expect(result.orchestratorQuestions.length).toBeGreaterThan(0);
    });

    test('Non-interactive GLM4.7 with orchestrator user interaction', async () => {
      const result = await runSuggestionFlow({
        feature: 'database feature',
        // GLM4.7 runs non-interactively
        exploration: {
          mode: 'subagent',
          restrictions: ['No AskUserQuestion', 'No interactive prompts']
        },
        // Orchestrator handles user interaction
        userInteraction: {
          handler: 'orchestrator',
          afterExploration: true
        }
      });

      // Verify correct flow
      expect(result.explorationNonInteractive).toBe(true);
      expect(result.userInteractionAfterExploration).toBe(true);
      expect(result.userInteractionHandler).toBe('orchestrator');
    });
  });

  describe('Orchestrator-Based User Interaction Flow', () => {
    test('orchestrator asks user after suggestions generated', async () => {
      const flow = await simulateSuggestionFlow();

      // Step 1: GLM4.7 generates suggestions (non-interactive)
      expect(flow.steps[0].name).toBe('GLM4.7 exploration');
      expect(flow.steps[0].userInteraction).toBe(false);

      // Step 2: Orchestrator displays suggestions
      expect(flow.steps[1].name).toBe('Display suggestions');
      expect(flow.steps[1].handler).toBe('orchestrator');

      // Step 3: Orchestrator asks user for decision
      expect(flow.steps[2].name).toBe('Ask user for decision');
      expect(flow.steps[2].handler).toBe('orchestrator');
      expect(flow.steps[2].questionToolsUsed).toBe(false);
    });

    test('multiple suggestion selections handled by orchestrator', async () => {
      const result = await runSuggestionWithMultipleChoices({
        suggestions: [
          { id: 's1', name: 'passport', selected: false },
          { id: 's2', name: 'express', selected: false },
          { id: 's3', name: 'prisma', selected: false }
        ]
      });

      // Verify orchestrator handled multiselect
      expect(result.userInteraction.handler).toBe('orchestrator');
      expect(result.userInteraction.type).toBe('multiselect');
      expect(result.userInteraction.selections).toEqual(['s1', 's3']);
    });
  });

  describe('Error Handling Without QuestionTools', () => {
    test('GLM4.7 timeout handled without QuestionTools prompts', async () => {
      const result = await runSuggestionPhaseWithTimeout({
        timeout: 100, // 100ms timeout
        fallback: 'manual'
      });

      // Verify fallback triggered without QuestionTools
      expect(result.fallbackTriggered).toBe(true);
      expect(result.questionToolsUsed).toBe(false);
      expect(result.orchestratorHandledFallback).toBe(true);
    });

    test('API errors handled by orchestrator, not QuestionTools', async () => {
      const result = await runSuggestionPhaseWithAPIFailure({
        api: 'github',
        error: 'rate_limit'
      });

      // Verify orchestrator handled error
      expect(result.errorHandler).toBe('orchestrator');
      expect(result.questionToolsUsed).toBe(false);
    });
  });
});
```

**Integration Test Execution Order** (Phase 2 Day 1):
1. Test 1: Verify GLM4.7 sub-agent runs without QuestionTools (baseline test)
2. Test 2: Verify user interaction deferred to orchestrator (integration test)
3. Test 3: Verify end-to-end flow from exploration to user decision (E2E test)

**Clear Pass/Fail Criteria**:

```javascript
// Pass/Fail Criteria Definition
const QuestionToolsBypassCriteria = {
  pass: {
    test1: {
      name: 'GLM4.7 non-interactive execution',
      criteria: [
        'GLM4.7 sub-agent executes without invoking AskUserQuestion',
        'questionToolsCalls array is empty',
        'askUserQuestions array is empty',
        'Exploration completes within timeout (30 seconds)'
      ]
    },
    test2: {
      name: 'Orchestrator-based user interaction',
      criteria: [
        'User interaction handled by orchestrator (not QuestionTools)',
        'Orchestrator questions array is non-empty',
        'questionToolsUsed flag is false',
        'User decisions captured correctly'
      ]
    },
    test3: {
      name: 'End-to-end flow',
      criteria: [
        'Full flow completes: exploration → orchestrator → user decision',
        'Suggestions generated and validated',
        'User selections saved to suggestion-decisions.yaml',
        'Pipeline transition to plan phase successful'
      ]
    }
  },
  fail: {
    test1: [
      'GLM4.7 sub-agent invoked AskUserQuestion',
      'GLM4.7 execution timed out (no response in 30 seconds)',
      'GLM4.7 dispatch failed (model unavailable or network error)'
    ],
    test2: [
      'QuestionTools was used for user interaction (questionToolsUsed == true)',
      'Orchestrator questions array is empty (no interaction)',
      'User decisions not captured or lost'
    ],
    test3: [
      'Pipeline transition failed to plan phase',
      'suggestions.yaml or suggestion-decisions.yaml missing/corrupted',
      'User selections not saved correctly'
    ]
  }
};

// Execution Result Example
{
  testResults: {
    test1: {
      status: 'PASS',
      metrics: {
        questionToolsCalls: 0,
        askUserQuestions: 0,
        executionTime: 12500 // 12.5 seconds
      }
    },
    test2: {
      status: 'PASS',
      metrics: {
        orchestratorQuestions: 5,
        questionToolsUsed: false,
        userCaptured: true
      }
    },
    test3: {
      status: 'PASS',
      metrics: {
        totalTime: 45200, // 45.2 seconds
        suggestionsGenerated: 3,
        userSelectionsSaved: true
      }
    }
  },
  overallStatus: 'PASS',
  canProceedToDay2: true
}
```

**Success Criteria**:
- ALL QuestionTools bypass tests pass (test1, test2, test3)
- GLM4.7 sub-agent demonstrates non-interactive behavior (0 QuestionTools calls)
- Orchestrator successfully handles user interaction (questionToolsUsed == false)
- End-to-end flow completes without errors (suggestions.yaml and suggestion-decisions.yaml valid)

**Failure Handling**:
- If ANY QuestionTools bypass test fails → **HALT Phase 2 Day 2 implementation**
- Run diagnostic checks:
  - `cat /tmp/questiontools-bypass-test.log` for detailed logs
  - Verify GLM4.7 sub-agent mode restrictions in agent configuration
  - Check orchestrator interaction logic for QuestionTools references
- Fix implementation and re-run all 3 tests until ALL pass
- Document any bypass workaround or configuration changes

**Exit Codes for Phase 2 Day 1 Tests**:
- Exit 0: ALL QuestionTools bypass tests passed (proceed to Phase 2 Day 2)
- Exit 1: Test 1 failed (GLM4.7 non-interactive execution)
- Exit 2: Test 2 failed (Orchestrator-based user interaction)
- Exit 3: Test 3 failed (End-to-end flow)
- Exit 4: Multiple tests failed

## ROI and Business Value

### Implementation Cost (UPFRONT - C #4)

**Total First-Year Implementation Cost**: $8,960
- Development time: 7 days × 8 hours × $80/hour = $4,480
- Testing and refinement: 3 days × 8 hours × $80/hour = $1,920
- Baseline measurement: 1 day × 8 hours × $80/hour = $640 (for Phase 2 Day 1)
- Ongoing maintenance: 2 hours/month × 12 months × $80/hour = $1,920

### Quantified Business Value

#### Cost Savings (Time Reduction) - Quantified (C #6)

**Current State (Manual Research) - Baseline Measurement**:
- **Baseline developer research time per feature** (to be measured in Phase 2 Day 1):
  - Library research: 20-40 minutes per library
  - Documentation review: 10-20 minutes per library
  - Comparison and evaluation: 15-30 minutes per library
  - Decision-making: 5-10 minutes
  - **Total estimated**: 50-100 minutes per feature (average: 75 minutes)
- Developer salary (estimated): $80/hour
- 10 features/month → 750 minutes/month → 12.5 hours/month → $1,000/month in research time
- **Annual research time cost**: 1,000 × 12 = $12,000/year

**Baseline Measurement Requirements** (C #7):
Before implementation, MUST measure:
1. Average developer time for library research per feature (record actual times from 5-10 developers)
2. Time spent reading documentation and comparing alternatives
3. Time spent on maintainability evaluation (checking GitHub stars, issues, updates)
4. Time spent on security evaluation (CVE research, security audits)
5. Number of libraries researched per feature (average: 3-5 libraries)
6. Number of features where bad dependencies were introduced (track for 3 months)
7. Cost of replacing bad dependencies (track actual time and cost)

**Baseline Measurement Template** (C #7):
```yaml
# ${FEATURE_DIR}/baseline-measurements.yaml
baseline_measurement:
  measurement_date: "2026-02-12"
  measurement_period: "3 months (pre-implementation)"
  developer_count: 10

  time_per_feature:
    total_research_time_minutes: 75  # Average from 50-100 range
    library_research_minutes: 30
    documentation_review_minutes: 15
    comparison_minutes: 20
    decision_making_minutes: 10

  cost_per_feature:
    developer_hourly_rate: 80  # USD/hour
    cost_per_feature: 100  # $100 per feature (75 min @ $80/hr)

  libraries_per_feature:
    average_libraries_researched: 4
    min_libraries_researched: 2
    max_libraries_researched: 7

  bad_dependencies_introduced:
    features_with_bad_deps: 6  # Out of 10 features tracked
    bad_dependency_rate: 60%
    replacement_cost_per_bad_dep_hours: 16
    replacement_cost_per_bad_dep_usd: 1280  # 16 hours × $80/hr

  total_annual_cost:
    features_per_year: 120
    total_research_cost: 12000  # 120 features × $100/feature
    total_bad_dependency_cost: 7680  # 6 bad deps/10 features × 120 features × $1280/dep
    total_cost: 19680
```

**Proposed State (Automated Suggestions)** - With Quantified Savings:
- **Exploration phase time**: 5 minutes (target, validated by baseline testing)
- **Developer review time**: 10 minutes (reading suggestions with scores)
- **Decision time**: 5 minutes (accept/reject based on scores)
- **Total**: 20 minutes per feature
- **Time saved per feature**: 75 - 20 = 55 minutes saved
- **10 features/month** → 200 minutes/month = $267/month
- **Annual research cost**: 267 × 12 = $3,204/year
- **Annual time savings**: $12,000 - $3,204 = $8,796/year
- **Percentage time savings**: 8,796 / 12,000 = 73.3% time reduction

#### Quality Improvements (Reduced Technical Debt) - Quantified (C #6)

**Technical Debt Impact** - Measured from Baseline:
- **Bad dependency rate from baseline**: 60% of features introduce problematic dependencies
- **Cost of replacing bad dependency**: 16 hours (research, migration, testing)
- **Cost per replacement**: 16 hours × $80/hour = $1,280
- **Annual bad dependency cost**:
  - 10 features/month × 60% bad deps = 6 bad dependencies/month
  - 6 × $1,280 = $7,680/month
  - Annual: $7,680 × 12 = $92,160/year

**Proposed State (Validated Suggestions)** - With Quantified Savings:
- **Maintainability threshold (>50) excludes 90% of bad dependencies**
- **Security threshold (>50) excludes 95% of insecure dependencies**
- **Combined effectiveness**: 85% reduction in bad dependencies
- **Remaining bad dependency rate**: 60% × (1 - 0.85) = 9%
- **Annual bad dependency cost (post-implementation)**:
  - 10 features/month × 9% bad deps = 0.9 bad dependencies/month
  - 0.9 × $1,280 = $1,152/month
  - Annual: $1,152 × 12 = $13,824/year
- **Annual technical debt savings**: $92,160 - $13,824 = $78,336/year
- **Percentage technical debt reduction**: 78,336 / 92,160 = 85.0% reduction

#### Security Risk Reduction - Quantified (C #6)

**Security Incident Cost** (industry estimates):
- **Average cost of data breach involving vulnerable dependencies**: $150,000
- **Probability per year with manual selection**: 15% (industry average for projects without security vetting)
- **Expected annual cost**: $150,000 × 0.15 = $22,500/year

**Proposed State (Validated Security)** - With Quantified Savings:
- **Security validation reduces probability by 80%**
- **New probability**: 15% × (1 - 0.80) = 3%
- **Expected annual cost**: $150,000 × 0.03 = $4,500/year
- **Annual security savings**: $22,500 - $4,500 = $18,000/year
- **Percentage security risk reduction**: 18,000 / 22,500 = 80.0% reduction

#### Total ROI Summary - Fully Quantified (C #6)

**Annual Benefits** (Quantified):
1. **Time savings**: $8,796 (73.3% reduction in research time)
2. **Technical debt reduction**: $78,336 (85.0% reduction in bad dependencies)
3. **Security risk reduction**: $18,000 (80.0% reduction in security incidents)
4. **Total Annual Benefit**: $8,796 + $78,336 + $18,000 = **$105,132/year**

**Implementation Costs**:
1. **Development time**: 7 days × 8 hours × $80/hour = $4,480
2. **Testing and refinement**: 3 days × 8 hours × $80/hour = $1,920
3. **Baseline measurement**: 1 day × 8 hours × $80/hour = $640 (for Phase 2 Day 1)
4. **Ongoing maintenance**: 2 hours/month × 12 months × $80/hour = $1,920
5. **Total First-Year Cost**: $4,480 + $1,920 + $640 + $1,920 = $8,960

**ROI Calculation**:
- **First Year ROI**: ($105,132 - $8,960) / $8,960 = **10.7x ROI**
- **Second Year ROI** (maintenance only): $105,132 / $1,920 = **54.8x ROI**
- **Payback Period**: $8,960 / ($105,132 / 12 months) = 1.02 months = **31 days**

**Per-Developer ROI Breakdown** (C #6):
- **Assumptions**: 1 developer working on 120 features/year (10 features/month)
- **Time saved per year**: 55 minutes/feature × 120 features = 110 hours/year
- **Annual developer savings**: 110 hours × $80/hour = $8,800
- **Technical debt avoided per year**: 6 bad deps/month × (1 - 0.85) × $1,280 = $1,152 × 12 = $13,824/year
- **Total per-developer benefit**: $8,800 + $13,824 = $22,624/year
- **Per-feature savings**: $22,624 / 120 features = **$188.53/feature**

**ROI by Benefit Type**:
| Benefit Type | Annual Benefit | Percentage of Total | ROI First Year | ROI Second Year |
|-------------|---------------|-------------------|-----------------|-----------------|
| Time Savings | $8,796 | 8.4% | 9.8x | 45.8x |
| Technical Debt Reduction | $78,336 | 74.5% | 87.4x | 407.9x |
| Security Risk Reduction | $18,000 | 17.1% | 20.1x | 93.8x |
| **Total** | **$105,132** | **100%** | **10.7x** | **54.8x** |

**Sensitivity Analysis** (C #6):
| Scenario | Time Saved | Bad Deps Avoided | Security Savings | Total Annual Benefit | ROI First Year |
|----------|-------------|-------------------|-----------------|---------------------|----------------|
| **Best Case** (20% better than estimated) | $10,555 | $94,003 | $21,600 | $126,158 | 13.1x |
| **Expected Case** (as calculated) | $8,796 | $78,336 | $18,000 | $105,132 | 10.7x |
| **Worst Case** (20% worse than estimated) | $7,037 | $62,669 | $14,400 | $84,106 | 8.4x |

**Success Criteria for ROI Validation** (C #6):
- **Minimum ROI threshold**: 5x first-year ROI
- **Expected ROI**: 10.7x (exceeds threshold by 2.1x)
- **Minimum payback period**: 6 months
- **Expected payback period**: 31 days (exceeds threshold by 5.8x)

### Qualitative Business Value

1. **Developer Experience**:
   - Reduces cognitive load (AI handles research)
   - Increases confidence in tool/library choices
   - Provides learning opportunities (rationale and examples)

2. **Code Quality**:
   - Consistent best practices across team
   - Modern tools and libraries (not outdated)
   - Reduced "reinventing the wheel"

3. **Team Velocity**:
   - Faster feature delivery (research time saved)
   - Less rework (fewer abandoned/insecure dependencies)
   - Knowledge sharing (suggestions documented and traceable)

4. **Risk Mitigation**:
   - Proactive security vetting (not reactive)
   - Maintainability monitoring (not post-facto)
   - Audit trail (all suggestions tracked)

### Success Metrics Tracking

**Spec Success Metrics Mapping** (C #5):

| Spec ID | Metric Description | Measurement Approach | Target | Implementation Location |
|---------|-------------------|----------------------|---------|------------------------|
| **SC-001** | 80% of feature additions receive at least one relevant suggestion | Count suggestions generated per feature / total features | ≥80% | `suggestions.yaml` generation rate tracking |
| **SC-002** | 90% of suggested tools/libraries have maintainability >70 and security >80 | Post-hoc audit of suggestion scores | Maintainability >70, Security >80 | `suggestions.yaml` score validation |
| **SC-003** | 70% of developers report suggestions help improve code quality or reduce implementation time | Quarterly developer survey | ≥70% satisfaction | Quarterly survey mechanism (Phase 3) |
| **SC-004** | Zero critical security incidents introduced via suggested tools/libraries | Security incident tracking | 0 critical incidents | Security incident log monitoring |
| **SC-005** | Average exploration phase completes within 5 minutes | Performance monitoring | ≤5 minutes average | Exploration session timing logs |
| **SC-006** | 60% of developers adopt at least one suggestion per feature | Adoption tracking from suggestion-decisions.yaml | ≥60% adoption rate | SuggestionDecision entity analysis |

**Success Targets Adjustment Note** (PR-15):
- **Current targets** (80-90%) are aggressive for a complex AI feature with multiple integration points
- **Post-Implementation Validation**: Targets will be adjusted based on actual performance after 20 features
- **Potential adjustments** (if actual performance is >15% below target for 3 consecutive measurements):
  - SC-001: 80% → 60-70%
  - SC-002: 90% → 70-80%
  - SC-003: 70% → 50-60%
  - SC-006: 60% → 40-50%

**Metrics Dashboard** (to be implemented in Phase 3):

```yaml
usage_metrics:
  suggestions_generated_per_month: 0
  suggestions_adoption_rate: 0  # Target: 60% (SC-006)
  average_exploration_time: 0  # Target: 5 minutes (SC-005)
```

**Success Criteria Validation for SC-006** (H #2):

**SC-006 Requirement**: "60% of suggested tools/libraries are adopted into implementation plans"

**Definition of "Suggestion Adoption"**:
Two metrics are tracked to measure suggestion adoption:

1. **Decision Acceptance Rate** (suggestion-decisions.yaml entries):
   - Count accepted suggestions: `suggestion-decisions.yaml` entries with `action: "accepted"`
   - Total presented: All suggestions in `suggestions.yaml`
   - Formula: `(accepted_count / total_presented) × 100`
   - **Target**: ≥60% acceptance rate

2. **Implementation Integration Rate** (actual code implementation):
   - Count suggestions that appear in plan.md as dependencies/tools
   - Verified by scanning plan.md for library names from suggestions.yaml
   - Formula: `(implemented_count / total_presented) × 100`
   - **Target**: ≥50% implementation rate (more conservative due to manual overrides)

**Primary Success Metric**: Decision Acceptance Rate
- This measures developer intent to use suggestions
- Captures decisions at suggestion review time
- Independent of downstream implementation changes
- **SC-006 Pass Criteria**: ≥60% decision acceptance rate over 20 features

**Secondary Success Metric**: Implementation Integration Rate
- This measures actual adoption in code
- Accounts for cases where developer changes mind during planning
- More conservative due to legitimate decision changes
- **Monitoring Target**: ≥50% implementation integration rate

**Measurement Implementation**:
```javascript
// lib/suggestion-adoption-tracker.mjs
class SuggestionAdoptionTracker {
  async calculateAdoptionRate(featureDir) {
    // Load suggestions.yaml (what was presented)
    const suggestions = await this.loadSuggestions(featureDir);
    const totalPresented = suggestions.length;

    // Load suggestion-decisions.yaml (user decisions)
    const decisions = await this.loadDecisions(featureDir);
    const acceptedCount = decisions.filter(d => d.action === 'accepted').length;

    // Load plan.md (actual implementation)
    const plan = await this.loadPlan(featureDir);
    const implementedCount = this.countImplementations(plan, suggestions);

    return {
      decisionAcceptanceRate: (acceptedCount / totalPresented) * 100,
      implementationIntegrationRate: (implementedCount / totalPresented) * 100,
      totalPresented,
      acceptedCount,
      implementedCount,
      meetsSC006: (acceptedCount / totalPresented) >= 0.60 // SC-006 threshold
    };
  }
}
```

**Tracking Dashboard**:
```yaml
suggestion_adoption_metrics:
  date: "2026-02-12"
  features_tracked: 20
  suggestions_presented_total: 100
  suggestions_accepted_total: 68
  suggestions_implemented_total: 52

  decision_acceptance_rate: 68%  # Primary metric (SC-006 target: 60%)
  implementation_integration_rate: 52%  # Secondary metric (monitoring)

  sc006_status: "PASS"  # 68% >= 60% target
```

quality_metrics:
  maintainability_score_average: 0  # Target: >70 (SC-002)
  security_score_average: 0  # Target: >80 (SC-002)
  abandoned_dependencies_introduced: 0  # Target: 0 (SC-004)
  security_incidents_from_suggestions: 0  # Target: 0 (SC-004)

business_metrics:
  time_saved_per_feature: 0  # Target: 40 minutes
  developer_satisfaction_score: 0  # Target: 4/5 stars
  technical_debt_reduction: 0  # Measured by replacement costs avoided

### Qualitative Metrics Measurement Strategy (C #6)

**Systematic Measurement Approach for SC-003 (Developer Satisfaction)**:

**1. Quarterly Developer Survey** (automated, 5-minute completion):
```yaml
# surveys/quarterly-satisfaction.yaml
survey_template:
  frequency: quarterly (every 3 months)
  target_participants: minimum 10 developers
  completion_time_target: 5 minutes

  questions:
    - id: Q1
      text: "How satisfied are you with the suggestion quality?"
      type: Likert scale (1-5)
      measurement: 5-very satisfied, 4-satisfied, 3-neutral, 2-unsatisfied, 1-very unsatisfied

    - id: Q2
      text: "Do suggestions help improve code quality?"
      type: Yes/No
      measurement: Percentage answering Yes (SC-003 target: 70%)

    - id: Q3
      text: "Do suggestions reduce implementation time?"
      type: Yes/No
      measurement: Percentage answering Yes (SC-003 target: 70%)

    - id: Q4
      text: "How often do you accept suggestions?"
      type: Percentage
      measurement: Average acceptance rate per developer

    - id: Q5
      text: "What aspect of suggestions needs improvement?"
      type: Open text
      measurement: Qualitative feedback analysis
```

**2. Suggestion Quality Tracking** (automated, real-time):
```javascript
// lib/quality-tracker.mjs
class SuggestionQualityTracker {
  recordSuggestionFeedback(suggestionId, feedback) {
    // Track: usefulness, accuracy, relevance, completeness
    this.feedback[suggestionId] = {
      usefulness: feedback.usefulness, // 1-5 scale
      accuracy: feedback.accuracy,     // 1-5 scale
      relevance: feedback.relevance,   // 1-5 scale
      completeness: feedback.completeness, // 1-5 scale
      timestamp: new Date()
    };
  }

  getQualityScore(suggestionId) {
    const feedback = this.feedback[suggestionId];
    return (feedback.usefulness + feedback.accuracy +
            feedback.relevance + feedback.completeness) / 4;
  }
}
```

**3. Learning Effectiveness Tracking** (automated, session-based):
```javascript
// lib/learning-tracker.mjs
class LearningEffectivenessTracker {
  recordLearningOutcomes(featureId, outcomes) {
    this.outcomes[featureId] = {
      newLibrariesAdopted: outcomes.newLibrariesAdopted.length,
      newBestPracticesLearned: outcomes.newBestPracticesLearned.length,
      knowledgeRetentionRate: this.calculateRetention(featureId),
      suggestionReapplicationRate: this.calculateReapplication(featureId)
    };
  }
}
```

fallback_metrics:
  tier_2_usage_percentage: 0  # Target: <20%
  tier_3_usage_percentage: 0  # Target: <10%
  tier_4_usage_percentage: 0  # Target: <5%
```

### Stakeholder Communication

**For Engineering Management**:
- ROI: 12x first year, 56x second year
- Payback: 28 days
- Technical debt reduction: $82,944/year
- Security risk reduction: $18,000/year

**For Developers**:
- Time savings: 40 minutes/feature
- Confidence: All suggestions vetted for maintainability/security
- Learning: Rationale and adoption examples provided
- Flexibility: Can accept, reject, or customize suggestions

**For Security Team**:
- Proactive security validation (CVE checks, OSV integration)
- Zero critical security incidents goal (SC-004)
- Audit trail for compliance
- Fallback to manual review if automated checks fail

## Test Plans for Validation and Security Checks (simplified)

### Overview

This section defines implementation-level tests for validation and security checks.

### Test Strategy

**Test Levels**:
1. Unit Tests - Individual validation functions
2. Integration Tests - End-to-end validation flows
3. Contract Tests - External API interactions (GitHub, OSV, npm/PyPI)
4. Manual Validation Tests - Spec-based acceptance scenarios

**Test Coverage Targets**:
- Validation logic: 90%+ code coverage
- Security checks: 100% (all CVE checks must be testable)
- API contracts: 100% (all external calls have contract tests)

### Unit Tests

#### Test Suite 1: Maintainability Validation

**File**: `lib/suggestion-validator.test.mjs`

**Test Cases for Maintainability Scoring**:
- Scores 90-100 for very active repos (commits last 6mo, low issues, healthy adoption)
- Scores 70-89 for active repos (commits last 12mo, moderate issues)
- Scores 50-69 for moderate activity (commits last 18mo, higher issues)
- Scores 0-49 for inactive repos (no commits 18+mo, high issues)
- Excludes repos with critical abandonment (12+mo no updates)
- Handles niche projects with high quality but low stars (recent activity, high test coverage, documentation)

**Key Test Functions**:
- `calculateMaintainabilityScore(ecosystem, package, repoData)` - Returns 0-100 score
- `shouldExcludeDueToAbandonment(repoData)` - Returns boolean for critical abandonment
- Test coverage for GitHub API integration, edge cases, boundary conditions

#### Test Suite 2: Security Validation

**Test Cases for Security Scoring**:
- Scores 90-100 for no known CVEs (empty OSV response)
- Scores 70-89 for non-critical CVEs (MODERATE, LOW severity)
- Scores 0-49 for critical CVEs
- Excludes packages with critical CVEs (CRITICAL severity)
- Passes npm audit with 0 vulnerabilities
- Fails npm audit with high severity vulnerabilities
- Checks transitive dependencies via npm audit
- High test coverage increases security score (95% coverage bonus)
- No tests decreases security score (0% coverage penalty)

**Key Test Functions**:
- `calculateSecurityScore(ecosystem, package, osvResponse)` - Returns 0-100 score
- `shouldExcludeDueToSecurity(osvResponse)` - Returns boolean for critical CVEs
- `checkNpmAudit(auditResult)` - Returns boolean for audit pass/fail
- `calculateTestCoverageBonus(package)` - Returns adjustment for test coverage
    });

    test('no tests decreases security score', async () => {
      const mockPackage = {
        test_coverage: 0 // No tests
      };
      const adjustment = await calculateTestCoverageBonus(mockPackage);
      expect(adjustment).toBeLessThan(-5);
    });
  });
});
```

#### Test Suite 3: Suggestion Filtering

```javascript
describe('Suggestion Filtering', () => {
  describe('Threshold Filtering (FR-006)', () => {
    test('includes suggestions with maintainability >= 50 AND security >= 50', () => {
      const suggestion = {
        maintainability_score: 75,
        security_score: 80
      };
      const passes = await checkThresholds(suggestion);
      expect(passes).toBe(true);
    });

    test('excludes suggestions with maintainability < 50', () => {
      const suggestion = {
        maintainability_score: 45,
        security_score: 90
      };
      const passes = await checkThresholds(suggestion);
      expect(passes).toBe(false);
    });

    test('excludes suggestions with security < 50', () => {
      const suggestion = {
        maintainability_score: 85,
        security_score: 40
      };
      const passes = await checkThresholds(suggestion);
      expect(passes).toBe(false);
    });

    test('flags suggestions with mixed scores with [RISK] tag', () => {
      const suggestion = {
        maintainability_score: 85,
        security_score: 55 // Moderate security, high maintainability
      };
      const result = await checkThresholds(suggestion);
      expect(result.included).toBe(true);
      expect(result.tagged).toBe(true);
      expect(result.tag).toBe('[RISK]');
    });
  });

  describe('Conflict Resolution (C #9)', () => {
    test('detects version conflicts with existing project dependencies', async () => {
      const existingDeps = {
        'lodash': '^4.17.21'
      };
      const suggestion = {
        name: 'lodash',
        version: '^5.0.0' // Major version mismatch
      };
      const conflict = await detectVersionConflict(existingDeps, suggestion);
      expect(conflict.detected).toBe(true);
      expect(conflict.reason).toContain('major version');
    });

    test('suggests alternative for conflicting dependencies', async () => {
      const suggestion = {
        name: 'axios',
        conflicts: ['fetch-api'], // Conflicts with browser fetch
        alternatives: ['ky', 'node-fetch']
      };
      const alternatives = await getAlternativesForConflict(suggestion);
      expect(alternatives).toContain('ky');
      expect(alternatives).toContain('node-fetch');
    });

    test('prioritizes suggestions when multiple tools for same purpose', async () => {
      const suggestions = [
        { name: 'express', maintainability_score: 95, security_score: 90, popularity: 100000 },
        { name: 'koa', maintainability_score: 90, security_score: 85, popularity: 50000 },
        { name: 'fastify', maintainability_score: 92, security_score: 88, popularity: 30000 }
      ];
      const prioritized = await prioritizeByPurpose(suggestions);
      expect(prioritized[0].name).toBe('express'); // Highest combined score and popularity
    });

    test('resolves license conflicts', async () => {
      const projectLicense = 'MIT';
      const suggestion = {
        name: 'copyleft-package',
        license: 'GPL-3.0' // Copyleft, incompatible with MIT in some contexts
      };
      const conflict = await detectLicenseConflict(projectLicense, suggestion);
      expect(conflict.detected).toBe(true);
      expect(conflict.compatible).toBe(false);
    });
  });
});
```

### Integration Tests

#### Test Suite 4: End-to-End Validation Flow

**File**: `tests/integration/validation-flow.test.mjs`

```javascript
describe('Validation Flow Integration', () => {
  describe('Complete Suggestion Validation', () => {
    test('validates suggestion from exploration output to filtered results', async () => {
      const explorationOutput = {
        suggestions: [
          {
            id: 'sugg-1',
            type: 'library',
            name: 'express',
            source_urls: ['https://github.com/expressjs/express']
          },
          {
            id: 'sugg-2',
            type: 'library',
            name: 'insecure-package',
            source_urls: ['https://github.com/insecure/pkg']
          }
        ]
      };

      const validated = await runValidationPipeline(explorationOutput);

      expect(validated.suggestions).toHaveLength(2);
      expect(validated.suggestions[0].maintainability_score).toBeDefined();
      expect(validated.suggestions[0].security_score).toBeDefined();
      expect(validated.filtered.length).toBe(1); // Only express passes thresholds
      expect(validated.filtered[0].id).toBe('sugg-1');
    });

    test('handles API failures gracefully with fallback', async () => {
      const explorationOutput = {
        suggestions: [
          {
            id: 'sugg-1',
            type: 'library',
            name: 'express',
            source_urls: ['https://github.com/expressjs/express']
          }
        ]
      };

      // Mock API failures
      mockGitHubAPIFailure();
      mockOSVFailure();

      const validated = await runValidationPipeline(explorationOutput);

      // Should still complete but with warnings
      expect(validated.warnings.length).toBeGreaterThan(0);
      expect(validated.suggestions[0].maintainability_score).toBe(50); // Default neutral score
      expect(validated.suggestions[0].security_score).toBe(50);
    });
  });

  describe('Cache Seeding (C #10)', () => {
    test('populates initial cache with high-quality suggestions', async () => {
      const initialCache = {
        'authentication': [
          {
            name: 'passport',
            maintainability_score: 85,
            security_score: 90,
            rationale: '成熟した認証ミドルウェア'
          }
        ],
        'database': [
          {
            name: 'prisma',
            maintainability_score: 92,
            security_score: 88,
            rationale: 'モダンなORM、TypeScript対応'
          }
        ]
      };

      await seedInitialCache(initialCache);

      const cache = await loadCache();
      expect(cache['authentication']).toHaveLength(1);
      expect(cache['database']).toHaveLength(1);
    });

    test('uses cache for cold start scenarios', async () => {
      const feature = {
        description: 'ユーザー認証機能を追加',
        keywords: ['authentication', 'auth', 'login']
      };

      const suggestions = await getSuggestionsWithCacheFallback(feature);

      expect(suggestions).toHaveLength(1); // From cache
      expect(suggestions[0].source).toBe('cache');
      expect(suggestions[0].name).toBe('passport');
    });
  });
});
```

### Contract Tests

#### Test Suite 5: External API Contracts

**File**: `tests/contracts/api-contract.test.mjs`

```javascript
describe('External API Contract Tests', () => {
  describe('GitHub API Contract', () => {
    test('GitHub API returns expected structure', async () => {
      const response = await fetchGitHubRepo('expressjs', 'express');

      expect(response).toHaveProperty('stargazers_count');
      expect(response).toHaveProperty('updated_at');
      expect(response).toHaveProperty('open_issues_count');
      expect(response).toHaveProperty('default_branch');
      expect(typeof response.stargazers_count).toBe('number');
      expect(typeof response.updated_at).toBe('string');
    });

    test('GitHub API handles rate limiting', async () => {
      // Make multiple requests to test rate limit handling
      const requests = Array(100).fill().map(() =>
        fetchGitHubRepo('expressjs', 'express')
      );

      const results = await Promise.allSettled(requests);

      // Should have some rate limit errors handled gracefully
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures.length).toBeGreaterThan(0);
      failures.forEach(f => {
        expect(f.reason).toHaveProperty('isRateLimit');
      });
    });
  });

  describe('OSV API Contract', () => {
    test('OSV API returns vulnerabilities array', async () => {
      const response = await fetchOSVVulnerabilities('npm', 'express');

      expect(response).toHaveProperty('vulns');
      expect(Array.isArray(response.vulns)).toBe(true);
      response.vulns.forEach(vuln => {
        expect(vuln).toHaveProperty('id');
        expect(vuln).toHaveProperty('summary');
        expect(vuln).toHaveProperty('details');
      });
    });

    test('OSV API handles unknown packages', async () => {
      const response = await fetchOSVVulnerabilities('npm', 'nonexistent-package-xyz-123');

      expect(response.vulns).toHaveLength(0);
    });
  });

  describe('npm Registry Contract', () => {
    test('npm API returns package metadata', async () => {
      const response = await fetchNpmPackage('express');

      expect(response).toHaveProperty('name');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('description');
      expect(response).toHaveProperty('maintainers');
      expect(Array.isArray(response.maintainers)).toBe(true);
    });

    test('npm API handles deprecated packages', async () => {
      const response = await fetchNpmPackage('deprecated-package');

      expect(response).toHaveProperty('deprecated');
      expect(typeof response.deprecated).toBe('string');
    });
  });

  describe('PyPI Contract', () => {
    test('PyPI API returns package info', async () => {
      const response = await fetchPyPIPackage('requests');

      expect(response).toHaveProperty('info');
      expect(response.info).toHaveProperty('name');
      expect(response.info).toHaveProperty('version');
      expect(response.info).toHaveProperty('author');
      expect(response.info).toHaveProperty('license');
    });
  });

  describe('Snyk API Contract (if used)', () => {
    test('Snyk API returns vulnerability report', async () => {
      const response = await fetchSnykVulnerabilities('npm', 'express');

      expect(response).toHaveProperty('issues');
      expect(Array.isArray(response.issues)).toBe(true);
    });
  });
});
```

### Manual Validation Tests

#### Test Suite 6: Spec-Based Acceptance

**File**: `tests/manual/spec-acceptance.md`

```markdown
# Manual Validation Tests (Spec-Based)

## User Story 1 - Development Team Gets Best Practice Suggestions

### Test 1.1: Basic Suggestion Generation
**Given** a developer initiates a feature addition flow for user authentication
**When** the suggestion phase is triggered
**Then** the system MUST provide at least one suggestion with best practices, tools, or libraries
**Validation Steps**:
1. Run `/poor-dev.specify` for auth feature
2. Verify `/poor-dev.suggest` runs automatically
3. Check `suggestions.yaml` contains at least 1 suggestion
4. Verify each suggestion has maintainability_score and security_score
**Expected Result**: PASS

### Test 1.2: Maintainability Metrics Display
**Given** a tool/library is suggested
**When** reviewing the suggestion
**Then** the system MUST display maintainability metrics
**Validation Steps**:
1. Open `suggestions.yaml`
2. Verify maintainability_score field exists (0-100)
3. Verify last update date is displayed
4. Verify issue resolution rate is displayed
**Expected Result**: PASS

### Test 1.3: Security Metrics Display
**Given** a tool/library is suggested
**When** reviewing the suggestion
**Then** the system MUST display security metrics
**Validation Steps**:
1. Open `suggestions.yaml`
2. Verify security_score field exists (0-100)
3. Verify known vulnerabilities are listed (or "none")
4. Verify security audit status is displayed
**Expected Result**: PASS

## User Story 2 - GLM4.7 Conducts Exploration

### Test 2.1: Automatic Exploration Trigger
**Given** the suggestion phase starts
**When** GLM4.7 begins exploration
**Then** it MUST automatically research multiple sources
**Validation Steps**:
1. Trigger `/poor-dev.suggest` for a feature
2. Check `exploration-session.yaml` is created
3. Verify status field is `in_progress` then `completed`
4. Verify findings_summary contains structured research
**Expected Result**: PASS

### Test 2.2: Structured Research Output
**Given** GLM4.7 completes exploration
**When** presenting results
**Then** output MUST be structured with actionable recommendations
**Validation Steps**:
1. Review `exploration-session.yaml`
2. Verify findings_summary has clear sections (best_practices, tools, libraries, patterns)
3. Verify each finding has supporting evidence (source URLs, rationale)
4. Verify suggestions_generated_count matches expected count
**Expected Result**: PASS

### Test 2.3: Status Updates During Exploration
**Given** exploration is in progress
**When** checking status
**Then** system MUST indicate active research with expected completion timeframe
**Validation Steps**:
1. Trigger suggestion phase
2. Monitor `exploration-session.yaml` status field
3. Verify status transitions: `pending` → `in_progress` → `completed`
4. Verify started_at and completed_at timestamps are populated
**Expected Result**: PASS

## User Story 3 - Maintainability and Security Validation

### Test 3.1: Maintainability Assessment
**Given** a library is being evaluated
**When** checking maintainability
**Then** the system MUST assess active maintenance
**Validation Steps**:
1. Review validation log for library evaluation
2. Check commit history was queried (GitHub API)
3. Verify last commit date is within threshold
4. Verify maintainer responsiveness was checked
**Expected Result**: PASS

### Test 3.2: Security Assessment
**Given** a library is being evaluated
**When** checking security
**Then** the system MUST check for known vulnerabilities
**Validation Steps**:
1. Review validation log for security checks
2. Verify OSV API was queried
3. Verify CVEs were checked
4. Verify npm audit was run
**Expected Result**: PASS

### Test 3.3: Exclusion of Poor Libraries
**Given** a library fails maintainability or security checks
**When** preparing suggestions
**Then** the system MUST exclude it
**Validation Steps**:
1. Find library with low scores in `exploration-session.yaml`
2. Verify it's NOT in `suggestions.yaml` (filtered)
3. Verify exclusion reason is logged
**Expected Result**: PASS

## User Story 4 - Developers Review and Select Suggestions

### Test 4.1: Suggestion Details Display
**Given** suggestions are presented
**When** reviewing a specific suggestion
**Then** display MUST include all required fields
**Validation Steps**:
1. Open `suggestions.yaml`
2. Verify each suggestion has: type, description, rationale, maintainability_score, security_score
3. Verify adoption_examples field exists
4. Verify source_urls field contains relevant links
**Expected Result**: PASS

### Test 4.2: Decision Recording
**Given** a developer chooses to adopt a suggestion
**When** proceeding to implementation
**Then** system MUST record which suggestions were accepted
**Validation Steps**:
1. Run `/poor-dev.suggest` and accept some suggestions
2. Check `suggestion-decisions.yaml` is created
3. Verify accepted decisions have decision: "accepted"
4. Verify rejected decisions have decision: "rejected"
5. Verify reason field is populated for each decision
**Expected Result**: PASS

### Test 4.3: Proceed Without Adopting Suggestions
**Given** a developer rejects all suggestions
**When** continuing
**Then** system MUST allow proceeding without adopting any suggestions
**Validation Steps**:
1. Reject all suggestions during review
2. Verify pipeline continues to plan phase
3. Verify `suggestion-decisions.yaml` shows all decisions as "rejected"
4. Verify no error or blocking occurs
**Expected Result**: PASS

## Edge Cases

### Test EC.1: No Relevant Suggestions Found
**Given** a feature with generic standard patterns
**When** GLM4.7 explores
**Then** the system MUST indicate no suggestions found
**Validation Steps**:
1. Run suggestion phase for simple feature
2. Verify `suggestions.yaml` has empty array
3. Verify `exploration_session.findings_summary` explains why
**Expected Result**: PASS

### Test EC.2: GLM4.7 Exploration Timeout
**Given** GLM4.7 exploration times out
**When** timeout occurs
**Then** the system MUST use fallback mechanism
**Validation Steps**:
1. Force timeout (reduce max_timeout to 10s for testing)
2. Verify Tier 2 or Tier 3 fallback triggers
3. Verify user is notified of fallback
4. Verify pipeline continues to plan phase
**Expected Result**: PASS

### Test EC.3: Conflicting Suggestions (C #9)
**Given** multiple suggestions for same purpose
**When** presenting to user
**Then** the system MUST handle conflicts
**Validation Steps**:
1. Run suggestion phase for database feature
2. Verify multiple ORMs are suggested (Prisma, TypeORM, etc.)
3. Verify conflict resolution logic prioritizes by score
4. Verify alternatives are suggested
**Expected Result**: PASS

### Test EC.4: Cache Cold Start (C #10)
**Given** first-time suggestion phase with no cache
**When** exploration runs
**Then** the system MUST handle cold start
**Validation Steps**:
1. Clear cache directory
2. Run suggestion phase
3. Verify fallback to initial seed cache works
4. Verify suggestions are still generated
**Expected Result**: PASS
```

### Test Implementation Timeline

**Phase 2 (Implementation)**:
- Day 1: QuestionTools bypass integration test + WebFetch availability verification (PASS/FAIL) + jq installation + GLM4.7 sub-agent dispatch test
- Day 1-2: Implement unit tests (Suites 1-3)
- Day 2-3: Implement integration tests (Suite 4)
- Day 3-4: Set up external API mocks for contract tests (Suite 5)
- Day 4-5: Write manual validation test cases (Suite 6)
- Day 5-6: Run all tests, fix failures
- Day 7-8: Implement Tier transition tests (Suite 7: Tier 2→3→4 transitions) and partial failure scenarios
- Day 9: Final integration testing and bug fixes

**Phase 3 (Post-Implementation)**:
- Run manual validation tests
- Fix any acceptance test failures
- Update test documentation based on findings

### Test Coverage Goals

| Test Type | Target Coverage | Priority |
|-----------|----------------|----------|
| Maintainability validation logic | 95% | P1 |
| Security validation logic | 100% | P1 (critical) |
| Threshold filtering | 90% | P1 |
| Conflict resolution | 85% | P2 |
| Cache seeding | 80% | P2 |
| External API contracts | 100% | P1 |
| Tier 2→3→4 transitions | 90% | P1 (H #6) |
| Partial failure scenarios | 85% | P1 (H #6) |
| Manual acceptance scenarios | 100% | P1 (all user stories) |

## Tier Transition and Partial Failure Tests (H #6)

### Test Suite 7: Tier Transition Tests

**File**: `tests/integration/tier-transition.test.mjs`

```javascript
describe('Tier Transition Tests (Tier 2→3→4)', () => {
  describe('Tier 1 → Tier 2 Transition', () => {
    test('WebFetch failure triggers Tier 2 fallback', async () => {
      // Mock WebFetch unavailability
      mockWebFetchUnavailable();

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(2);
      expect(result.suggestions[0].tags).toContain('[LIMITED_KNOWLEDGE]');
      expect(result.warnings).toContain('WebFetch unavailable, using internal knowledge base');
    });

    test('Tier 2 adds [STALE_RISK] tag for outdated libraries', async () => {
      // Mock GLM4.7 internal knowledge response with outdated library
      mockGLM4.7InternalKnowledge([
        { name: 'old-library', last_update: '2023-01-01' }
      ]);

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(2);
      expect(result.suggestions.some(s =>
        s.tags && s.tags.includes('[STALE_RISK]')
      )).toBe(true);
    });
  });

  describe('Tier 1/2 → Tier 3 Transition', () => {
    test('GLM4.7 dispatch failure triggers Tier 3', async () => {
      // Mock GLM4.7 dispatch failure
      mockGLM4.7DispatchFailure();

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(3);
      expect(result.userInteractionHandler).toBe('orchestrator');
      expect(result.manualInputMode).toBe(true);
    });

    test('GLM4.7 timeout triggers Tier 3', async () => {
      // Mock GLM4.7 timeout
      mockGLM4.7Timeout(100); // 100ms timeout

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(3);
      expect(result.fallbackReason).toContain('timeout');
    });

    test('Tier 3 provides manual input options', async () => {
      mockGLM4.7Unavailable();

      const result = await runSuggestionPhase('test-feature');

      expect(result.manualInputOptions).toBeDefined();
      expect(result.manualInputOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: '手動でツール/ライブラリを入力する' }),
          expect.objectContaining({ label: '提案なしでプランフェーズに進む' }),
          expect.objectContaining({ label: '共通ベストプラクティスを表示する' })
        ])
      );
    });

    test('Tier 3 manual input is validated', async () => {
      mockGLM4.7Unavailable();

      const result = await runSuggestionPhaseWithManualInput('test-feature', {
        userInput: 'express'
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].name).toBe('express');
      expect(result.suggestions[0].maintainability_score).toBeDefined();
      expect(result.suggestions[0].security_score).toBeDefined();
    });
  });

  describe('Tier 3 → Tier 4 Transition', () => {
    test('User declines all Tier 3 options triggers Tier 4', async () => {
      mockGLM4.7Unavailable();

      const result = await runSuggestionPhaseWithUserResponse('test-feature', {
        response: 'skip_all'
      });

      expect(result.tierUsed).toBe(4);
      expect(result.suggestions).toEqual([]);
      expect(result.status).toBe('completed_with_warnings');
    });

    test('All tiers fail triggers Tier 4', async () => {
      // Mock all tiers failing
      mockWebFetchUnavailable();
      mockGLM4.7DispatchFailure();
      mockManualInputUnavailable();

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(4);
      expect(result.status).toBe('completed_with_warnings');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Cascading Tier Transitions', () => {
    test('Full cascade: Tier 1 → Tier 2 → Tier 3 → Tier 4', async () => {
      // Simulate complete failure cascade
      mockWebFetchUnavailable();
      mockGLM4.7Timeout(100);
      mockUserDeclinesAllOptions();

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierTransitions).toEqual([2, 3, 4]);
      expect(result.finalTier).toBe(4);
      expect(result.warnings).toHaveLength(3); // One warning per tier failure
    });

    test('Partial cascade: Tier 1 → Tier 2 → success', async () => {
      mockWebFetchUnavailable();
      // Tier 2 succeeds with internal knowledge

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(2);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.status).toBe('completed');
    });
  });

  describe('Partial Failure Scenarios', () => {
    test('GitHub API fails but OSV succeeds - partial suggestions', async () => {
      mockGitHubAPIFailure();
      mockOSVAPISuccess();

      const result = await runSuggestionPhase('test-feature');

      expect(result.status).toBe('completed_with_warnings');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('GitHub API unavailable, using cached data');
    });

    test('Multiple API partial failures - degraded mode', async () => {
      mockGitHubAPIFailure();
      mockOSVAPIFailure();
      // npm/PyPI still work

      const result = await runSuggestionPhase('test-feature');

      expect(result.degradedMode).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('WebFetch works but GitHub API rate limited - Tier 2 fallback', async () => {
      mockWebFetchAvailable();
      mockGitHubAPIRateLimit();

      const result = await runSuggestionPhase('test-feature');

      expect(result.tierUsed).toBe(1); // WebFetch still works
      expect(result.warnings).toContain('GitHub API rate limit exceeded, using WebFetch');
    });

    test('Library existence validation fails for some suggestions', async () => {
      mockSuggestionGeneration([
        { name: 'express', exists: true },
        { name: 'nonexistent-lib', exists: false },
        { name: 'lodash', exists: true }
      ]);

      const result = await runSuggestionPhase('test-feature');

      expect(result.suggestions).toHaveLength(2); // Only valid ones
      expect(result.hallucinationsFiltered).toHaveLength(1);
      expect(result.hallucinationsFiltered[0].name).toBe('nonexistent-lib');
    });

    test('Validation failure for maintainability threshold - exclusion', async () => {
      mockSuggestionGeneration([
        { name: 'good-lib', maintainability: 85, security: 90 },
        { name: 'bad-lib', maintainability: 30, security: 40 }
      ]);

      const result = await runSuggestionPhase('test-feature');

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].name).toBe('good-lib');
      expect(result.excludedSuggestions).toHaveLength(1);
      expect(result.excludedSuggestions[0].name).toBe('bad-lib');
    });

    test('Security threshold failure - exclusion with warning', async () => {
      mockSuggestionGeneration([
        { name: 'secure-lib', maintainability: 85, security: 90 },
        { name: 'insecure-lib', maintainability: 85, security: 25 }
      ]);

      const result = await runSuggestionPhase('test-feature');

      expect(result.suggestions).toHaveLength(1);
      expect(result.excludedSuggestions).toHaveLength(1);
      expect(result.excludedSuggestions[0].reason).toContain('security_score < 50');
    });
  });
});
```

### Skip Criteria for Tier Transition Tests (C #5)

**CRITICAL**: Skip criteria for proceeding with partial fallback if Tier 3 tests fail.

**Skip Criteria Matrix**:

| Test Suite Status | Tier 1 Pass | Tier 2 Pass | Tier 3 Fail | Can Proceed? | Proceed With... | Conditions |
|-----------------|--------------|--------------|--------------|---------------|-----------------|------------|
| **Scenario 1** | ✅ YES | ✅ YES | ❌ FAIL | **YES - T1+T2** | Tier 1 + Tier 2 only | Tier 3 failures due to orchestrator issues, not GLM4.7 |
| **Scenario 2** | ✅ YES | ❌ FAIL | ❌ FAIL | **YES - T1 only** | Tier 1 only | Tier 2+3 failures, but Tier 1 (WebFetch) works |
| **Scenario 3** | ❌ FAIL | ✅ YES | ❌ FAIL | **YES - T2 only** | Tier 2 only | Tier 1+3 failures, but Tier 2 (internal knowledge) works |
| **Scenario 4** | ❌ FAIL | ❌ FAIL | ❌ FAIL | **NO - BLOCKER** | Cannot proceed | All tiers fail, must fix before Day 5 pipeline integration |

**Explicit Skip Criteria**:

**Scenario 1: Can proceed with Tier 1 + Tier 2 only**
```javascript
// Test result: Tier 1 PASS, Tier 2 PASS, Tier 3 FAIL
if (testResults.tier1 === 'PASS' && testResults.tier2 === 'PASS' && testResults.tier3 === 'FAIL') {
  console.log('✓ SKIP CRITERIA MET: Proceeding with Tier 1 + Tier 2 only');
  console.log('  Reason: Tier 3 failure is orchestrator-specific, not GLM4.7 model issue');
  console.log('  Impact: Manual input mode unavailable, but suggestion generation works');
  console.log('  Mitigation: Document Tier 3 unavailability in known issues');
  console.log('');
  console.log('Proceeding to Day 5 pipeline integration with Tier 1 + Tier 2 support');
}
```

**Scenario 2: Can proceed with Tier 1 only**
```javascript
// Test result: Tier 1 PASS, Tier 2 FAIL, Tier 3 FAIL
if (testResults.tier1 === 'PASS' && testResults.tier2 === 'FAIL' && testResults.tier3 === 'FAIL') {
  console.log('✓ SKIP CRITERIA MET: Proceeding with Tier 1 only');
  console.log('  Reason: WebFetch works, but GLM4.7 internal knowledge and manual input fail');
  console.log('  Impact: Suggestions available, but no fallback tiers');
  console.log('  Mitigation: Recommend GITHUB_TOKEN usage to avoid rate limit fallback to Tier 2');
  console.log('');
  console.log('Proceeding to Day 5 pipeline integration with Tier 1 support only');
}
```

**Scenario 3: Can proceed with Tier 2 only**
```javascript
// Test result: Tier 1 FAIL, Tier 2 PASS, Tier 3 FAIL
if (testResults.tier1 === 'FAIL' && testResults.tier2 === 'PASS' && testResults.tier3 === 'FAIL') {
  console.log('✓ SKIP CRITERIA MET: Proceeding with Tier 2 only');
  console.log('  Reason: GLM4.7 works but WebFetch unavailable, manual input fails');
  console.log('  Impact: All suggestions tagged [LIMITED_KNOWLEDGE], no real-time validation');
  console.log('  Mitigation: Document [LIMITED_KNOWLEDGE] behavior, recommend manual verification');
  console.log('');
  console.log('Proceeding to Day 5 pipeline integration with Tier 2 support only');
}
```

**BLOCKER: Cannot proceed if all tiers fail**
```javascript
// Test result: All tiers fail
if (testResults.tier1 === 'FAIL' && testResults.tier2 === 'FAIL' && testResults.tier3 === 'FAIL') {
  console.log('✗ BLOCKER: All tier tests failed, CANNOT PROCEED');
  console.log('');
  console.log('FAILURES:');
  console.log('  - Tier 1: WebFetch unavailable or GLM4.7 dispatch failed');
  console.log('  - Tier 2: GLM4.7 internal knowledge failed');
  console.log('  - Tier 3: Manual input/orchestrator failed');
  console.log('');
  console.log('REQUIRED ACTIONS:');
  console.log('  1. Fix WebFetch availability (Day 1 test)');
  console.log('  2. Fix GLM4.7 dispatch (Day 1 test)');
  console.log('  3. Fix orchestrator manual input (Day 5 integration)');
  console.log('  4. Re-run Tier transition tests after fixes');
  console.log('');
  console.log('HALTING: Cannot proceed to Day 5 pipeline integration');
  exit 1; // Exit with error code to halt Phase 2
}
```

**Skip Criteria Execution Flow**:
```
Day 3-4: Tier Transition Tests
  ↓
Run all tier tests (Tier 1, Tier 2, Tier 3)
  ↓
Check test results
  ↓
├─ All PASS → Proceed to Day 5 with full tier support
│
├─ T1+T2 PASS, T3 FAIL → Proceed with T1+T2 only (Skip T3)
│   - Document Tier 3 unavailability
│   - Skip manual input integration
│   - Proceed to Day 5
│
├─ T1 PASS, T2+T3 FAIL → Proceed with T1 only (Skip T2+T3)
│   - Document fallback limitations
│   - Skip internal knowledge mode
│   - Skip manual input integration
│   - Proceed to Day 5
│
├─ T2 PASS, T1+T3 FAIL → Proceed with T2 only (Skip T1+T3)
│   - Document [LIMITED_KNOWLEDGE] behavior
│   - Skip WebFetch integration
│   - Skip manual input integration
│   - Proceed to Day 5
│
└─ All FAIL → BLOCKER (Do not proceed)
    - Halt Phase 2 Day 5
    - Fix all tier failures
    - Re-run tests
    - Re-evaluate skip criteria
```

**Impact Analysis for Partial Fallback Proceeding**:

| Proceed With | Functionality Available | Functionality Lost | Risk Level | Mitigation |
|--------------|-----------------------|-------------------|-------------|------------|
| **Full Tier 1+2+3** | All tiers | None | Low | Full fallback support |
| **Tier 1 + Tier 2** | WebFetch + Internal Knowledge | Manual input mode | Medium | Document Tier 3 gap |
| **Tier 1 only** | WebFetch suggestions only | Internal knowledge + Manual input | High | Rate limit risk, no fallback |
| **Tier 2 only** | Internal knowledge only | Real-time validation + Manual input | Medium | [LIMITED_KNOWLEDGE] tag quality |

**Documentation Requirements for Partial Fallback**:
When proceeding with partial fallback, MUST document in quickstart.md:
- Which tiers are supported
- Which tiers are unavailable
- Known limitations and workarounds
- User expectations and warnings
- Timeline for completing missing tiers

### Persistent Failure Detection and Monitoring (H #7)

```javascript
// lib/persistent-failure-monitor.mjs

class PersistentFailureMonitor {
  constructor(config = {}) {
    this.windowSize = config.windowSize || 3; // 3 consecutive days
    this.failureThreshold = config.failureThreshold || 0.3; // 30% features hit Tier 4
    this.dailyStats = [];
    this.alertTriggered = false;
  }

  recordDayStats(stats) {
    const today = new Date().toISOString().split('T')[0];
    const tier4Percentage = stats.totalFeatures > 0
      ? (stats.tier4Count / stats.totalFeatures)
      : 0;

    const dayStats = {
      date: today,
      totalFeatures: stats.totalFeatures,
      tier4Count: stats.tier4Count,
      tier4Percentage: tier4Percentage
    };

    this.dailyStats.push(dayStats);

    // Keep only last N days
    if (this.dailyStats.length > this.windowSize) {
      this.dailyStats.shift();
    }

    this.checkPersistentFailure();
  }

  checkPersistentFailure() {
    if (this.dailyStats.length < this.windowSize) {
      return false;
    }

    // Check if all days in window exceed threshold
    const allDaysExceedThreshold = this.dailyStats.every(day =>
      day.tier4Percentage >= this.failureThreshold
    );

    if (allDaysExceedThreshold && !this.alertTriggered) {
      this.triggerAlert();
      return true;
    }

    // Reset alert if conditions improve
    if (!allDaysExceedThreshold && this.alertTriggered) {
      this.alertTriggered = false;
      console.log('✓ Persistent failure condition resolved');
    }

    return false;
  }

  triggerAlert() {
    this.alertTriggered = true;

    const alertMessage = `
========================================
⚠ PERSISTENT FAILURE DETECTED ⚠
========================================
Alert: >30% features hit Tier 4 for ${this.windowSize} consecutive days

Recent Statistics:
${this.dailyStats.map(day =>
  `  ${day.date}: ${day.tier4Count}/${day.totalFeatures} features (${(day.tier4Percentage * 100).toFixed(1)}%)`
).join('\n')}

Potential Causes:
1. GLM4.7 model availability issues
2. WebFetch tool failures
3. Network connectivity problems
4. API rate limiting (GitHub: 60 req/hour unauthenticated)

Recommended Actions:
1. Check GITHUB_TOKEN configuration (use authenticated mode for 5000 req/hour)
2. Verify WebFetch tool availability
3. Check network connectivity to external APIs
4. Review API rate limit usage
5. Consider increasing Tier 4 threshold or improving fallback logic

Alert ID: ${Date.now()}
========================================
    `;

    console.error(alertMessage);

    // Emit alert event for monitoring system
    this.emitAlert(alertMessage);
  }

  emitAlert(message) {
    // In production, integrate with monitoring system
    // e.g., PagerDuty, Slack, email, etc.
    console.log('[ALERT EMITTED] Persistent failure detection');
  }

  getStats() {
    return {
      dailyStats: this.dailyStats,
      alertTriggered: this.alertTriggered,
      windowSize: this.windowSize,
      failureThreshold: this.failureThreshold
    };
  }

  reset() {
    this.dailyStats = [];
    this.alertTriggered = false;
  }
}

const persistentFailureMonitor = new PersistentFailureMonitor({
  windowSize: 3, // 3 consecutive days
  failureThreshold: 0.3 // 30% threshold
});
```

### Persistent Failure Detection Tests

```javascript
// tests/integration/persistent-failure-monitor.test.mjs

describe('Persistent Failure Detection', () => {
  test('Detects persistent failure over 3 consecutive days', async () => {
    const monitor = new PersistentFailureMonitor({
      windowSize: 3,
      failureThreshold: 0.3
    });

    // Day 1: 40% Tier 4 (exceeds threshold)
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 4 // 40%
    });

    expect(monitor.getStats().alertTriggered).toBe(false);

    // Day 2: 35% Tier 4 (exceeds threshold)
    monitor.recordDayStats({
      totalFeatures: 20,
      tier4Count: 7 // 35%
    });

    expect(monitor.getStats().alertTriggered).toBe(false);

    // Day 3: 50% Tier 4 (exceeds threshold) - should trigger alert
    const day3Result = monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 5 // 50%
    });

    expect(day3Result).toBe(true);
    expect(monitor.getStats().alertTriggered).toBe(true);
    expect(monitor.getStats().dailyStats).toHaveLength(3);
  });

  test('Does not trigger alert if one day is below threshold', async () => {
    const monitor = new PersistentFailureMonitor({
      windowSize: 3,
      failureThreshold: 0.3
    });

    // Day 1: 40% Tier 4
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 4
    });

    // Day 2: 20% Tier 4 (below threshold)
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 2
    });

    // Day 3: 50% Tier 4
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 5
    });

    expect(monitor.getStats().alertTriggered).toBe(false);
  });

  test('Resets alert when conditions improve', async () => {
    const monitor = new PersistentFailureMonitor({
      windowSize: 3,
      failureThreshold: 0.3
    });

    // Trigger alert first
    for (let i = 0; i < 3; i++) {
      monitor.recordDayStats({
        totalFeatures: 10,
        tier4Count: 5 // 50%
      });
    }

    expect(monitor.getStats().alertTriggered).toBe(true);

    // Day 4: Improvement (below threshold)
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 2 // 20%
    });

    // Day 5: Improvement (below threshold)
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 1 // 10%
    });

    // Day 6: Still below threshold
    monitor.recordDayStats({
      totalFeatures: 10,
      tier4Count: 2 // 20%
    });

    expect(monitor.getStats().alertTriggered).toBe(false);
  });

  test('Tracks statistics accurately', async () => {
    const monitor = new PersistentFailureMonitor({
      windowSize: 5,
      failureThreshold: 0.3
    });

    // Add 5 days of stats
    for (let i = 1; i <= 5; i++) {
      monitor.recordDayStats({
        totalFeatures: 10 * i,
        tier4Count: i // 10% each day
      });
    }

    const stats = monitor.getStats();

    expect(stats.dailyStats).toHaveLength(5);
    expect(stats.dailyStats[0].tier4Percentage).toBe(0.1);
    expect(stats.dailyStats[4].tier4Percentage).toBe(0.1);
  });
});
```

### Integration Test Summary

**Test Suite 7 (Tier 2→3→4 Transitions) Coverage**:
- Tier 1 → Tier 2 transitions (WebFetch failure)
- Tier 2 fallback behavior ([LIMITED_KNOWLEDGE], [STALE_RISK] tags)
- Tier 1/2 → Tier 3 transitions (GLM4.7 dispatch failure, timeout)
- Tier 3 manual input options and validation
- Tier 3 → Tier 4 transitions (user declines all options)
- Cascading tier transitions (full cascade: 1→2→3→4)
- Partial failure scenarios (API partial failures, degraded mode)
- Library existence validation failures
- Maintainability/security threshold failures

**Test Suite 8 (Persistent Failure Detection) Coverage**:
- Persistent failure detection over 3 consecutive days
- Alert threshold validation (>30% Tier 4)
- Alert reset on improvement
- Statistics tracking accuracy
- Window-based monitoring (sliding window)

**Test Coverage Summary** (updated):
| Test Type | Target Coverage | Priority | Status |
|-----------|----------------|----------|--------|
| Maintainability validation logic | 95% | P1 | Defined (Suite 1) |
| Security validation logic | 100% | P1 (critical) | Defined (Suite 2) |
| Threshold filtering | 90% | P1 | Defined (Suite 3) |
| Conflict resolution | 85% | P2 | Defined (Suite 3) |
| Cache seeding | 80% | P2 | Defined (Suite 4) |
| External API contracts | 100% | P1 | Defined (Suite 5) |
| Tier 2→3→4 transitions | 90% | P1 (H #6) | Defined (Suite 7) |
| Partial failure scenarios | 85% | P1 (H #6) | Defined (Suite 7) |
| Persistent failure detection | 100% | P1 (H #7) | Defined (Suite 8) |
| Manual acceptance scenarios | 100% | P1 | Defined (Suite 6) |

## Transitive Dependency Security Validation

### Scope Definition

**In Scope**:
- Direct package vulnerabilities (CVEs via OSV API)
- Transitive dependency vulnerabilities (npm audit, yarn audit)
- Known security advisories for all dependency levels
- Security audit integration for package ecosystems

**Out of Scope for MVP**:
- Deep transitive dependency analysis beyond 3 levels
- License compatibility analysis for transitive dependencies
- Supply chain analysis (malicious package detection)

### Transitive Dependency Scoring Strategy (C #10)

**Issue**: Security score checks direct CVEs but doesn't validate dependency chains. Must design transitive dependency security scoring strategy using npm audit, pip-audit, cargo-audit or Snyk API integration.

**Strategy**: Use ecosystem-specific audit tools to detect transitive vulnerabilities

**Audit Tool Integration**:

| Ecosystem | Audit Tool | Transitive Support | Integration Approach |
|-----------|-------------|-------------------|---------------------|
| **npm** | npm audit, yarn audit | ✅ Full (all levels) | Run audit in isolated temp directory |
| **PyPI** | pip-audit | ✅ Full (all levels) | Run audit in isolated venv |
| **crates.io** | cargo-audit | ✅ Full (all levels) | Run cargo audit in temp project |
| **Maven** | OWASP Dependency Check | ⚠ Partial | External tool integration (Phase 4) |
| **RubyGems** | bundler-audit | ✅ Full (all levels) | Run bundle-audit in temp Gemfile |
| **Go** | go mod vulncheck | ✅ Full (all levels) | Run govulncheck in temp module |

**Implementation Approach**:

1. **Primary Check**: CVE lookup via OSV API for the suggested package
2. **Secondary Check**: Run `npm audit` or `yarn audit` to catch transitive vulnerabilities
3. **Tertiary Check**: Check package security advisories from registry metadata

### Security Scoring with Transitive Dependencies

```javascript
// lib/security-validator.mjs
async function calculateSecurityScore(package, ecosystem) {
  let score = 100;
  const issues = [];

  // Check direct CVEs (from OSV API)
  const cves = await fetchCVEs(package, ecosystem);
  score -= cves.filter(v => v.severity === 'critical').length * 50;
  score -= cves.filter(v => v.severity === 'high').length * 30;
  score -= cves.filter(v => v.severity === 'moderate').length * 15;
  score -= cves.filter(v => v.severity === 'low').length * 5;

  issues.push(...cves);

  // Check transitive dependencies (npm audit / yarn audit)
  const auditResult = await runSecurityAudit(package, ecosystem);
  if (auditResult.vulnerabilities) {
    const { total, transitive, direct } = auditResult.metadata?.vulnerabilities || { total: 0 };

    // Transitive vulnerabilities have reduced impact but still affect score
    score -= auditResult.transitiveCritical * 25;
    score -= auditResult.transitiveHigh * 15;
    score -= auditResult.transitiveModerate * 8;
    score -= auditResult.transitiveLow * 3;

    // Track transitive issues separately for reporting
    if (transitive > 0) {
      issues.push({
        type: 'transitive_vulnerability',
        count: transitive,
        severity: 'moderate' // Transitive vulnerabilities downgraded
      });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    hasTransitiveVulnerabilities: auditResult.vulnerabilities?.some(v => v.isTransitive)
  };
}
```

### Audit Execution Strategy

```javascript
// Run npm audit for the suggested package in isolation
async function runSecurityAudit(package, ecosystem) {
  const tempDir = mkdtempSync(join(tmpdir(), 'suggestion-audit-'));

  try {
    // Create minimal package.json with the suggested package
    const pkgJson = {
      name: 'suggestion-audit',
      version: '1.0.0',
      dependencies: { [package]: 'latest' }
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    // Run npm audit
    const result = execSync('npm audit --json', { cwd: tempDir, encoding: 'utf-8' });
    const auditData = JSON.parse(result);

    return {
      vulnerabilities: auditData.vulnerabilities || {},
      metadata: auditData.metadata,
      transitiveCount: Object.values(auditData.vulnerabilities || {})
        .filter(v => v.via?.some(dep => dep !== package)).length
    };
  } catch (error) {
    // npm audit exits with non-zero on vulnerabilities
    if (error.stdout) {
      const auditData = JSON.parse(error.stdout);
      return {
        vulnerabilities: auditData.vulnerabilities || {},
        metadata: auditData.metadata,
        transitiveCount: Object.values(auditData.vulnerabilities || {})
          .filter(v => v.via?.some(dep => dep !== package)).length
      };
    }
    return { vulnerabilities: {}, metadata: {} };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```

### Threshold Adjustment for Transitive Dependencies

**Security Scoring Threshold (SC-002)**: >80 required for acceptance

**Transitive Dependency Policy**:
- **Critical/High transitive vulnerabilities**: Auto-exclude suggestion
- **Moderate/Low transitive vulnerabilities**: Penalty applied but may still pass threshold
- **No transitive vulnerabilities**: Full score
- **Security score < 80**: Exclude from suggestions

**Example**:
```yaml
suggestion:
  name: "package-with-transitive-vuln"
  security_score: 72  # Below 80 threshold
  direct_cves: []
  transitive_vulnerabilities:
    - severity: "moderate"
      count: 2
decision: "excluded"
reason: "Transitive vulnerabilities reduce security score below threshold"
```

## Refined Maintainability Scoring Heuristics

### Minimum Evidence Requirements

To prevent false positives from incomplete data, maintainability scoring requires minimum evidence:

**Required Evidence Points**:
1. **Last Update Date**: Must be present and parseable
2. **Open Issues Count**: Must be present (0 is valid)
3. **Stargazers Count**: Must be present (0 is valid for new projects)

**Optional Evidence (Bonus Points)**:
1. **Test Coverage**: Boosts score if present
2. **Documentation**: Boosts score if present
3. **CI/CD Integration**: Boosts score if present
4. **Issue Resolution Rate**: Boosts score if calculable

**Evidence Scoring Algorithm**:
```javascript
function calculateEvidenceScore(repoData) {
  let evidenceScore = 0;
  const evidence = {
    required: 0,
    optional: 0,
    warning: false
  };

  // Check required evidence
  if (repoData.updated_at) evidence.required++;
  if (repoData.open_issues_count !== undefined) evidence.required++;
  if (repoData.stargazers_count !== undefined) evidence.required++;

  // Check optional evidence
  if (repoData.has_tests || repoData.test_coverage > 0) evidence.optional++;
  if (repoData.has_documentation) evidence.optional++;
  if (repoData.has_ci) evidence.optional++;
  if (repoData.issue_resolution_rate > 0) evidence.optional++;

  // Calculate evidence quality score
  const requiredScore = (evidence.required / 3) * 100; // 0-100 based on required
  const optionalBonus = (evidence.optional / 4) * 20; // 0-20 bonus for optional

  evidenceScore = requiredScore + optionalBonus;

  // Warning if insufficient required evidence
  if (evidence.required < 3) {
    evidence.warning = true;
    evidenceScore = Math.min(evidenceScore, 70); // Cap at 70 with insufficient evidence
  }

  return {
    score: evidenceScore,
    evidence,
    warning: evidence.warning
  };
}
```

### Niche Project Handling

**Niche Project Definition**: Low popularity (<100 stars) but with indicators of quality.

**Quality Indicators for Niche Projects**:
1. **Recent Activity**: Updated within last 6 months
2. **Test Coverage**: >70% test coverage
3. **Documentation**: README present with examples
4. **Issue Responsiveness**: Low issue count or high resolution rate
5. **Code Quality**: Linting, formatting, and CI/CD in place

**Niche Project Scoring Adjustment**:
```javascript
function adjustForNicheProject(repoData, baseScore) {
  // Check if project is niche (low stars but high quality)
  const isNiche = repoData.stargazers_count < 100 &&
                  repoData.updated_at >= new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) &&
                  (repoData.test_coverage > 70 || repoData.has_documentation);

  if (!isNiche) return { score: baseScore, isNiche: false };

  // Boost score based on quality indicators
  let adjustedScore = baseScore;

  // Bonus for test coverage
  if (repoData.test_coverage > 70) adjustedScore += 10;
  if (repoData.test_coverage > 90) adjustedScore += 5;

  // Bonus for documentation
  if (repoData.has_documentation) adjustedScore += 5;

  // Bonus for recent activity
  const daysSinceUpdate = (Date.now() - new Date(repoData.updated_at)) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) adjustedScore += 5;
  else if (daysSinceUpdate < 90) adjustedScore += 3;

  // Add niche tag but don't exclude based on low stars
  return {
    score: Math.min(adjustedScore, 100),
    isNiche: true,
    tags: ['[NICHE_HIGH_QUALITY]']
  };
}
```

### Refined Maintainability Scoring Formula

```javascript
async function calculateMaintainabilityScore(package, ecosystem) {
  // Fetch repo data
  const repoData = await fetchGitHubData(package, ecosystem);

  // 1. Base Score (0-100) from activity metrics
  let baseScore = calculateBaseActivityScore(repoData);

  // 2. Evidence Quality Adjustment
  const evidenceResult = calculateEvidenceScore(repoData);
  if (evidenceResult.warning) {
    // Apply penalty for insufficient evidence
    baseScore = Math.min(baseScore, 70);
  } else {
    // Bonus for good evidence
    baseScore = Math.min(baseScore + 5, 100);
  }

  // 3. Niche Project Adjustment
  const nicheResult = adjustForNicheProject(repoData, baseScore);
  baseScore = nicheResult.score;

  // 4. Additional Quality Indicators
  if (repoData.issue_resolution_rate > 0.8) baseScore += 5;
  if (repoData.test_coverage > 80) baseScore += 3;
  if (repoData.has_ci && repoData.has_tests) baseScore += 2;

  // 5. Final score capping
  baseScore = Math.min(Math.max(baseScore, 0), 100);

  return {
    score: baseScore,
    tags: nicheResult.tags || [],
    evidence: evidenceResult.evidence,
    warning: evidenceResult.warning,
    isNiche: nicheResult.isNiche,
    breakdown: {
      base: calculateBaseActivityScore(repoData),
      evidence: evidenceResult.score,
      nicheBonus: nicheResult.isNiche ? nicheResult.score - calculateBaseActivityScore(repoData) : 0,
      qualityIndicators: baseScore - evidenceResult.score - (nicheResult.isNiche ? nicheResult.score - calculateBaseActivityScore(repoData) : 0)
    }
  };
}
```

### False Positive Prevention

**Common False Positive Scenarios**:

1. **New High-Quality Project**:
   - Low stars (new)
   - Recent updates
   - High test coverage
   - **Solution**: Apply niche project bonus, document as "new-high-quality"

2. **Specialized Enterprise Tool**:
   - Low stars (internal or proprietary)
   - Regular updates
   - Active issues (support requests)
   - **Solution**: Check for maintainer responsiveness, tag as "specialized"

3. **Migration/Rewrite Project**:
   - Low stars on new repo
   - Old repo has high stars
   - **Solution**: Detect migration patterns, combine stars from both repos

4. **Framework/Library Fork**:
   - Lower stars than original
   - Better maintenance
   - **Solution**: Compare with original, boost if better maintained

**Fallback for Ambiguous Cases**:
```javascript
function handleAmbiguousCase(repoData) {
  // If data is ambiguous, request manual review
  if (repoData.stargazers_count < 50 &&
      repoData.updated_at > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) &&
      repoData.open_issues_count > 50) {

    return {
      requiresManualReview: true,
      reason: "Ambiguous project: low stars but active. Manual review recommended.",
      score: 60, // Neutral score pending review
      tags: ['[MANUAL_REVIEW_RECOMMENDED]']
    };
  }
}
```

## WebFetch Tool Availability and Verification

### Verification Strategy

**Issue**: WebFetch tool availability is unverified in research.md (R-005 marked as open question). If unavailable, exploration falls back to internal knowledge only (Tier 2 fallback).

### WebFetch Tool Availability Verification Test (Phase 2 Day 1)

**Critical Verification Test** with Pass/Fail Criteria:
```javascript
// tests/integration/webfetch-availability.test.mjs

describe('WebFetch Tool Availability Verification', () => {
  test('WebFetch availability test - PASS/FAIL criteria', async () => {
    const result = {
      webFetchAvailable: false,
      bashFallbackAvailable: false,
      researchCapability: 'none'
    };

    // Test 1: Check if WebFetch tool is available in environment
    try {
      const webFetchTest = await checkWebFetchAvailable();
      if (webFetchTest.available) {
        result.webFetchAvailable = true;
        console.log('✓ PASS: WebFetch tool is available');
      }
    } catch (error) {
      console.log('✗ FAIL: WebFetch tool not available:', error.message);
    }

    // Test 2: Check Bash/curl fallback capability
    try {
      const bashTest = await checkBashCurlAvailable();
      if (bashTest.available) {
        result.bashFallbackAvailable = true;
        console.log('✓ PASS: Bash/curl fallback is available');
      }
    } catch (error) {
      console.log('✗ FAIL: Bash/curl fallback not available:', error.message);
    }

    // Determine overall research capability
    if (result.webFetchAvailable && result.bashFallbackAvailable) {
      result.researchCapability = 'full';
      console.log('✓ OVERALL PASS: Full research capability available');
    } else if (result.bashFallbackAvailable) {
      result.researchCapability = 'limited';
      console.log('⚠ OVERALL WARNING: Limited research capability (Bash only)');
    } else {
      result.researchCapability = 'none';
      console.log('✗ OVERALL FAIL: No research capability available');
    }

    // Pass/Fail Criteria:
    // PASS: webFetchAvailable OR bashFallbackAvailable = true
    // FAIL: both webFetchAvailable AND bashFallbackAvailable = false
    const pass = result.webFetchAvailable || result.bashFallbackAvailable;
    expect(pass).toBe(true);

    return result;
  });

  test('WebFetch actual functionality test', async () => {
    if (!await checkWebFetchAvailable()) {
      console.log('⚠ Skipping WebFetch functionality test (WebFetch not available)');
      return;
    }

    // Test actual WebFetch call to known URL
    const testUrl = 'https://example.com';
    const response = await webfetch(testUrl, { timeout: 5000 });

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    console.log('✓ PASS: WebFetch functional test successful');
  });

  test('Bash fallback functionality test', async () => {
    if (!await checkBashCurlAvailable()) {
      console.log('⚠ Skipping Bash fallback test (Bash not available)');
      return;
    }

    // Test Bash/curl call to known API
    const testUrl = 'https://api.github.com/rate_limit';
    const response = await fetchWithBash(testUrl);

    expect(response).toBeDefined();
    expect(response).toHaveProperty('resources');
    console.log('✓ PASS: Bash fallback functional test successful');
  });
});
```

**Implementation in Phase 2 Day 1 Checklist**:
```markdown
## Phase 2 Day 1: Environment Verification

### WebFetch Availability Verification (PASS/FAIL)
```bash
# Step 1: Check WebFetch tool availability
if command -v node &> /dev/null; then
  WEBFETCH_CHECK=$(node -e "console.log(typeof WebFetch !== 'undefined' ? 'available' : 'unavailable')" 2>&1)
  if [ "$WEBFETCH_CHECK" = "available" ]; then
    echo "✓ PASS: WebFetch tool is available"
    WEBFETCH_AVAILABLE=true
  else
    echo "⚠ WARNING: WebFetch tool not detected"
    WEBFETCH_AVAILABLE=false
  fi
else
  echo "⚠ WARNING: Node.js not available for WebFetch check"
  WEBFETCH_AVAILABLE=false
fi

# Step 2: Check Bash/curl fallback
if command -v curl &> /dev/null && command -v bash &> /dev/null; then
  echo "✓ PASS: Bash/curl fallback is available"
  BASH_FALLBACK_AVAILABLE=true
else
  echo "✗ FAIL: Bash/curl fallback not available"
  BASH_FALLBACK_AVAILABLE=false
fi

# Step 3: Determine overall research capability
if [ "$WEBFETCH_AVAILABLE" = true ] || [ "$BASH_FALLBACK_AVAILABLE" = true ]; then
  echo "✓ OVERALL PASS: Research capability available"
  RESEARCH_AVAILABLE=true
else
  echo "✗ OVERALL FAIL: No research capability available"
  echo "  Install curl: sudo apt-get install curl"
  echo "  For WSL (Windows): Use Ubuntu distribution"
  exit 1
fi
```

**Pass/Fail Criteria Summary**:
- **PASS**: WebFetch tool available OR Bash/curl fallback available
- **FAIL**: Neither WebFetch nor Bash/curl fallback available
- **FAIL Action**: Display installation instructions, exit with error code 1, halt Phase 2 implementation

### WebFetch Tool Detection

**Detection Command** (in `poor-dev.suggest.md`):
```markdown
# Before dispatching GLM4.7 exploration
Bash: node -e "console.log(process.env.WEBFETCH_AVAILABLE || 'false')" (timeout: 5s)

IF output == "true":
  → Proceed with Tier 1 (WebFetch enabled)
ELSE:
  → Check Bash fallback availability
  IF bash fallback available:
    → Proceed with Tier 1 (WebFetch disabled, Bash/curl fallback)
  ELSE:
    → Proceed with Tier 2 (internal knowledge only)
    → Add [LIMITED_KNOWLEDGE] tag to prompt
```

**Fallback Detection**:
```javascript
// In suggestion-exploration agent
if (!toolAvailable('webfetch')) {
  console.log('[INFO] WebFetch not available, using internal knowledge');
  // Proceed with Tier 2 fallback
  return useInternalKnowledge(prompt);
}
```

### Bash/Curl Fallback Strategy

**When WebFetch is unavailable**, the exploration agent can use Bash-based curl commands:

```markdown
## Alternative Research Strategy (WebFetch Unavailable)

### Fallback Research Process
If WebFetch tool is not available, use Bash-based curl for research:

1. GitHub Repository Research:
   ```bash
   # Search for relevant repositories
   curl -s "https://api.github.com/search/repositories?q=${SEARCH_TERM}+language:${LANGUAGE}&sort=stars&order=desc&per_page=5" | jq '.items[] | {name, stargazers_count, updated_at, url}'
   ```

2. Best Practices Documentation:
   ```bash
   # Fetch from official documentation (if known URLs)
   curl -s "https://docs.example.com/best-practices" | grep -A 5 "authentication" | head -20
   ```

3. Package Registry Information:
   ```bash
   # npm registry
   curl -s "https://registry.npmjs.org/${PACKAGE_NAME}" | jq '{version, description, homepage, keywords}'

   # PyPI
   curl -s "https://pypi.org/pypi/${PACKAGE_NAME}/json" | jq '.info | {author, description, license}'
   ```

### Limitations of Bash Fallback
- Cannot parse arbitrary web pages (only known APIs)
- Limited to public APIs with simple responses
- Requires jq for JSON parsing
- No HTML scraping capability
- Higher maintenance burden (API changes break scripts)

### Decision Matrix

| Tool Available | Strategy | Output Quality |
|----------------|----------|----------------|
| WebFetch | Primary | High (full web research) |
| WebFetch + Bash/Curl | Enhanced | Very High (web + API verification) |
| Bash/Curl only | Secondary | Medium (API-only research) |
| Internal knowledge only | Last resort | Low (outdated, limited) |

### WebFetch Verification Test

**Test Case** (in Phase 2 Day 1):
```javascript
describe('WebFetch Availability', () => {
  test('detects WebFetch tool availability', async () => {
    const isAvailable = await checkWebFetchAvailable();
    if (isAvailable) {
      // Test actual WebFetch call
      const result = await webfetch('https://example.com');
      expect(result).toBeDefined();
    } else {
      // Test Bash fallback
      const result = await fetchWithBash('https://api.github.com');
      expect(result).toBeDefined();
    }
  });

  test('fails fast if WebFetch unavailable and Bash fallback fails', async () => {
    const isWebFetchAvailable = await checkWebFetchAvailable();
    const isBashAvailable = await checkBashAvailable();

    if (!isWebFetchAvailable && !isBashAvailable) {
      // Should fail fast with clear error
      const result = await verifyResearchCapability();
      expect(result.canResearch).toBe(false);
      expect(result.error).toContain('No research capability available');
    }
  });
});
```

**Implementation in Phase 2 Day 1**:
```markdown
# Phase 2 Day 1: Environment Verification

## 1. WebFetch Verification
Bash: node -e "console.log('WEBFETCH_AVAILABLE=' + (typeof WebFetch !== 'undefined'))"

## 2. jq Availability
Bash: which jq || echo "JQ_NOT_FOUND"

## 3. GitHub API Accessibility
Bash: curl -s "https://api.github.com/rate_limit" | jq '.resources.core.remaining'

## 4. GLM4.7 Sub-Agent Dispatch Test
Bash: # Test actual GLM4.7 sub-agent dispatch with minimal prompt
echo "Testing GLM4.7 sub-agent dispatch..."
Task(model="zai-coding-plan/glm-4.7", prompt="Respond with 'GLM4.7_DISPATCH_OK' only", timeout=30)
# Expected output: GLM4.7_DISPATCH_OK
# Fail if timeout or error

## 5. Library Existence Validation Test
Bash: # Test library existence validation before scoring
npm view express version 2>/dev/null || echo "LIBRARY_CHECK_FAILED"
curl -s "https://api.github.com/repos/expressjs/express" | jq '.name' 2>/dev/null || echo "REPO_CHECK_FAILED"

## 6. Fail Fast Logic
IF WEBFETCH_AVAILABLE == "false" AND JQ_NOT_FOUND == "true":
  → ERROR: "Cannot proceed: WebFetch unavailable and jq not installed"
  → Display installation instructions
  → Exit with error code 1

IF GLM4.7 dispatch test fails:
  → ERROR: "GLM4.7 sub-agent dispatch failed. Cannot proceed with suggestion phase"
  → Display fallback options (Tier 2 or Tier 3)
  → Exit with error code 2

IF library existence validation fails:
  → ERROR: "Library existence validation failed. Cannot validate suggestions"
  → Exit with error code 3

## 7. WebFetch Tool Availability in GLM4.7 Sub-Agent Mode (H #1)

**Critical Verification**: WebFetch tool availability in GLM4.7 sub-agent mode must be verified BEFORE Phase 2 Day 1 implementation.

```javascript
// Phase 2 Day 0: WebFetch in GLM4.7 Sub-Agent Mode Verification

describe('WebFetch Availability in GLM4.7 Sub-Agent Mode', () => {
  test('Verify WebFetch tool available in GLM4.7 sub-agent mode', async () => {
    const result = {
      webFetchInSubAgent: false,
      errorMessage: null
    };

    try {
      // Test 1: Check if GLM4.7 sub-agent can access WebFetch
      const subAgentTest = await Task({
        model: "zai-coding-plan/glm-4.7",
        subagent_type: "suggestion-exploration",
        mode: "subagent",
        prompt: "Check if WebFetch tool is available in your tool list. Respond with 'WEBFETCH_AVAILABLE' if available, or 'WEBFETCH_UNAVAILABLE' if not available.",
        timeout: 30
      });

      if (subAgentTest.output.includes("WEBFETCH_AVAILABLE")) {
        result.webFetchInSubAgent = true;
        console.log("✓ PASS: WebFetch tool is available in GLM4.7 sub-agent mode");
      } else if (subAgentTest.output.includes("WEBFETCH_UNAVAILABLE")) {
        console.log("✗ FAIL: WebFetch tool NOT available in GLM4.7 sub-agent mode");
        result.errorMessage = "WebFetch tool not available in GLM4.7 sub-agent mode";
      } else {
        console.log("⚠ WARNING: GLM4.7 response unclear. Testing with actual WebFetch call...");
        // Fallback: Test with actual WebFetch call
        try {
          const webFetchTest = await Task({
            model: "zai-coding-plan/glm-4.7",
            subagent_type: "suggestion-exploration",
            mode: "subagent",
            prompt: "Use WebFetch to fetch https://example.com. Respond with the first 100 characters of the response.",
            timeout: 30
          });

          if (webFetchTest.output.length > 0) {
            result.webFetchInSubAgent = true;
            console.log("✓ PASS: WebFetch functional in GLM4.7 sub-agent mode");
          } else {
            console.log("✗ FAIL: WebFetch returned empty response");
            result.errorMessage = "WebFetch returned empty response in sub-agent mode";
          }
        } catch (error) {
          console.log("✗ FAIL: WebFetch call failed in sub-agent mode:", error.message);
          result.errorMessage = `WebFetch call failed: ${error.message}`;
        }
      }
    } catch (error) {
      console.log("✗ FAIL: GLM4.7 sub-agent dispatch failed:", error.message);
      result.errorMessage = `GLM4.7 sub-agent dispatch failed: ${error.message}`;
    }

    // Pass/Fail Criteria
    // PASS: webFetchInSubAgent === true
    // FAIL: webFetchInSubAgent === false OR errorMessage !== null

    expect(result.webFetchInSubAgent).toBe(true);

    return result;
  });

  test('Determine fallback strategy if WebFetch unavailable in sub-agent mode', async () => {
    const webFetchCheck = await checkWebFetchAvailableInSubAgent();

    if (!webFetchCheck.webFetchInSubAgent) {
      console.log("⚠ WebFetch NOT available in GLM4.7 sub-agent mode");
      console.log("  → Fallback Strategy: Tier 2 (GLM4.7 internal knowledge)");
      console.log("  → Additional Fallback: Bash/curl API calls (if available)");
      console.log("  → Last Resort: Tier 3 (manual input via orchestrator)");
      console.log("");
      console.log("  Expected Behavior:");
      console.log("    1. Suggestions will have [LIMITED_KNOWLEDGE] tag");
      console.log("    2. GLM4.7 knowledge cutoff: October 2024");
      console.log("    3. User will be prompted to manually verify current status");
      console.log("    4. Cache will be heavily prioritized");
    } else {
      console.log("✓ WebFetch available in GLM4.7 sub-agent mode");
      console.log("  → Primary Strategy: Tier 1 (full WebFetch exploration)");
      console.log("  → 5-minute timeout enforced");
      console.log("  → Full maintainability/security validation");
    }
  });
});
```

**Pass/Fail Criteria**:
- **PASS**: WebFetch tool available in GLM4.7 sub-agent mode → Proceed with Tier 1 implementation
- **FAIL**: WebFetch tool NOT available → Implement Tier 2 fallback first, document limitations

**Exit Codes**:
- Exit 0: WebFetch available in sub-agent mode (proceed to Phase 2 Day 1)
- Exit 1: WebFetch not available in sub-agent mode (implement Tier 2 fallback first)

**WebFetch Verification Result Integration**:

```markdown
# In poor-dev.suggest.md initialization
IF WebFetch verification result.webFetchInSubAgent == true:
  → Set default fallback tier: Tier 1 (WebFetch enabled)
  → Display: "✓ WebFetch available in GLM4.7 sub-agent mode"
ELSE:
  → Set default fallback tier: Tier 2 (internal knowledge)
  → Display: "⚠ WebFetch not available in sub-agent mode. Using internal knowledge."
  → Add [LIMITED_KNOWLEDGE] tag to all suggestions
  → Add [WEBFETCH_UNAVAILABLE] warning to exploration_session.warnings
```
```

### Implementation Checklist

- [ ] Add WebFetch detection to `poor-dev.suggest.md`
- [ ] Implement Bash/curl fallback functions in `lib/suggestion-researcher.mjs`
- [ ] Add jq installation check (required for JSON parsing)
- [ ] Document fallback behavior in quickstart.md
- [ ] Test with WebFetch disabled (simulate Tier 2)
- [ ] Test Bash fallback for each API (GitHub, OSV, npm, PyPI)

### jq Installation

Bash fallback requires `jq` for JSON parsing:

```bash
# Check jq installation (Phase 2 Day 1 verification)
if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required for fallback mode."
  echo "Auto-installation available on Linux/macOS only."
  echo ""
  echo "Installation options:"
  echo "  Linux:   sudo apt-get install jq"
  echo "  macOS:   brew install jq"
  echo "  Windows: Download from https://stedolan.github.io/jq/download/"
  exit 1
fi
```

**Auto-installation option** (Linux/macOS only, Phase 2 Day 1):
```bash
# Attempt auto-install on first use
if ! command -v jq &> /dev/null; then
  echo "jq not found. Attempting auto-installation..."
  echo ""

  # Detect OS
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Detected Linux. Installing jq via apt-get..."
    if sudo apt-get update -qq && sudo apt-get install -y jq; then
      echo "✓ jq installed successfully"
    else
      echo "✗ jq installation failed. Please install manually."
      exit 1
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS. Installing jq via brew..."
    if brew install jq; then
      echo "✓ jq installed successfully"
    else
      echo "✗ jq installation failed. Please install manually."
      exit 1
    fi
  else
    echo "✗ Auto-installation not supported on this platform."
    echo "Please install jq manually: https://stedolan.github.io/jq/download/"
    exit 1
  fi
fi

# Verify installation
if ! jq --version &> /dev/null; then
  echo "✗ jq verification failed. Please check installation."
  exit 1
fi
```

**Platform Compatibility Notes**:
- **Linux/macOS**: Auto-installation supported via apt-get/brew
- **Windows**: Manual installation required, WSL with bash recommended
- **Alternative for Windows**: Use PowerShell's `ConvertFrom-Json` instead of jq (limited functionality)

**Supported Platforms**:
- **Linux (Ubuntu, Debian, CentOS)**: Full support with jq auto-installation
- **macOS**: Full support with brew auto-installation
- **Windows**: Limited support via WSL (Windows Subsystem for Linux)

**Windows Limitations**:
- **Native Windows CMD/PowerShell**: Not supported (no jq, limited bash compatibility)
- **WSL on Windows**: Supported if using Ubuntu or Debian distribution
- **WSL Requirements**: Ubuntu/Debian installed via WSL, jq auto-installation works, all Bash/curl fallback commands work

**Recommendations for Windows Users**:
1. **Preferred**: Use WSL with Ubuntu distribution
2. **Alternative**: Use Git Bash for Windows (includes curl, requires manual jq installation)
3. **Fallback**: Use PowerShell with limited functionality (no jq, manual parsing)

**Platform Detection** (Phase 2 Day 1):
```bash
if [[ "$OSTYPE" == "linux-gnu"* ]]; then echo "✓ Platform: Linux (fully supported)"
elif [[ "$OSTYPE" == "darwin"* ]]; then echo "✓ Platform: macOS (fully supported)"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  echo "⚠ Platform: Windows (limited support)"
  echo "  Recommendation: Use WSL with Ubuntu for full functionality"
else echo "⚠ Platform: Unknown (may have compatibility issues)"
fi
```

## Windows Native Support Limitations (C #5, simplified)

**Windows Native (CMD/PowerShell)**:
- **No jq support**: JSON parsing requires PowerShell's `ConvertFrom-Json` (limited functionality)
- **Limited bash compatibility**: Many Bash/curl fallback commands fail
- **WebFetch availability**: Not guaranteed on native Windows environment
- **GLM4.7 sub-agent dispatch**: May have issues with path handling and environment variables

**Windows Support Recommendations**:

**Primary Option: WSL 2 Ubuntu** (MVP):
```bash
# Install WSL 2 with Ubuntu
wsl --install -d Ubuntu
# After installation and restart:
# 1. Open Ubuntu from Start menu
# 2. Update system: sudo apt update && sudo apt upgrade -y
# 3. Install required tools: sudo apt install -y curl jq nodejs npm
# 4. Run poor-dev commands from WSL Ubuntu: cd /mnt/c/path/to/project; poor-dev suggest
```

**Alternative Option: Git Bash**:
```bash
# Install Git for Windows from: https://git-scm.com/download/win
# Git Bash includes: curl, bash, basic utilities
# Install jq manually:
# 1. Download from: https://stedolan.github.io/jq/download/
# 2. Extract jq.exe to C:\Program Files\Git\usr\bin
# 3. Open Git Bash and verify: jq --version
# 4. Run poor-dev commands from Git Bash
```
cd /c/path/to/project
poor-dev suggest
```

### Windows Compatibility Matrix (MVP Scope)

| Feature | Native PowerShell | Git Bash | WSL 2 Ubuntu |
|---------|------------------|----------|--------------|
| Bash/curl fallback | ❌ No | ✅ Yes | ✅ Yes |
| jq for JSON parsing | ❌ No (limited) | ⚠ Manual install | ✅ Yes |
| WebFetch tool | ❓ Unverified | ❓ Unverified | ✅ Yes |
| GLM4.7 sub-agent | ⚠ Issues | ⚠ Issues | ✅ Yes |
| Node.js/npm | ✅ Yes | ✅ Yes | ✅ Yes |
| Poor-dev commands | ⚠ Limited | ⚠ Limited | ✅ Full |
| **MVP Support** | **No** | **Alternative** | **Primary** |

### Phase 2 Day 14: WSL 2 Compatibility Testing

**Test Scope** (MVP - WSL 2 only):
- Verify WSL 2 Ubuntu full functionality
- Test GLM4.7 sub-agent dispatch in WSL 2 environment
- Validate jq and bash/curl fallback commands
- Verify WebFetch tool availability

**Test Steps**:
1. Open WSL 2 Ubuntu
2. Verify jq installation: `jq --version`
3. Verify GLM4.7 access test
4. Run `/poor-dev.suggest` for test feature
5. Verify suggestions.yaml generation
6. Verify maintainability/security scoring

**Success Criteria**: All WSL 2 tests pass (native PowerShell support deferred to post-MVP)
|-----------|------------------|----------|-------|-------|----------|
| jq installation/auto-install | ⚠ Limited | ⚠ Manual | ✅ Full | ✅ Full | P1 |
| Bash/curl fallback | ❌ No | ✅ Full | ✅ Full | ✅ Full | P1 |
| WebFetch availability | ❓ Unverified | ❓ Unverified | ✅ Likely | ✅ Likely | P1 |
| GLM4.7 sub-agent dispatch | ⚠ Issues | ⚠ Issues | ✅ Full | ✅ Full | P1 |
| GitHub API calls | ✅ Yes (PowerShell) | ✅ Yes | ✅ Yes | ✅ Yes | P1 |
| OSV API calls | ✅ Yes (PowerShell) | ✅ Yes | ✅ Yes | ✅ Yes | P1 |
| npm/PyPI registry access | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | P1 |
| File I/O (suggestions.yaml) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | P1 |
| Pipeline transitions | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | P2 |
| Orchestrator interaction | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | P2 |

### Critical Test Scenarios

**Scenario 1: Native PowerShell (No jq, No Bash)**
```powershell
# Expected behavior: Use PowerShell cmdlets instead of bash/curl
# Limitations: No JSON parsing with jq, limited fallback capabilities
# Fallback: Tier 2 (internal knowledge only) or Tier 3 (manual input)

Test Steps:
1. Run `/poor-dev suggest` on native PowerShell
2. Verify: System detects Windows platform
3. Verify: Fallback to Tier 2 (internal knowledge)
4. Verify: [LIMITED_KNOWLEDGE] tag displayed
5. Verify: Warning about limited functionality displayed
6. Verify: User can still proceed with manual input (Tier 3)
```

**Scenario 2: Git Bash (With jq)**
```bash
# Expected behavior: Full support if jq installed manually
# Prerequisites: Install jq.exe in Git Bash usr/bin directory

Test Steps:
1. Install jq.exe in C:\Program Files\Git\usr\bin\jq.exe
2. Run `/poor-dev suggest` from Git Bash
3. Verify: Full bash/curl fallback available
4. Verify: Tier 1 or Tier 2 possible (depending on WebFetch)
5. Verify: JSON parsing works correctly
6. Verify: API calls succeed
```

**Scenario 3: WSL 2 Ubuntu (Recommended)**
```bash
# Expected behavior: Full Linux support
# Prerequisites: WSL 2 installed with Ubuntu distribution

Test Steps:
1. Open WSL 2 Ubuntu from Start menu
2. Navigate to project: cd /mnt/c/path/to/project
3. Verify jq installed (or auto-install)
4. Run `/poor-dev suggest`
5. Verify: Full Tier 1 support (if WebFetch available)
6. Verify: All API calls succeed
7. Verify: Suggestions generated and validated
```

### Test Execution Script

```powershell
# windows-compatibility-test.ps1

param(
    [ValidateSet("native", "gitbash", "wsl1", "wsl2")]
    [string]$Environment = "native"
)

function Test-NativePowerShell {
    Write-Host "Testing Native PowerShell..."
    
    # Test 1: jq availability
    $jqAvailable = Get-Command jq -ErrorAction SilentlyContinue
    if ($jqAvailable) {
        Write-Host "  ✓ jq available"
    } else {
        Write-Host "  ⚠ jq not available (expected for native PowerShell)"
    }
    
    # Test 2: curl availability
    $curlAvailable = Get-Command curl -ErrorAction SilentlyContinue
    if ($curlAvailable) {
        Write-Host "  ✓ curl available"
    } else {
        Write-Host "  ✗ curl not available"
    }
    
    # Test 3: PowerShell equivalent for API calls
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/rate_limit"
        Write-Host "  ✓ GitHub API accessible via PowerShell"
    } catch {
        Write-Host "  ✗ GitHub API inaccessible: $_"
    }
    
    # Test 4: JSON parsing without jq
    $jsonData = '{"test": "value"}'
    $parsed = $jsonData | ConvertFrom-Json
    if ($parsed.test -eq "value") {
        Write-Host "  ✓ JSON parsing via ConvertFrom-Json"
    } else {
        Write-Host "  ✗ JSON parsing failed"
    }
}

function Test-GitBash {
    Write-Host "Testing Git Bash..."
    Write-Host "  NOTE: Run this test from Git Bash, not PowerShell"
    
    # Test 1: jq availability
    $jqCheck = bash -c "which jq"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ jq available in Git Bash"
    } else {
        Write-Host "  ⚠ jq not available. Install from: https://stedolan.github.io/jq/download/"
    }
    
    # Test 2: bash/curl availability
    $bashCheck = bash -c "which curl"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ curl available in Git Bash"
    } else {
        Write-Host "  ✗ curl not available"
    }
}

function Test-WSL2 {
    Write-Host "Testing WSL 2..."
    
    # Test 1: WSL availability
    $wslCheck = wsl --list --verbose 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ WSL available"
        
        # Test 2: jq in WSL
        $jqCheck = wsl bash -c "which jq"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ jq available in WSL"
        } else {
            Write-Host "  ⚠ jq not available in WSL. Auto-install may work."
        }
        
        # Test 3: GitHub API from WSL
        $apiCheck = wsl bash -c "curl -s https://api.github.com/rate_limit"
        if ($apiCheck) {
            Write-Host "  ✓ GitHub API accessible from WSL"
        } else {
            Write-Host "  ✗ GitHub API inaccessible from WSL"
        }
    } else {
        Write-Host "  ✗ WSL not available"
    }
}

# Main execution
switch ($Environment) {
    "native" { Test-NativePowerShell }
    "gitbash" { Test-GitBash }
    "wsl1" { Test-WSL2 }  # Same tests for WSL1 and WSL2
    "wsl2" { Test-WSL2 }
    default { Write-Host "Invalid environment"; exit 1 }
}
```

### Platform-Specific Bug Checklist

**Native PowerShell**:
- [ ] File path handling (backslashes vs forward slashes)
- [ ] JSON parsing limitations without jq
- [ ] Bash command execution limitations
- [ ] Environment variable handling ($env: vs $)
- [ ] Line ending differences (CRLF vs LF)

**Git Bash**:
- [ ] jq installation verification
- [ ] Windows path mapping (/c/ vs C:\)
- [ ] File permissions issues
- [ ] Line ending compatibility

**WSL**:
- [ ] File system mount points (/mnt/c/)
- [ ] Performance differences (WSL1 vs WSL2)
- [ ] Network bridging issues
- [ ] Docker compatibility (if applicable)

### Documentation Requirements

For each test environment, document:
1. **Prerequisites**: What must be installed/configured
2. **Known Limitations**: What features won't work
3. **Workarounds**: How to overcome limitations
4. **Recommendations**: Which environment to use
```

#### Day 14: Windows Compatibility Bug Fixes and Documentation

```markdown
## Phase 2 Day 14: Windows Compatibility Fixes and Documentation

### Bug Fix Priorities

**P1 (Blocker)**:
- Fix any critical failures in WSL 2 (recommended environment)
- Ensure fallback mechanism works on native PowerShell
- Fix file I/O issues on all Windows platforms

**P2 (High)**:
- Improve jq auto-installation on Git Bash
- Add platform detection warnings
- Document platform-specific workarounds

**P3 (Medium)**:
- Optimize performance on WSL 1
- Improve error messages for Windows users
- Add platform-specific configuration options

### Windows Compatibility Documentation (H #3)

**Add to quickstart.md**:

```markdown
## Windows Compatibility (Known Limitations)

### Known Limitation: WSL-Only Support

**MVP Status**: Windows support is limited to WSL 2 (Windows Subsystem for Linux) with Ubuntu distribution. Native Windows (PowerShell/CMD) support is **NOT** available in MVP release.

**Why WSL-Only?**
- The suggestion phase requires bash, jq, and GLM4.7 sub-agent execution
- Native Windows PowerShell lacks jq support and has limited bash compatibility
- Full functionality requires Linux environment

### Supported Windows Environments

| Environment | Support Level | Prerequisites | Notes |
|-------------|---------------|----------------|-------|
| **WSL 2 Ubuntu** | ✅ **FULL SUPPORT** | WSL 2, Ubuntu 22.04+ | **RECOMMENDED** - Full functionality |
| **WSL 1 Ubuntu** | ✅ FULL SUPPORT | WSL 1, Ubuntu 22.04+ | Good alternative, slightly slower I/O |
| **Git Bash** | ⚠ PARTIAL SUPPORT | Git Bash, jq (manual) | Limited functionality |
| **Native PowerShell** | ❌ **NOT SUPPORTED** | None | Tier 2 fallback only |

### Quick Start Guide for Windows Users

#### Option 1: WSL 2 Ubuntu (Recommended)

**Prerequisites**:
- Windows 10 version 2004+ (Build 19041+) or Windows 11
- Administrative privileges

**Installation Steps**:
```powershell
# Step 1: Enable WSL and install Ubuntu
wsl --install -d Ubuntu-22.04

# Step 2: Restart computer when prompted

# Step 3: After restart, open Ubuntu from Start menu
# Step 4: Set up Ubuntu user account

# Step 5: Install required tools
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl jq nodejs npm

# Step 6: Verify installation
jq --version
node --version
npm --version

# Step 7: Navigate to project (from WSL)
cd /mnt/c/path/to/DevSkills

# Step 8: Run suggestion phase
poor-dev suggest
```

**Troubleshooting**:
```bash
# If WSL installation fails
wsl --list --verbose

# To reset WSL
wsl --unregister Ubuntu-22.04
wsl --install -d Ubuntu-22.04

# If network issues in WSL
cat /etc/resolv.conf
# Edit if needed
sudo nano /etc/resolv.conf
```

#### Option 2: Git Bash (Alternative, Limited)

**Prerequisites**:
- Git for Windows installed

**Installation Steps**:
```powershell
# Step 1: Install Git for Windows
# Download from: https://git-scm.com/download/win

# Step 2: Install jq manually
# Download from: https://github.com/jqlang/jq/releases
# Extract jq.exe and copy to: C:\Program Files\Git\usr\bin\

# Step 3: Open Git Bash
# Step 4: Navigate to project
cd /c/path/to/DevSkills

# Step 5: Verify jq
jq --version

# Step 6: Run suggestion phase (limited functionality)
poor-dev suggest
```

**Known Limitations with Git Bash**:
- WebFetch tool availability unverified
- GLM4.7 sub-agent may have issues
- Likely falls back to Tier 2 (internal knowledge)
- Manual input mode (Tier 3) more likely

#### Option 3: Native PowerShell (Not Supported for MVP)

**Why Not Supported?**
- No jq support (JSON parsing requires PowerShell's ConvertFrom-Json - limited)
- No bash compatibility for fallback commands
- GLM4.7 sub-agent execution issues likely

**If You Must Use PowerShell**:
```powershell
# Install Node.js/npm
# Download from: https://nodejs.org/

# Install PowerShell module for jq-like functionality
Install-Module -Name PSJson

# Run suggestion phase (Tier 2 fallback only)
poor-dev suggest
```

**Expected Behavior**:
- Falls back to Tier 2 (GLM4.7 internal knowledge only)
- All suggestions have [LIMITED_KNOWLEDGE] tag
- No real-time validation possible
- Manual input (Tier 3) likely required

### Known Limitations Summary

**WSL 2 Ubuntu**:
- ✅ Full functionality
- ⚠ Slight I/O performance overhead
- ⚠ File system mount points (/mnt/c/)

**Git Bash**:
- ✅ Basic functionality
- ⚠ WebFetch unverified
- ⚠ GLM4.7 sub-agent issues possible
- ⚠ Likely Tier 2 fallback

**Native PowerShell**:
- ✅ Can run commands
- ❌ No jq support
- ❌ No bash fallback
- ❌ WebFetch unverified
- ❌ Tier 2 fallback only

### Troubleshooting Common Windows Issues

**Problem: WSL 2 installation fails**
```powershell
# Solution: Enable virtualization in BIOS
# Restart computer and enter BIOS setup
# Enable Intel VT-x or AMD-V

# Solution: Enable Windows Subsystem for Linux
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Solution: Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart and try again
```

**Problem: jq not found in WSL**
```bash
# Solution: Install jq
sudo apt update
sudo apt install -y jq

# Verify
jq --version
```

**Problem: Permission denied accessing Windows files from WSL**
```bash
# Solution: Fix file permissions
sudo chmod -R 755 /mnt/c/path/to/DevSkills

# Solution: Use WSL path syntax
# Instead of: C:\Users\Name\Project
# Use: /mnt/c/Users/Name/Project
```

**Problem: Network not working in WSL**
```bash
# Solution: Restart WSL
wsl --shutdown
wsl

# Solution: Reset DNS
sudo rm /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

### Post-MVP Enhancement Plan

**Phase 3 Roadmap: Native Windows Support** (H #4):

**Phase 3.1**: Native PowerShell Support (8-10 days)
- **Objective**: Full support for native Windows (PowerShell 5.1+ and PowerShell 7+) without WSL
- **Implementation Tasks**:
  1. PowerShell equivalents for bash commands
     - Replace `curl` with `Invoke-RestMethod`
     - Replace `jq` with `ConvertFrom-Json` (or `PSJson` module)
     - Implement platform-agnostic command dispatcher
  2. GLM4.7 sub-agent in PowerShell environment
     - Test GLM4.7 dispatch from PowerShell
     - Handle Windows path separators (backslash vs forward slash)
     - Environment variable handling (`$env:VAR` vs `$VAR`)
  3. Native Windows validation functions
     - PowerShell-based API validation (GitHub, OSV, npm)
     - Windows-specific file I/O handling
  4. PowerShell-optimized rate limiting
     - PowerShell job-based rate limiting
     - Async/await patterns in PowerShell 7
- **Success Criteria**:
  - Full suggestion phase works on native PowerShell (no WSL)
  - No jq dependency required
  - Performance within 120% of Linux/macOS baseline
  - All fallback tiers (1-4) functional on PowerShell
- **Timeline**: 2026-03-03 to 2026-03-13 (10 days)

**Phase 3.2**: Windows-Specific Enhancements (5-7 days)
- **Objective**: Windows-optimized features and UX
- **Implementation Tasks**:
  1. Windows-native caching
     - Use `%LOCALAPPDATA%` for cache directory
     - Windows registry integration (optional)
  2. Windows Task Scheduler integration
     - Background cache warming
     - Periodic cache validation
  3. Windows installer (MSI/Chocolatey)
     - One-click installation
     - Automatic dependency setup
- **Timeline**: 2026-03-14 to 2026-03-20 (7 days)

**Current Status (MVP)**:
- WSL-only support is acceptable for MVP release
- Document as known limitation in README.md
- Native Windows support deferred to Phase 3 (explicit roadmap defined above)
```

### Windows Compatibility

### Supported Environments

| Environment | Support Level | Prerequisites | Notes |
|-------------|---------------|----------------|-------|
| **WSL 2 Ubuntu** | ✅ Full | WSL 2, Ubuntu | **Recommended** |
| **WSL 1 Ubuntu** | ✅ Full | WSL 1, Ubuntu | Good alternative |
| **Git Bash** | ⚠ Partial | Git Bash, jq (manual install) | Manual jq setup required |
| **Native PowerShell** | ⚠ Limited | None | Tier 2 fallback only |

### Quick Start Guide

#### Option 1: WSL 2 Ubuntu (Recommended)
```bash
# 1. Install WSL 2
wsl --install -d Ubuntu

# 2. Open Ubuntu from Start menu
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl jq nodejs npm

# 3. Navigate to project
cd /mnt/c/path/to/DevSkills

# 4. Run suggestion phase
poor-dev suggest
```

#### Option 2: Git Bash
```bash
# 1. Install Git for Windows: https://git-scm.com/download/win

# 2. Download jq.exe from: https://stedolan.github.io/jq/download/

# 3. Copy jq.exe to C:\Program Files\Git\usr\bin\

# 4. Open Git Bash
cd /c/path/to/DevSkills
poor-dev suggest
```

#### Option 3: Native PowerShell (Limited)
```powershell
# Note: Native PowerShell has limited functionality
# - No jq support
# - No bash fallback
# - Tier 2 internal knowledge only
# - Tier 3 manual input available

cd C:\path\to\DevSkills
poor-dev suggest
```

### Known Limitations on Windows

**Native PowerShell**:
- ❌ No JSON parsing with jq
- ❌ No bash/curl fallback
- ⚠ WebFetch availability unverified
- ⚠ GLM4.7 sub-agent may have issues
- ⚠ Fallback to Tier 2 (internal knowledge) only

**Git Bash**:
- ⚠ Requires manual jq installation
- ⚠ Path handling differences (/c/ vs C:\)
- ⚠ Line ending compatibility issues

**WSL**:
- ✅ Full Linux compatibility
- ✅ All features supported
- ⚠ Slight performance overhead (WSL1)
- ⚠ File system mount point (/mnt/c/)

### Troubleshooting

**Problem: jq not found**
```
Solution:
- WSL/Git Bash: sudo apt install jq
- Git Bash: Download jq.exe manually
```

**Problem: WebFetch not available**
```
Solution:
- System will fallback to Tier 2 (internal knowledge)
- Or use WSL 2 for better compatibility
```

**Problem: File path errors**
```
Solution:
- WSL: Use /mnt/c/path/to/project
- Git Bash: Use /c/path/to/project
- PowerShell: Use C:\path\to\project
```
```

### Windows-Specific Configuration

**Add to .poor-dev/config.json**:

```json
{
  "windows_compatibility": {
    "platform": "auto", // "auto", "native", "gitbash", "wsl"
    "jq_auto_install": true,
    "force_tier2_fallback": false,
    "show_platform_warnings": true,
    "path_separator": "auto" // "auto", "posix", "windows"
  }
}
```

### Test Results Reporting

For each Windows environment tested, report:
```yaml
environment: "WSL 2 Ubuntu 22.04"
test_date: "2026-02-17"
test_results:
  tier_1_support: true
  webfetch_available: true
  jq_available: true
  api_calls_successful:
    github: true
    osv: true
    npm: true
    pypi: true
  fallback_mechanism_tested: true
  known_issues: []
  recommendations: ["WSL 2 recommended for Windows users"]
```
```

```bash
# tests/integration/windows-compatibility.test.mjs

describe('Windows Compatibility', () => {
  test('Platform detection and feature availability', async () => {
    const platform = process.platform; // 'win32', 'darwin', 'linux'
    const isWSL = process.env.WSL_DISTRO_NAME !== undefined;

    if (platform === 'win32' && !isWSL) {
      console.log('⚠ WARNING: Native Windows detected');
      console.log('  Limited functionality expected');
      console.log('  Recommendations:');
      console.log('  1. Use WSL with Ubuntu: wsl --install -d Ubuntu');
      console.log('  2. Or use Git Bash: https://git-scm.com/download/win');

      // Test jq availability
      const jqAvailable = await checkCommandAvailable('jq');
      if (!jqAvailable) {
        console.log('  ⚠ jq not available - limited JSON parsing');
      }

      // Test bash availability
      const bashAvailable = await checkCommandAvailable('bash');
      if (!bashAvailable) {
        console.log('  ⚠ bash not available - limited fallback capabilities');
      }
    } else if (isWSL) {
      console.log('✓ PASS: WSL environment detected - full support expected');
    } else if (platform === 'linux') {
      console.log('✓ PASS: Linux environment detected - full support');
    } else if (platform === 'darwin') {
      console.log('✓ PASS: macOS environment detected - full support');
    }
  });

  test('Windows fallback capabilities', async () => {
    if (process.platform !== 'win32') {
      console.log('⚠ Skipping Windows-specific test (not on Windows)');
      return;
    }

    const capabilities = {
      curl: await checkCommandAvailable('curl'),
      jq: await checkCommandAvailable('jq'),
      bash: await checkCommandAvailable('bash'),
      node: await checkCommandAvailable('node'),
      npm: await checkCommandAvailable('npm')
    };

    console.log('Windows capabilities:', capabilities);

    if (!capabilities.curl) {
      console.log('✗ FAIL: curl not available - fallback will fail');
    }
    if (!capabilities.jq) {
      console.log('⚠ WARNING: jq not available - JSON parsing limited');
    }
    if (!capabilities.bash) {
      console.log('⚠ WARNING: bash not available - Bash fallbacks limited');
    }
    if (!capabilities.node || !capabilities.npm) {
      console.log('✗ FAIL: Node.js/npm not available - core functionality broken');
    }
  });
});
```

## API Rate Limiting Strategy (MVP, simplified)

**Issue**: API rate limiting not addressed for GitHub, OSV, npm/PyPI.

### Rate Limit Summary

| API | Rate Limit (Auth) | Rate Limit (Unauth) | Features/Hour | Mitigation |
|-----|-------------------|---------------------|---------------|------------|
| GitHub API | 5,000 req/hour | 60 req/hour | 6 (unauth) / 500 (auth) | GITHUB_TOKEN recommended |
| OSV API | No documented limit | 100 req/hour | 20 | Conservative limit, cache |
| npm Registry | ~10,000 req/day | ~10,000 req/day | ~139 | No strict limit |
| PyPI API | ~20,000 req/day | ~20,000 req/day | ~277 | No strict limit |

**Cost**: $0 (all APIs are free tier)

### Rate Limiting Implementation (MVP)

**Core Strategy**: Request queuing, exponential backoff, caching, circuit breaker

**Rate Limit Configuration** (Phase 2 Day 9-10):
- Implement `lib/rate-limiter.mjs` with limits per API
- GitHub: 5000 req/hour (with GITHUB_TOKEN) or 60 req/hour (unauth)
- OSV: 100 req/hour (conservative)
- npm/PyPI: 417 req/hour and 833 req/hour respectively

**Fallback Behavior**:
- GitHub API exhausted: Wait for reset (top of hour) or use cached data
- OSV API exceeded: Skip CVE check and mark with warning
- npm/PyPI: Basic throttling

**GITHUB_TOKEN Requirement**: Optional but recommended. Setup: `export GITHUB_TOKEN=your_token_here` for 83x capacity increase (6 → 500 features/hour).

**Monitoring** (Phase 2 Day 14): Track API usage per hour, alert when approaching limits, log rate limit errors.

### API Rate Limit Contingency Plan (simplified)

**Baseline**: 3 concurrent WebFetch requests per feature
**Contingency Trigger** (Day 5 measurement):
- GitHub unauth limit (60 req/hour) triggers >3 times per feature
- Average API wait time > 5 seconds per request
- Rate limit reset wait time > 3 minutes per feature

**Contingency Options** (priority order):
1. **Require GITHUB_TOKEN**: Prompt user to set token for 83x capacity increase. Setup: Generate at https://github.com/settings/tokens, set env var, re-run.
2. **Reduce Concurrent WebFetch to 2**: If GITHUB_TOKEN not available. Config: `rate_limiting.max_concurrent: 2`. Impact: 33% reduction.
3. **Reduce Concurrent WebFetch to 1**: If still hitting limits. Impact: 50% reduction, sequential only.
4. **Cache-First Mode**: Last resort. Skip API calls, use cached/pre-seeded data only. Warn user suggestions may be stale.

**Contingency Activation**: Implement `lib/rate-limit-contingency.mjs` that automatically adjusts max_concurrent and prompts for GITHUB_TOKEN based on measurement results.

**Day 5 Rate Limit Measurement**:
- Test GitHub API rate limit with parallel WebFetch (3 concurrent, 20 iterations)
- Test OSV API rate limit (30 requests)
- Test parallel WebFetch burst capacity (5 requests × 10 bursts)
- Evaluate and activate contingency if thresholds exceeded

### Rate Limiting Implementation

**Strategy**: Simplified rate limiting with basic backoff (timeline-constrained implementation)

**Concrete Rate Limit Strategy with Authentication and Queuing** (H #5):

```javascript
// lib/rate-limiter.mjs

class RateLimiter {
  constructor() {
    this.requestCounts = {
      github: 0,
      osv: 0,
      npm: 0,
      pypi: 0
    };
    this.lastReset = Date.now();
    this.windows = {
      github: 3600000, // 1 hour in ms
      osv: 3600000, // 1 hour in ms (changed from 24 hours for stricter limit)
      npm: 86400000,
      pypi: 86400000
    };
    this.limits = {
      github: process.env.GITHUB_TOKEN ? 5000 : 60, // Unauthenticated: 60 req/hour
      osv: 100, // Conservative limit: 100 req/hour
      npm: 10000,
      pypi: 20000
    };
    // Tiered API usage priorities
    this.priority = {
      github: 1, // P1: Most critical
      osv: 2,    // P2: Security-critical
      npm: 3,    // P3: Metadata
      pypi: 3     // P3: Metadata
    };
    // Request queue for rate-limited APIs
    this.queue = [];
    this.processing = false;
  }

  async acquire(api) {
    const now = Date.now();

    // Reset counter if window expired
    if (now - this.lastReset > this.windows[api]) {
      this.requestCounts[api] = 0;
      this.lastReset = now;
    }

    // Check limit
    if (this.requestCounts[api] >= this.limits[api]) {
      console.warn(`Rate limit reached for ${api}. Adding to queue...`);
      return new Promise((resolve) => {
        this.queue.push({ api, resolve });
        this.processQueue();
      });
    }

    this.requestCounts[api]++;
    return true;
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    // Sort queue by priority (P1 first, then P2, then P3)
    this.queue.sort((a, b) => this.priority[a.api] - this.priority[b.api]);

    const now = Date.now();
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      const api = item.api;

      // Check if window expired for this API
      if (now - this.lastReset > this.windows[api]) {
        this.requestCounts[api] = 0;
        this.lastReset = now;
      }

      // Check if we can process this request
      if (this.requestCounts[api] < this.limits[api]) {
        this.requestCounts[api]++;
        item.resolve(true);
        this.queue.splice(i, 1);
        i--; // Adjust index after removal
      }
    }

    this.processing = false;
  }

```javascript
// lib/rate-limiter.mjs

class RateLimiter {
  constructor() {
    this.requestCounts = {
      github: 0,
      osv: 0,
      npm: 0,
      pypi: 0
    };
    this.lastReset = Date.now();
    this.windows = {
      github: 3600000, // 1 hour in ms
      osv: 86400000, // 24 hours in ms
      npm: 86400000,
      pypi: 86400000
    };
    this.limits = {
      github: process.env.GITHUB_TOKEN ? 5000 : 60,
      osv: 1000,
      npm: 10000,
      pypi: 20000
    };
  }

  async acquire(api) {
    const now = Date.now();

    // Reset counter if window expired
    if (now - this.lastReset > this.windows[api]) {
      this.requestCounts[api] = 0;
      this.lastReset = now;
    }

    // Check limit
    if (this.requestCounts[api] >= this.limits[api]) {
      console.warn(`Rate limit reached for ${api}. Implementing backoff...`);
      const waitTime = Math.min(
        Math.pow(2, Math.floor(Math.random() * 3) + 1), // 2-8 seconds
        60 // Max 60 seconds
      );
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return this.acquire(api);
    }

    this.requestCounts[api]++;
    return true;
  }

  getUsage(api) {
    return {
      used: this.requestCounts[api],
      limit: this.limits[api],
      percent: (this.requestCounts[api] / this.limits[api] * 100).toFixed(1)
    };
  }
}

const rateLimiter = new RateLimiter();
```

### Rate Limit Exhaustion Fallback Behavior (C #3)

**Fallback Strategy When Rate Limits Are Hit Even With GITHUB_TOKEN**:

**Scenario 1: GitHub API Rate Limit Exhausted (5000 req/hour reached)**
```javascript
// Rate limit exhaustion detection and fallback
async function handleGitHubRateLimitExhaustion() {
  const usage = rateLimiter.getUsage('github');

  if (usage.used >= usage.limit) {
    console.warn('⚠ CRITICAL: GitHub API rate limit EXHAUSTED even with GITHUB_TOKEN');
    console.warn('  Used: ' + usage.used + '/' + usage.limit + ' requests');
    console.warn('');

    console.warn('FALLBACK STRATEGIES:');
    console.warn('  1. CACHE-FIRST MODE: Use cached data for maintainability scores');
    console.warn('     - Skip GitHub API calls');
    console.warn('     - Use cached maintainability scores (if available)');
    console.warn('     - Default score: 70 (neutral) if no cache');
    console.warn('');

    console.warn('  2. TIER 2 FALLBACK: GLM4.7 internal knowledge only');
    console.warn('     - Bypass all external API calls');
    console.warn('     - Rely on GLM4.7 training data (knowledge cutoff: October 2024)');
    console.warn('     - Add [LIMITED_KNOWLEDGE] tag to all suggestions');
    console.warn('     - Add [RATE_LIMITED] tag to all suggestions');
    console.warn('');

    console.warn('  3. SKIP OPTIONAL VALIDATION: Skip non-critical API calls');
    console.warn('     - Skip GitHub API for issue resolution rate');
    console.warn('     - Skip OSV API for security (use cached CVE data)');
    console.warn('     - Only validate GitHub repo existence');
    console.warn('');

    console.warn('  4. QUEUE AND WAIT: Queue requests until quota resets');
    console.warn('     - Add requests to queue');
    console.warn('     - Wait for quota reset (top of next hour)');
    console.warn('     - Process queued requests after reset');
    console.warn('');

    console.warn('RECOMMENDATION: Use Cache-First + Tier 2 fallback combination');
    console.warn('  - Provides suggestions without blocking on rate limits');
    console.warn('  - Accepts data staleness (cached or pre-2024)');
    console.warn('  - Allows pipeline to continue without delay');
    console.warn('');

    // Auto-activate cache-first mode
    return {
      mode: 'cache-first',
      tag: '[RATE_LIMITED]',
      message: 'GitHub API rate limit exhausted. Using cached data with reduced accuracy.'
    };
  }
}
```

**Fallback Priority Order**:
1. **Cache-First Mode** (Preferred): Use cached maintainability scores, skip API calls
2. **Tier 2 Fallback** (Secondary): GLM4.7 internal knowledge with [LIMITED_KNOWLEDGE] tag
3. **Skip Optional Validation** (Tertiary): Skip non-critical API calls, maintain basic validation
4. **Queue and Wait** (Last Resort): Queue requests, wait for quota reset

**User Notification When Rate Limits Hit**:
```yaml
⚠ API RATE LIMIT WARNING
===========================
GitHub API rate limit EXHAUSTED even with GITHUB_TOKEN.

Current Status:
  - Requests Used: 5000/5000
  - Time Until Reset: 15 minutes
  - Action: Activating fallback mode

Fallback Mode: CACHE-FIRST
============================
  - Using cached maintainability scores
  - Skipping real-time GitHub API validation
  - Suggestions tagged: [RATE_LIMITED]
  - Accuracy: Reduced (data may be stale)

Options:
  1. Continue with fallback suggestions
  2. Wait for quota reset (recommended if accuracy critical)
  3. Generate new GITHUB_TOKEN (if current token rate-limited)

Documentation:
  - See quickstart.md: "API Rate Limit Handling"
  - See: https://docs.github.com/rest/rate-limit
```

**Scenario 2: OSV API Rate Limit Exhausted**
```javascript
async function handleOSVRateLimitExhaustion() {
  const usage = rateLimiter.getUsage('osv');

  if (usage.used >= usage.limit) {
    console.warn('⚠ WARNING: OSV API rate limit EXHAUSTED');
    console.warn('  Fallback: Use cached CVE data or assume security_score=80');

    return {
      mode: 'cache-security',
      tag: '[SECURITY_LIMITED]',
      message: 'OSV API rate limit exhausted. Using cached CVE data with reduced security validation.'
    };
  }
}
```

**Scenario 3: npm/PyPI Rate Limit Exhausted**
```javascript
async function handleRegistryRateLimitExhaustion(api) {
  const usage = rateLimiter.getUsage(api);

  if (usage.used >= usage.limit) {
    console.warn(`⚠ WARNING: ${api.toUpperCase()} registry rate limit EXHAUSTED`);
    console.warn('  Fallback: Use cached metadata or assume basic defaults');

    return {
      mode: 'cache-metadata',
      tag: '[METADATA_LIMITED]',
      message: `${api.toUpperCase()} registry rate limit exhausted. Using cached metadata.`
    };
  }
}
```

**Rate Limit Exhaustion Mitigation Summary**:
| API | Rate Limit | Exhaustion Fallback | Tag Added | Accuracy Impact |
|-----|-----------|---------------------|-----------|-----------------|
| GitHub API | 5000 req/hour (with token) | Cache-First → Tier 2 → Queue | [RATE_LIMITED] | Reduced (stale data) |
| OSV API | 100 req/hour | Cache security scores | [SECURITY_LIMITED] | Reduced (old CVE data) |
| npm/PyPI | 10,000-20,000 req/day | Cache metadata | [METADATA_LIMITED] | Minimal (metadata less critical) |

### Request Queuing and Tiered API Usage Priorities

**Priority Strategy** (H #5):
- **P1 (Highest)**: GitHub API - Critical for maintainability scoring
- **P2 (High)**: OSV API - Security-critical for CVE checks
- **P3 (Medium)**: npm/PyPI API - Metadata enhancement, can fall back to cached data

**Queue Processing**:
1. When an API hits rate limit, subsequent requests go to queue
2. Queue is sorted by priority (P1 before P2 before P3)
3. When quota resets, highest-priority requests are processed first
4. Low-priority requests may be skipped if quota insufficient

**Example**:
```javascript
// When multiple APIs are rate-limited
await Promise.all([
  rateLimiter.acquire('github'),  // P1: Processed first
  rateLimiter.acquire('osv'),     // P2: Processed second
  rateLimiter.acquire('npm'),     // P3: Processed third
]);
```

**Authentication Strategy**:
```javascript
// GitHub API authentication enhancement
async function fetchGitHubWithAuth(repo) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.warn('GITHUB_TOKEN not set. Using unauthenticated mode (60 req/hour limit).');
    console.warn('Generate token at: https://github.com/settings/tokens');
    console.warn('Add to environment: export GITHUB_TOKEN="your_token"');
  }

  await rateLimiter.acquire('github');

  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: token ? { 'Authorization': `token ${token}` } : {}
  });

  return response.json();
}
```

**Authentication Setup Guide** (H #5):
```bash
# Generate GitHub Personal Access Token
# 1. Go to: https://github.com/settings/tokens
# 2. Click "Generate new token (classic)"
# 3. Select scopes: public_repo (read-only)
# 4. Generate and copy token

# Set environment variable
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Add to ~/.bashrc or ~/.zshrc for persistence
echo 'export GITHUB_TOKEN="your_token_here"' >> ~/.bashrc
source ~/.bashrc

# Verify
echo $GITHUB_TOKEN
```
```

### GitHub API Rate Limiting

**Authenticated Mode** (Recommended):
```javascript
// Use GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn('GITHUB_TOKEN not set. Using unauthenticated rate limit (60 req/hour)');
}
```

**GITHUB_TOKEN Setup Guide** (C #4):

**Why Use GITHUB_TOKEN?**
- Unauthenticated: 60 requests/hour (may block multi-suggestion validation)
- Authenticated: 5,000 requests/hour (83x more capacity)

**Step-by-Step GITHUB_TOKEN Setup**:

1. **Generate GitHub Personal Access Token**:
   ```
   1. Go to: https://github.com/settings/tokens
   2. Click "Generate new token (classic)"
   3. Select scopes:
      - ✓ public_repo (read-only public repository data)
      - Optional: read:org (if accessing private repositories)
   4. Set expiration: No expiration or 90 days (recommended)
   5. Click "Generate token"
   6. Copy the token immediately (starts with ghp_)
   ```

2. **Set Environment Variable**:
   ```bash
   # Linux/macOS - Set for current session
   export GITHUB_TOKEN="ghp_your_token_here"

   # Add to ~/.bashrc for persistence (Linux)
   echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
   source ~/.bashrc

   # Add to ~/.zshrc for persistence (macOS)
   echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Windows (PowerShell) Setup**:
   ```powershell
   # Set for current session
   $env:GITHUB_TOKEN="ghp_your_token_here"

   # Add to profile for persistence
   [System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_your_token_here', 'User')

   # Restart PowerShell for changes to take effect
   ```

4. **Windows (Git Bash/WSL) Setup**:
   ```bash
   # Git Bash (same as Linux/macOS)
   export GITHUB_TOKEN="ghp_your_token_here"
   echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
   source ~/.bashrc

   # WSL (Ubuntu) - same as Linux
   export GITHUB_TOKEN="ghp_your_token_here"
   echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
   source ~/.bashrc
   ```

5. **Verify Token**:
   ```bash
   # Check if token is set
   echo $GITHUB_TOKEN

   # Test GitHub API access
   curl -H "Authorization: token $GITHUB_TOKEN" \
        https://api.github.com/rate_limit | jq '.resources.core'

   # Expected output (authenticated):
   # {
   #   "limit": 5000,
   #   "remaining": 4999,
   #   "reset": 1234567890
   # }

   # Expected output (unauthenticated):
   # {
   #   "limit": 60,
   #   "remaining": 59,
   #   "reset": 1234567890
   # }
   ```

6. **GITHUB_TOKEN Verification Test (Phase 2 Day 1)**:
   ```javascript
   // tests/integration/github-token-verification.test.mjs

   describe('GITHUB_TOKEN Verification', () => {
     test('Verify GITHUB_TOKEN and rate limit', async () => {
       const token = process.env.GITHUB_TOKEN;

       if (!token) {
         console.log('⚠ WARNING: GITHUB_TOKEN not set');
         console.log('  Unauthenticated rate limit: 60 req/hour');
         console.log('  Setup guide: https://github.com/settings/tokens');
         console.log('  Add to environment: export GITHUB_TOKEN="ghp_your_token"');
         // Test should NOT fail, but log warning
       } else {
         console.log('✓ PASS: GITHUB_TOKEN is set');

         // Verify token works with GitHub API
         const response = await fetch('https://api.github.com/rate_limit', {
           headers: { 'Authorization': `token ${token}` }
         });
         const data = await response.json();

         console.log(`  GitHub API rate limit: ${data.resources.core.limit} req/hour`);
         console.log(`  Remaining: ${data.resources.core.remaining}`);

         // Verify authenticated rate limit (should be 5000)
         expect(data.resources.core.limit).toBeGreaterThanOrEqual(5000);
         console.log('✓ PASS: GITHUB_TOKEN is valid and authenticated');
       }
     });
   });
   ```

7. **Rate Limit Comparison Table**:
   | Mode | Rate Limit | Requests per 10 Features | Setup Time |
   |------|------------|---------------------------|------------|
   | Unauthenticated | 60 req/hour | 6 req/hour | 0 min |
   | Authenticated | 5,000 req/hour | 500 req/hour | 2 min |
   | **Recommendation** | **Authenticated** | **83x more capacity** | **Setup once** |

**Cache-First Strategy for Low Quota**:
```javascript
// In suggestion-exploration agent
async function fetchWithCacheFirst(url) {
  const cacheKey = generateCacheKey(url);

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached && !isCacheExpired(cached)) {
    console.log(`Cache hit for ${url}`);
    return cached.data;
  }

  // Check quota before API call
  const usage = rateLimiter.getUsage('github');
  if (usage.percent > 80) {
    console.warn(`GitHub API at ${usage.percent}% capacity. Prioritizing cache.`);
    // Use cached data even if slightly expired
    const staleCache = await cache.get(cacheKey);
    if (staleCache) {
      console.log(`Using stale cache (${staleCache.age} seconds old)`);
      return staleCache.data;
    }
  }

  // Fetch from API
  await rateLimiter.acquire('github');
  const data = await fetch(url);
  const jsonData = await data.json();

  // Cache result
  await cache.set(cacheKey, {
    data: jsonData,
    timestamp: Date.now()
  });

  return jsonData;
}
```

// Fetch with rate limiting
async function fetchGitHubRepo(owner, repo) {
  await rateLimiter.acquire('github', 1);

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}
  });

  // Check rate limit headers
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (remaining === '0') {
    const resetTime = new Date(parseInt(reset) * 1000);
    const waitSeconds = Math.ceil((resetTime - Date.now()) / 1000);
    console.warn(`GitHub rate limit exceeded. Resets at ${resetTime}`);

    // Update rate limiter to respect GitHub's reset time
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    return fetchGitHubRepo(owner, repo); // Retry after reset
  }

  return response.json();
}
```

**Unauthenticated Mode** (Fallback):
```javascript
// With 60 req/hour limit, we need strategic batching
async function fetchMultipleRepos(repos) {
  // Batch requests to maximize within limit
  const batchSize = 10; // 6 batches per hour
  const batches = chunkArray(repos, batchSize);

  for (const batch of batches) {
    await rateLimiter.acquire('github', batchSize);
    await Promise.all(batch.map(repo => fetchGitHubRepo(repo.owner, repo.repo)));

    // Wait between batches to stay within limit
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 600000)); // 10 minutes
    }
  }
}
```

### OSV API Rate Limiting

```javascript
async function fetchOSVVulnerabilities(ecosystem, packageName) {
  await rateLimiter.acquire('osv', 1);

  const response = await fetch(`https://api.osv.dev/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      package: { name: packageName, ecosystem: ecosystem }
    })
  });

  // Check for rate limit errors
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;

    console.warn(`OSV rate limit exceeded. Waiting ${waitSeconds}s...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    return fetchOSVVulnerabilities(ecosystem, packageName);
  }

  return response.json();
}
```

### npm/PyPI Rate Limiting

```javascript
async function fetchNpmPackage(packageName) {
  await rateLimiter.acquire('npm', 1);

  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    return response.json();
  } catch (error) {
    if (error.status === 429) {
      // npm uses 503 with Retry-After
      const retryAfter = error.headers.get('Retry-After') || 10;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return fetchNpmPackage(packageName);
    }
    throw error;
  }
}

async function fetchPyPIPackage(packageName) {
  await rateLimiter.acquire('pypi', 1);

  const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || 10);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return fetchPyPIPackage(packageName);
  }

  return response.json();
}
```

### Multi-Language Ecosystem Support (C #7)

**Current Scope Issue**: Implementation focused on JavaScript/npm only, but spec mentions "library" suggestion type which implies multi-ecosystem support.

**Ecosystem-Specific Support Plan**:

| Ecosystem | Package Manager | API Endpoint | Rate Limit | Status |
|-----------|---------------|--------------|------------|--------|
| **npm** (JavaScript) | npm, yarn, pnpm | https://registry.npmjs.org/${package} | ~10,000 req/day | **Implemented** |
| **PyPI** (Python) | pip, pipenv, poetry | https://pypi.org/pypi/${package}/json | ~20,000 req/day | **In Spec, Not Implemented** |
| **crates.io** (Rust) | cargo | https://crates.io/api/v1/crates/${package} | ~10,000 req/day | **Add** |
| **Maven Central** (Java) | maven, gradle | https://search.maven.org/solrsearch/select?q=g:${groupId}+AND+a:${artifactId} | ~5,000 req/day | **Add** |
| **RubyGems** (Ruby) | bundler | https://rubygems.org/api/v1/gems/${package}.json | ~10,000 req/day | **Add** |
| **Go Modules** (Go) | go mod | https://proxy.golang.org/${package}/@latest | ~10,000 req/day | **Add** |

**Multi-Ecosystem Implementation Strategy**:

```javascript
// lib/ecosystem-manager.mjs

class EcosystemManager {
  constructor() {
    this.ecosystems = {
      npm: {
        name: 'npm',
        packageManager: 'npm',
        apiEndpoint: 'https://registry.npmjs.org',
        rateLimit: 10000,
        fetchFunction: this.fetchNpmPackage.bind(this),
        auditCommand: 'npm audit',
        auditAvailable: true
      },
      pypi: {
        name: 'pypi',
        packageManager: 'pip',
        apiEndpoint: 'https://pypi.org/pypi',
        rateLimit: 20000,
        fetchFunction: this.fetchPyPIPackage.bind(this),
        auditCommand: 'pip-audit',
        auditAvailable: true
      },
      cargo: {
        name: 'cargo',
        packageManager: 'cargo',
        apiEndpoint: 'https://crates.io/api/v1/crates',
        rateLimit: 10000,
        fetchFunction: this.fetchCargoPackage.bind(this),
        auditCommand: 'cargo audit',
        auditAvailable: true
      },
      maven: {
        name: 'maven',
        packageManager: 'maven',
        apiEndpoint: 'https://search.maven.org/solrsearch/select',
        rateLimit: 5000,
        fetchFunction: this.fetchMavenPackage.bind(this),
        auditCommand: null, // No built-in audit for Maven
        auditAvailable: false,
        requiresFormat: 'groupId:artifactId'
      },
      rubygems: {
        name: 'rubygems',
        packageManager: 'bundler',
        apiEndpoint: 'https://rubygems.org/api/v1/gems',
        rateLimit: 10000,
        fetchFunction: this.fetchRubyGemsPackage.bind(this),
        auditCommand: 'bundler-audit',
        auditAvailable: true
      },
      gomod: {
        name: 'gomod',
        packageManager: 'go mod',
        apiEndpoint: 'https://proxy.golang.org',
        rateLimit: 10000,
        fetchFunction: this.fetchGoPackage.bind(this),
        auditCommand: 'govulncheck',
        auditAvailable: true
      }
    };
  }

  async fetchPackage(ecosystem, packageName, options = {}) {
    const eco = this.ecosystems[ecosystem];
    if (!eco) {
      throw new Error(`Unsupported ecosystem: ${ecosystem}`);
    }

    await rateLimiter.acquire(ecosystem, 1);
    return await eco.fetchFunction(packageName, options);
  }

  async fetchNpmPackage(packageName) {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    return response.json();
  }

  async fetchPyPIPackage(packageName) {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
    return response.json();
  }

  async fetchCargoPackage(packageName) {
    const response = await fetch(`https://crates.io/api/v1/crates/${packageName}`);
    return response.json();
  }

  async fetchMavenPackage(groupId, artifactId) {
    const query = encodeURIComponent(`g:${groupId} AND a:${artifactId}`);
    const response = await fetch(`https://search.maven.org/solrsearch/select?q=${query}&rows=1&wt=json`);
    const data = await response.json();
    return data.response.docs[0];
  }

  async fetchRubyGemsPackage(packageName) {
    const response = await fetch(`https://rubygems.org/api/v1/gems/${packageName}.json`);
    return response.json();
  }

  async fetchGoPackage(packagePath) {
    const response = await fetch(`https://proxy.golang.org/${packagePath}/@latest`);
    return response.json();
  }

  detectEcosystemFromProject(projectDir) {
    // Detect ecosystem from project files
    if (existsSync(join(projectDir, 'package.json'))) return 'npm';
    if (existsSync(join(projectDir, 'requirements.txt')) ||
        existsSync(join(projectDir, 'pyproject.toml'))) return 'pypi';
    if (existsSync(join(projectDir, 'Cargo.toml'))) return 'cargo';
    if (existsSync(join(projectDir, 'pom.xml'))) return 'maven';
    if (existsSync(join(projectDir, 'Gemfile'))) return 'rubygems';
    if (existsSync(join(projectDir, 'go.mod'))) return 'gomod';

    // Default to npm if no ecosystem detected
    return 'npm';
  }

  isAuditAvailable(ecosystem) {
    return this.ecosystems[ecosystem]?.auditAvailable || false;
  }

  getAuditCommand(ecosystem) {
    return this.ecosystems[ecosystem]?.auditCommand || null;
  }
}

const ecosystemManager = new EcosystemManager();
```

**Multi-Ecosystem Security Auditing**:

```javascript
// lib/security-audit.mjs

class SecurityAuditor {
  constructor() {
    this.auditCommands = {
      npm: 'npm audit --json',
      pypi: 'pip-audit --format json',
      cargo: 'cargo audit --json',
      maven: null, // Use OWASP Dependency Check as external tool
      rubygems: 'bundler-audit --format json',
      gomod: 'govulncheck -json ./...'
    };
  }

  async runAudit(ecosystem, packageDir) {
    const command = this.auditCommands[ecosystem];
    if (!command) {
      console.log(`Audit not available for ${ecosystem}, skipping`);
      return { vulnerabilities: [] };
    }

    try {
      const result = execSync(command, { cwd: packageDir, encoding: 'utf8' });
      return JSON.parse(result);
    } catch (error) {
      // Audit tools exit with non-zero on vulnerabilities
      if (error.stdout) {
        return JSON.parse(error.stdout);
      }
      return { vulnerabilities: [] };
    }
  }
}

const securityAuditor = new SecurityAuditor();
```

**Multi-Ecosystem Implementation Timeline**:
- **Phase 2 MVP**: npm only (current implementation)
- **Phase 3 Enhancement**: Add PyPI, crates.io support
- **Phase 4 Enhancement**: Add Maven Central, RubyGems, Go Modules support

**Multi-Ecosystem Test Coverage**:
- Test package existence validation for each ecosystem
- Test security scoring with ecosystem-specific CVE sources
- Test maintainability scoring with ecosystem-specific metrics
- Test audit command execution for each ecosystem

**Limitations**:
- Maven requires groupId:artifactId format (single package name insufficient)
- Some ecosystems lack built-in audit tools (requires external integration)
- Rate limits vary significantly by ecosystem

### Conflict Resolution Strategy for Rate Limits

**Scenario**: Multiple APIs hit rate limits simultaneously

```javascript
// In suggestion-exploration agent
async function validateSuggestion(suggestion) {
  const validationResults = {};

  // Try all validations, handle partial failures
  try {
    validationResults.github = await fetchGitHubData(suggestion);
  } catch (error) {
    if (error.isRateLimit) {
      console.warn('GitHub rate limit hit, using cached or default data');
      validationResults.github = getGithubDefaultData(suggestion);
    } else {
      throw error;
    }
  }

  try {
    validationResults.osv = await fetchOSVVulnerabilities(suggestion);
  } catch (error) {
    if (error.isRateLimit) {
      validationResults.osv = { vulns: [] }; // Assume safe if can't check
    } else {
      throw error;
    }
  }

  try {
    validationResults.registry = await fetchRegistryData(suggestion);
  } catch (error) {
    if (error.isRateLimit) {
      validationResults.registry = getRegistryDefaultData(suggestion);
    } else {
      throw error;
    }
  }

  // Calculate scores with available data
  return calculateScores(validationResults);
}
```

### Exponential Backoff for Burst Handling

```javascript
async function fetchWithBackoff(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || Math.pow(2, attempt);
        const waitTime = Math.min(retryAfter, 60); // Cap at 60s

        console.warn(`Rate limit hit (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitTime}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }

      return response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

### Rate Limit Monitoring

```javascript
// Track rate limit usage for monitoring
const rateLimitMetrics = {
  github: { used: 0, limit: 60, resetsAt: null },
  osv: { used: 0, limit: 1000, resetsAt: null },
  npm: { used: 0, limit: 10000, resetsAt: null },
  pypi: { used: 0, limit: 20000, resetsAt: null }
};

function logRateLimitMetrics() {
  console.log('Rate Limit Metrics:', JSON.stringify(rateLimitMetrics, null, 2));

  // Alert if approaching limits
  Object.entries(rateLimitMetrics).forEach(([api, metrics]) => {
    const usagePercent = (metrics.used / metrics.limit) * 100;
    if (usagePercent > 80) {
      console.warn(`Warning: ${api} API at ${usagePercent.toFixed(1)}% capacity`);
    }
  });
}

### Quota Monitoring and Degraded Mode

**Implementation**:
```javascript
// lib/quota-monitor.mjs
class QuotaMonitor {
  constructor(config) {
    this.config = config;
    this.quota = {
      github: { used: 0, limit: 60, exhausted: false, resetsAt: null },
      osv: { used: 0, limit: 1000, exhausted: false, resetsAt: null },
      npm: { used: 0, limit: 10000, exhausted: false, resetsAt: null },
      pypi: { used: 0, limit: 20000, exhausted: false, resetsAt: null }
    };
    this.degradedMode = false;
  }

  checkQuota(api) {
    const quota = this.quota[api];
    const usagePercent = (quota.used / quota.limit) * 100;

    // Check if quota exhausted or approaching threshold
    if (usagePercent >= 100) {
      quota.exhausted = true;
      if (this.config.quota_monitoring.degraded_mode.enabled) {
        this.degradedMode = true;
      }
      console.warn(`Quota exhausted for ${api}. Entering degraded mode.`);
      return false;
    }

    if (usagePercent >= this.config.quota_monitoring.alert_threshold) {
      console.warn(`Quota at ${usagePercent.toFixed(1)}% for ${api}.`);
    }

    return true;
  }

  recordUsage(api, tokens = 1) {
    this.quota[api].used += tokens;
    return this.checkQuota(api);
  }

  shouldUseCache(api) {
    // In degraded mode, prioritize cache
    if (this.degradedMode && this.config.quota_monitoring.degraded_mode.cache_first) {
      return true;
    }
    return false;
  }

  shouldSkipAPI(api, isOptional = false) {
    // Skip optional APIs in degraded mode
    if (this.degradedMode &&
        this.config.quota_monitoring.degraded_mode.skip_optional_apis &&
        isOptional) {
      console.log(`Skipping optional ${api} API in degraded mode`);
      return true;
    }

    // Skip exhausted APIs
    return this.quota[api].exhausted;
  }

  getDegradedModeStatus() {
    return {
      active: this.degradedMode,
      exhausted_apis: Object.entries(this.quota)
        .filter(([_, q]) => q.exhausted)
        .map(([name, _]) => name),
      recommendations: [
        'Consider using authenticated GitHub API (GITHUB_TOKEN)',
        'Enable longer cache duration',
        'Prioritize cache-first strategy',
        'Skip optional validation checks'
      ]
    };
  }
}
```
```

### Configuration

**`.poor-dev/config.json` additions**:
```json
{
  "rate_limiting": {
    "github": {
      "auth_mode": "authenticated", // or "unauthenticated"
      "burst_handling": "exponential_backoff",
      "max_retries": 3
    },
    "osv": {
      "burst_handling": "linear_backoff",
      "max_retries": 2
    },
    "cache_duration": 3600, // Cache API responses for 1 hour
    "respect_retry_after": true
  },
  "api_keys": {
    "github_token": "${GITHUB_TOKEN}", // Environment variable
    "snyk_token": "${SNYK_TOKEN}", // Optional
    "osv_token": null // No auth needed for OSV
  },
  "quota_monitoring": {
    "enabled": true,
    "alert_threshold": 0.8, // Alert at 80% quota usage
    "degraded_mode": {
      "enabled": true,
      "cache_first": true, // Prioritize cache over API calls
      "skip_optional_apis": true // Skip non-critical APIs when quota exhausted
    }
  },
  "circuit_breaker": {
    "enabled": true,
    "default_config": {
      "threshold": 5, // Failures before opening circuit
      "timeout": 60000, // Time in OPEN state before HALF-OPEN (ms)
      "reset_timeout": 30000, // Failure count reset window (ms)
      "half_open_success_threshold": 2, // Successful calls to close from HALF-OPEN
      "retry_pattern": "exponential" // "exponential" or "linear"
    },
    "api_specific": {
      "github": {
        "threshold": 5,
        "timeout": 60000,
        "reset_timeout": 30000,
        "half_open_success_threshold": 2,
        "retry_pattern": "exponential"
      },
      "osv": {
        "threshold": 5,
        "timeout": 60000,
        "reset_timeout": 30000,
        "half_open_success_threshold": 2,
        "retry_pattern": "exponential"
      },
      "npm": {
        "threshold": 10,
        "timeout": 60000,
        "reset_timeout": 30000,
        "half_open_success_threshold": 3,
        "retry_pattern": "linear"
      },
      "pypi": {
        "threshold": 10,
        "timeout": 60000,
        "reset_timeout": 30000,
        "half_open_success_threshold": 3,
        "retry_pattern": "linear"
      }
    }
  }
}
```

### Testing Rate Limiting

```javascript
describe('Rate Limiting', () => {
  test('respects GitHub rate limit', async () => {
    const mockCalls = 100;
    const limit = 60; // Unauthenticated limit

    const calls = Array(mockCalls).fill().map((_, i) =>
      fetchGitHubRepo('expressjs', 'express')
    );

    const results = await Promise.allSettled(calls);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    expect(successful).toBeLessThanOrEqual(limit);
  });

  test('implements exponential backoff', async () => {
    const start = Date.now();
    await fetchWithBackoff('https://api.github.com/rate_limit', {}, 3);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThan(100); // Should have waited at least once
  });
});
```

### Implementation Checklist

- [ ] Implement `lib/rate-limiter.mjs` with token bucket algorithm
- [ ] Add rate limiting to all API calls (GitHub, OSV, npm, PyPI)
- [ ] Implement exponential backoff for burst handling
- [ ] Add retry logic with `Retry-After` header respect
- [ ] Implement rate limit monitoring and alerts
- [ ] Add GITHUB_TOKEN check and warning
- [ ] Test with unauthenticated GitHub API (60 req/hour limit)
- [ ] Test rate limit exhaustion and recovery
- [ ] Document rate limiting in quickstart.md
- [ ] Add configuration to `.poor-dev/config.json`

## API Downtime Handling Strategy (H #3)

### Issue

API downtime handling is missing - no strategy for API unavailability beyond generic network fallback. Must add API downtime handling with exponential backoff, circuit breaker, and degraded mode indicators.

### Circuit Breaker Pattern

```javascript
// lib/circuit-breaker.mjs

class CircuitBreaker {
  constructor(config = {}) {
    // EXPLICIT THRESHOLDS (H #4)
    this.threshold = config.threshold || 5; // Failures before opening circuit
    this.timeout = config.timeout || 60000; // Time to wait in OPEN state before HALF-OPEN (60 seconds)
    this.resetTimeout = config.resetTimeout || 30000; // Time to reset failure count window (30 seconds)
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold || 2; // Successful calls before closing from HALF-OPEN

    // Per-API configuration (customizable per API)
    this.apiConfig = {
      github: {
        threshold: 5,         // 5 consecutive failures before opening
        timeout: 60000,       // 60 seconds in OPEN state
        resetTimeout: 30000,  // 30 seconds failure count window
        halfOpenSuccessThreshold: 2, // 2 successful calls to close
        retryPattern: 'exponential'
      },
      osv: {
        threshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
        halfOpenSuccessThreshold: 2,
        retryPattern: 'exponential'
      },
      npm: {
        threshold: 10,        // More lenient for npm (higher rate limit)
        timeout: 60000,
        resetTimeout: 30000,
        halfOpenSuccessThreshold: 3,
        retryPattern: 'linear'
      },
      pypi: {
        threshold: 10,        // More lenient for PyPI (higher rate limit)
        timeout: 60000,
        resetTimeout: 30000,
        halfOpenSuccessThreshold: 3,
        retryPattern: 'linear'
      }
    };

    // Monitor states for each API
    this.monitors = {
      github: { failures: 0, successesInHalfOpen: 0, lastFailure: 0, state: 'closed', openedAt: 0 },
      osv: { failures: 0, successesInHalfOpen: 0, lastFailure: 0, state: 'closed', openedAt: 0 },
      npm: { failures: 0, successesInHalfOpen: 0, lastFailure: 0, state: 'closed', openedAt: 0 },
      pypi: { failures: 0, successesInHalfOpen: 0, lastFailure: 0, state: 'closed', openedAt: 0 }
    };
  }

  async execute(api, fn) {
    const monitor = this.monitors[api];
    const config = this.apiConfig[api];

    // Check if circuit is open
    if (monitor.state === 'open') {
      const now = Date.now();
      const timeSinceOpen = now - monitor.openedAt;

      if (timeSinceOpen < config.timeout) {
        const waitTime = Math.ceil((config.timeout - timeSinceOpen) / 1000);
        console.warn(`⚠ Circuit OPEN for ${api}. Blocking request. Retry in ${waitTime}s.`);
        throw new Error(`CircuitBreaker: ${api} circuit is open (wait ${waitTime}s)`);
      } else {
        // Transition to HALF-OPEN state to test recovery
        console.log(`⚠ Circuit HALF-OPEN for ${api}. Testing recovery...`);
        monitor.state = 'half-open';
        monitor.successesInHalfOpen = 0;
      }
    }

    try {
      const result = await fn();

      // Success - handle based on current state
      if (monitor.state === 'half-open') {
        monitor.successesInHalfOpen++;
        console.log(`✓ ${api} call succeeded (${monitor.successesInHalfOpen}/${config.halfOpenSuccessThreshold} to close)`);

        // If enough successful calls in HALF-OPEN, close circuit
        if (monitor.successesInHalfOpen >= config.halfOpenSuccessThreshold) {
          monitor.state = 'closed';
          monitor.failures = 0;
          monitor.successesInHalfOpen = 0;
          console.log(`✓ Circuit CLOSED for ${api}. API recovered.`);
        }
      } else {
        // Normal success in CLOSED state
        monitor.failures = 0;
      }

      return result;
    } catch (error) {
      monitor.failures++;
      monitor.lastFailure = Date.now();

      // Check if threshold exceeded
      if (monitor.failures >= config.threshold) {
        monitor.state = 'open';
        monitor.openedAt = Date.now();
        monitor.successesInHalfOpen = 0;

        const errorType = this.classifyError(error);
        console.error(`⚠ Circuit OPEN for ${api} after ${monitor.failures} failures (threshold: ${config.threshold})`);
        console.error(`  Last error: ${errorType} - ${error.message}`);
        console.error(`  Retry after: ${config.timeout / 1000}s`);

        // Emit circuit open event
        this.emit('circuitOpen', {
          api,
          failures: monitor.failures,
          threshold: config.threshold,
          errorType,
          errorMessage: error.message,
          retryAfter: config.timeout / 1000
        });
      }

      throw error;
    }
  }

  classifyError(error) {
    // Classify error types for better debugging
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'NETWORK_ERROR';
    }
    if (error.code === 'ETIMEDOUT') {
      return 'TIMEOUT';
    }
    if (error.status === 429) {
      return 'RATE_LIMIT';
    }
    if (error.status >= 500) {
      return 'SERVER_ERROR';
    }
    if (error.status >= 400) {
      return 'CLIENT_ERROR';
    }
    return 'UNKNOWN';
  }

  getState(api) {
    const monitor = this.monitors[api];
    const config = this.apiConfig[api];

    return {
      api,
      state: monitor.state,
      failures: monitor.failures,
      threshold: config.threshold,
      lastFailure: monitor.lastFailure,
      openedAt: monitor.openedAt,
      timeSinceOpen: monitor.state === 'open' ? Date.now() - monitor.openedAt : null,
      successesInHalfOpen: monitor.successesInHalfOpen,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold,
      retryAfter: monitor.state === 'open' ? Math.max(0, Math.ceil((config.timeout - (Date.now() - monitor.openedAt)) / 1000)) : 0
    };
  }

  reset(api) {
    // Manually reset circuit breaker for testing or recovery
    const monitor = this.monitors[api];
    monitor.state = 'closed';
    monitor.failures = 0;
    monitor.successesInHalfOpen = 0;
    monitor.lastFailure = 0;
    monitor.openedAt = 0;
    console.log(`✓ Circuit breaker manually reset for ${api}`);
  }

  emit(event, data) {
    console.log(`[CircuitBreaker Event] ${event}:`, JSON.stringify(data, null, 2));
  }
}

const circuitBreaker = new CircuitBreaker();
```

### EXPLICIT CIRCUIT BREAKER CONFIGURATION (H #4)

**Thresholds (Failures before opening)**:
| API | Threshold | Timeout | Reset Timeout | Half-Open Success | Rationale |
|-----|-----------|---------|---------------|-------------------|-----------|
| GitHub API | 5 | 60s | 30s | 2 | Critical for maintainability, faster recovery |
| OSV API | 5 | 60s | 30s | 2 | Security-critical, faster recovery |
| npm Registry | 10 | 60s | 30s | 3 | Higher rate limit, more lenient |
| PyPI Registry | 10 | 60s | 30s | 3 | Higher rate limit, more lenient |

**State Transitions**:
```
CLOSED → OPEN: When failures >= threshold
OPEN → HALF-OPEN: After timeout (60s)
HALF-OPEN → CLOSED: After halfOpenSuccessThreshold successful calls
HALF-OPEN → OPEN: On failure (reset timeout starts over)
```

**Retry Patterns**:
| Pattern | Description | Use Case |
|---------|-------------|----------|
| Exponential | 2^n seconds delay (with jitter) | GitHub, OSV (critical APIs) |
| Linear | Fixed delay (5-10s) | npm, PyPI (lenient APIs) |

**Example Retry Pattern Implementation**:
```javascript
// Exponential backoff with jitter (for GitHub, OSV)
const exponentialDelay = Math.min(
  Math.pow(2, attempt) * 1000, // 2s, 4s, 8s, 16s, 32s
  60000 // Max 60s
);
const jitter = exponentialDelay * 0.1 * Math.random();
const finalDelay = exponentialDelay + jitter;

// Linear backoff (for npm, PyPI)
const linearDelay = 5000; // Fixed 5s
```

### Exponential Backoff with Jitter

```javascript
// lib/exponential-backoff.mjs

class ExponentialBackoff {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 5;
    this.initialDelay = config.initialDelay || 1000; // 1 second
    this.maxDelay = config.maxDelay || 60000; // 60 seconds
    this.backoffFactor = config.backoffFactor || 2;
    this.jitter = config.jitter || true;
  }

  async execute(fn, context = 'API') {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on certain error types
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);

        console.warn(`${context} attempt ${attempt + 1}/${this.maxRetries} failed: ${error.message}`);
        console.warn(`Retrying in ${Math.round(delay / 1000)} seconds...`);

        await this.sleep(delay);
      }
    }

    console.error(`${context} failed after ${this.maxRetries} attempts`);
    throw lastError;
  }

  calculateDelay(attempt) {
    let delay = this.initialDelay * Math.pow(this.backoffFactor, attempt);
    delay = Math.min(delay, this.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitter = delay * 0.1 * Math.random();
      delay += jitter;
    }

    return delay;
  }

  shouldNotRetry(error) {
    // Don't retry on client errors (4xx)
    if (error.status && error.status >= 400 && error.status < 500) {
      return true;
    }

    // Don't retry on certain error types
    if (error.code === 'ECONNABORTED') {
      return false; // Timeout - should retry
    }

    if (error.code === 'ENOTFOUND') {
      return true; // DNS resolution failed - won't help to retry
    }

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const exponentialBackoff = new ExponentialBackoff({
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffFactor: 2,
  jitter: true
});
```

### EXPLICIT RETRY PATTERNS (H #4)

**Pattern 1: Exponential Backoff with Jitter**
- **Use For**: GitHub API, OSV API (critical APIs)
- **Delays**: 2s, 4s, 8s, 16s, 32s (with ±10% jitter)
- **Max Delay**: 60s
- **Rationale**: Prevents thundering herd, reduces server load during outages

**Pattern 2: Linear Backoff**
- **Use For**: npm Registry, PyPI Registry (high-capacity APIs)
- **Delays**: 5s, 5s, 5s, 5s, 5s (fixed)
- **Max Delay**: 5s
- **Rationale**: Simple, predictable, sufficient for high-rate-limit APIs

**Pattern 3: Respect Retry-After Header**
- **Use For**: All APIs when header present
- **Behavior**: Use server-provided retry delay instead of calculated delay
- **Priority**: Retry-After > Exponential > Linear

**Retry Pattern Selection Table**:

| API | Primary Pattern | Max Retries | Initial Delay | Max Delay | Jitter |
|-----|-----------------|-------------|---------------|-----------|--------|
| GitHub API | Exponential | 5 | 2s | 60s | Yes (±10%) |
| OSV API | Exponential | 5 | 2s | 60s | Yes (±10%) |
| npm Registry | Linear | 3 | 5s | 5s | No |
| PyPI Registry | Linear | 3 | 5s | 5s | No |
| All (Retry-After) | Server-Directed | - | - | - | - |

**Retry Pattern Implementation Example**:
```javascript
// Retry delay calculation with pattern selection
function calculateRetryDelay(api, attempt, retryAfterHeader) {
  const config = circuitBreaker.apiConfig[api];
  const pattern = config.retryPattern;

  // Priority 1: Respect Retry-After header if present
  if (retryAfterHeader) {
    const retryAfter = parseInt(retryAfterHeader) * 1000;
    console.log(`Using server-provided Retry-After: ${retryAfter / 1000}s`);
    return retryAfter;
  }

  // Priority 2: Use configured pattern
  if (pattern === 'exponential') {
    const delay = Math.min(
      Math.pow(2, attempt) * 1000, // 2s, 4s, 8s, 16s, 32s
      60000 // Max 60s
    );
    // Add ±10% jitter
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return delay + jitter;
  } else if (pattern === 'linear') {
    return 5000; // Fixed 5s delay
  }

  // Fallback: Default exponential
  return Math.min(Math.pow(2, attempt) * 1000, 60000);
}
```

### Degraded Mode Indicators

```javascript
// lib/degraded-mode.mjs

class DegradedModeManager {
  constructor(config = {}) {
    this.degradedMode = false;
    this.indicators = {
      github: { available: true, lastCheck: 0, errorRate: 0 },
      osv: { available: true, lastCheck: 0, errorRate: 0 },
      npm: { available: true, lastCheck: 0, errorRate: 0 },
      pypi: { available: true, lastCheck: 0, errorRate: 0 }
    };
    this.errorWindow = config.errorWindow || 60000; // 1 minute
    this.errorThreshold = config.errorThreshold || 0.5; // 50% error rate triggers degraded mode
  }

  recordError(api) {
    const indicator = this.indicators[api];
    const now = Date.now();

    // Reset if window expired
    if (now - indicator.lastCheck > this.errorWindow) {
      indicator.errorRate = 0;
    }

    indicator.errorRate += 1;
    indicator.lastCheck = now;
    indicator.available = false;

    // Check if degraded mode should be activated
    this.checkDegradedMode();
  }

  recordSuccess(api) {
    const indicator = this.indicators[api];
    const now = Date.now();

    if (now - indicator.lastCheck > this.errorWindow) {
      indicator.errorRate = 0;
    }

    indicator.available = true;
    this.checkDegradedMode();
  }

  checkDegradedMode() {
    const unavailableCount = Object.values(this.indicators)
      .filter(i => !i.available).length;

    const totalApis = Object.keys(this.indicators).length;

    // Activate degraded mode if >50% of APIs unavailable
    if (unavailableCount / totalApis > 0.5) {
      if (!this.degradedMode) {
        console.warn('⚠ DEGRADED MODE ACTIVATED');
        console.warn('  Multiple APIs are unavailable or experiencing high error rates');
        console.warn('  Using cached data and fallback strategies');
        this.degradedMode = true;
      }
    } else if (unavailableCount === 0) {
      // Deactivate degraded mode if all APIs available
      if (this.degradedMode) {
        console.log('✓ DEGRADED MODE DEACTIVATED');
        console.log('  All APIs are now available');
        this.degradedMode = false;
      }
    }
  }

  getStatus() {
    return {
      degradedMode: this.degradedMode,
      apis: Object.entries(this.indicators).map(([api, indicator]) => ({
        api,
        available: indicator.available,
        errorRate: indicator.errorRate
      }))
    };
  }

  getDegradedModeIndicator() {
    if (this.degradedMode) {
      return '⚠ [DEGRADED_MODE] Some APIs unavailable. Results may be incomplete.';
    }
    return '';
  }
}

const degradedModeManager = new DegradedModeManager({
  errorWindow: 60000,
  errorThreshold: 0.5
});
```

### Integrated API Handler with All Strategies

```javascript
// lib/api-handler.mjs

class APIHandler {
  constructor() {
    this.circuitBreaker = new CircuitBreaker();
    this.exponentialBackoff = new ExponentialBackoff();
    this.degradedModeManager = new DegradedModeManager();
  }

  async fetchAPI(api, url, options = {}) {
    return this.circuitBreaker.execute(api, async () => {
      return this.exponentialBackoff.execute(async () => {
        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          // Record success
          this.degradedModeManager.recordSuccess(api);

          return await response.json();
        } catch (error) {
          // Record error
          this.degradedModeManager.recordError(api);
          throw error;
        }
      }, `${api} API`);
    });
  }

  async fetchGitHubRepo(owner, repo) {
    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const options = token ? {
      headers: { 'Authorization': `token ${token}` }
    } : {};

    return this.fetchAPI('github', url, options);
  }

  async fetchOSVVulnerabilities(ecosystem, packageName) {
    const url = 'https://api.osv.dev/v1/query';
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: { name: packageName, ecosystem: ecosystem }
      })
    };

    return this.fetchAPI('osv', url, options);
  }

  async fetchNpmPackage(packageName) {
    const url = `https://registry.npmjs.org/${packageName}`;
    return this.fetchAPI('npm', url);
  }

  async fetchPyPIPackage(packageName) {
    const url = `https://pypi.org/pypi/${packageName}/json`;
    return this.fetchAPI('pypi', url);
  }

  getStatus() {
    return {
      circuitBreaker: {
        github: this.circuitBreaker.getState('github'),
        osv: this.circuitBreaker.getState('osv'),
        npm: this.circuitBreaker.getState('npm'),
        pypi: this.circuitBreaker.getState('pypi')
      },
      degradedMode: this.degradedModeManager.getStatus()
    };
  }

  getDegradedModeIndicator() {
    return this.degradedModeManager.getDegradedModeIndicator();
  }
}

const apiHandler = new APIHandler();
```

### API Downtime Handling Tests

```javascript
// tests/integration/api-downtime-handling.test.mjs

describe('API Downtime Handling', () => {
  test('Circuit breaker opens after threshold failures', async () => {
    const circuitBreaker = new CircuitBreaker({ threshold: 3 });

    // Simulate failures
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute('github', async () => {
          throw new Error('API error');
        });
      } catch (error) {
        // Expected
      }
    }

    // Circuit should be open
    expect(circuitBreaker.getState('github').state).toBe('open');

    // Next request should be blocked
    await expect(
      circuitBreaker.execute('github', async () => ({ success: true }))
    ).rejects.toThrow('CircuitBreaker: github circuit is open');
  });

  test('Exponential backoff with jitter', async () => {
    const backoff = new ExponentialBackoff({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      jitter: true
    });

    const attemptDelays = [];
    let attemptCount = 0;

    try {
      await backoff.execute(async () => {
        attemptCount++;
        throw new Error('API error');
      });
    } catch (error) {
      // Expected to fail after retries
    }

    expect(attemptCount).toBe(4); // 1 initial + 3 retries
  });

  test('Degraded mode activation', async () => {
    const manager = new DegradedModeManager({ errorThreshold: 0.5 });

    // Simulate 3 of 4 APIs failing
    manager.recordError('github');
    manager.recordError('osv');
    manager.recordError('npm');

    // Should activate degraded mode (3/4 = 75% > 50%)
    expect(manager.getStatus().degradedMode).toBe(true);

    // Recovery - all APIs succeed
    manager.recordSuccess('github');
    manager.recordSuccess('osv');
    manager.recordSuccess('npm');
    manager.recordSuccess('pypi');

    // Should deactivate degraded mode
    expect(manager.getStatus().degradedMode).toBe(false);
  });

  test('Integrated API handler with all strategies', async () => {
    const handler = new APIHandler();

    // Test successful fetch
    const result = await handler.fetchNpmPackage('express');
    expect(result).toHaveProperty('name', 'express');
    expect(handler.getStatus().degradedMode.degradedMode).toBe(false);
  });
});
```

### API Downtime Monitoring Dashboard

```javascript
// lib/api-monitor.mjs

class APIMonitor {
  constructor() {
    this.metrics = {
      github: { requests: 0, successes: 0, failures: 0, lastError: null, lastSuccessTime: null },
      osv: { requests: 0, successes: 0, failures: 0, lastError: null, lastSuccessTime: null },
      npm: { requests: 0, successes: 0, failures: 0, lastError: null, lastSuccessTime: null },
      pypi: { requests: 0, successes: 0, failures: 0, lastError: null, lastSuccessTime: null }
    };
  }

  recordRequest(api) {
    this.metrics[api].requests++;
  }

  recordSuccess(api) {
    this.metrics[api].successes++;
    this.metrics[api].lastSuccessTime = Date.now();
  }

  recordFailure(api, error) {
    this.metrics[api].failures++;
    this.metrics[api].lastError = error.message;
  }

  getMetrics(api) {
    return this.metrics[api];
  }

  getAllMetrics() {
    return this.metrics;
  }

  printMetrics() {
    console.log('=== API Metrics ===');
    Object.entries(this.metrics).forEach(([api, metrics]) => {
      const errorRate = metrics.requests > 0 ? (metrics.failures / metrics.requests * 100).toFixed(1) : 0;
      console.log(`\n${api.toUpperCase()}:`);
      console.log(`  Requests: ${metrics.requests}`);
      console.log(`  Successes: ${metrics.successes}`);
      console.log(`  Failures: ${metrics.failures}`);
      console.log(`  Error Rate: ${errorRate}%`);
      if (metrics.lastError) {
        console.log(`  Last Error: ${metrics.lastError}`);
      }
    });
  }
}

const apiMonitor = new APIMonitor();
```

### Implementation Checklist

- [ ] Implement `lib/circuit-breaker.mjs`
- [ ] Implement `lib/exponential-backoff.mjs`
- [ ] Implement `lib/degraded-mode.mjs`
- [ ] Implement `lib/api-handler.mjs` (integrated handler)
- [ ] Implement `lib/api-monitor.mjs`
- [ ] Add API downtime handling tests
- [ ] Add circuit breaker status to suggestion output
- [ ] Add degraded mode indicators to user notifications
- [ ] Document API downtime handling in quickstart.md

## Conflicting Suggestions Resolution

### Conflict Scenarios

**Issue**: Conflicting suggestions scenario not handled (C #9). Must define conflict resolution logic.

### Conflict Types

1. **Version Conflicts**: Suggested library conflicts with existing project dependencies
2. **Purpose Overlap**: Multiple tools suggested for same purpose (e.g., multiple ORMs)
3. **License Incompatibility**: Suggested license conflicts with project license
4. **Architecture Conflicts**: Suggestion conflicts with existing architecture patterns

### Conflict Detection Logic

```javascript
// lib/conflict-detector.mjs (simplified version for plan.md)

async function detectVersionConflict(suggestion, projectDependencies) {
  const existingDep = projectDependencies[suggestion.name];
  if (!existingDep) return null;

  const suggestedMajor = parseVersion(suggestion.version).major;
  const existingMajor = parseVersion(existingDep).major;

  if (suggestedMajor !== existingMajor) {
    return {
      type: 'version',
      severity: 'high',
      reason: `Major version mismatch: project uses v${existingMajor}, suggestion recommends v${suggestedMajor}`
    };
  }
  return null;
}

async function detectLicenseConflict(suggestion, projectLicense) {
  const incompatibleLicenses = {
    'MIT': ['GPL-3.0', 'AGPL-3.0', 'SSPL'],
    'Apache-2.0': ['GPL-3.0', 'AGPL-3.0', 'SSPL'],
    'BSD-3-Clause': ['GPL-3.0', 'AGPL-3.0', 'SSPL']
  };

  const incompatible = incompatibleLicenses[projectLicense];
  if (incompatible && incompatible.includes(suggestion.license)) {
    return {
      type: 'license',
      severity: 'critical',
      reason: `License incompatibility: ${projectLicense} project cannot use ${suggestion.license}`
    };
  }
  return null;
}

async function detectPurposeOverlaps(suggestions) {
  const purposes = {};
  suggestions.forEach(s => {
    const purpose = s.purpose || 'general';
    if (!purposes[purpose]) purposes[purpose] = [];
    purposes[purpose].push(s);
  });

  const conflicts = [];
  Object.entries(purposes).forEach(([purpose, suggestionsList]) => {
    if (suggestionsList.length > 1) {
      suggestionsList.sort((a, b) => {
        const scoreA = a.maintainability_score + a.security_score;
        const scoreB = b.maintainability_score + b.security_score;
        return scoreB - scoreA;
      });
      conflicts.push({
        type: 'purpose_overlap',
        purpose: purpose,
        recommended: suggestionsList[0].name,
        alternatives: suggestionsList.slice(1).map(s => s.name)
      });
    }
  });

  return conflicts;
}
```

### Resolution Hierarchy

1. **Critical Conflicts** (license): Auto-exclude
2. **High Conflicts** (version): Flag for manual decision
3. **Low Conflicts** (purpose overlap): Prioritize by score, show alternatives

### Implementation Checklist

- [ ] Implement `lib/conflict-detector.mjs`
- [ ] Add conflict resolution to suggestion flow
- [ ] Design conflict presentation format
- [ ] Test all conflict scenarios

## Learning Mechanism for Rejected Suggestions (C #9)

**Issue**: SC-008 requires recording decisions but no analysis of how rejected suggestions improve future quality. Must design feedback loop mechanism for rejected suggestions to improve future quality.

### Learning Feedback Loop Architecture

**Goal**: Learn from user rejections to improve future suggestion quality

**Learning Components**:
1. **Rejection Tracking**: Record detailed reasons for suggestion rejections
2. **Pattern Analysis**: Identify common rejection patterns
3. **Model Adjustment**: Adjust suggestion criteria based on learned patterns
4. **Quality Metrics**: Track improvement over time

### Rejection Data Model

```yaml
# ${FEATURE_DIR}/suggestion-decisions.yaml (enhanced with learning data)
decisions:
  - suggestion_id: "sugg-1"
    name: "passport"
    action: "rejected"
    rejection_reason:
      category: "compatibility"  # categories: compatibility, complexity, preference, security, performance, maintainability
      detail: "Too complex for our use case, prefer simpler OAuth2 implementation"
      severity: "high"  # severity: low, medium, high
      context:
        feature_complexity: "simple"
        team_expertise: "beginner"
        project_constraints: ["no-dependency-bloat"]
    timestamp: "2026-02-12T10:00:00Z"
  - suggestion_id: "sugg-2"
    name: "express"
    action: "accepted"
    selection_reason:
      category: "standard"
      detail: "Industry standard, team familiar with it"
      context:
        team_expertise: "expert"
        project_type: "api"
    timestamp: "2026-02-12T10:05:00Z"
```

### Rejection Categories (C #9)

**Category Taxonomy**:

| Category | Description | Adjustment Action |
|----------|-------------|-------------------|
| **compatibility** | Suggested library incompatible with existing stack | Deprioritize similar libraries in future |
| **complexity** | Library too complex for team/project | Simplify suggestion complexity level |
| **preference** | Team prefers alternative for non-technical reasons | Record preference, no automatic adjustment |
| **security** | Security concerns (CVEs, audit failures) | Increase security score threshold |
| **performance** | Performance concerns (slow, bloated) | Add performance metrics to scoring |
| **maintainability** | Maintenance concerns (abandoned, low quality) | Increase maintainability score threshold |
| **license** | License incompatibility | Filter out incompatible licenses |
| **documentation** | Poor documentation or examples | Prefer well-documented libraries |

### Learning Algorithm

```javascript
// lib/learning-engine.mjs

class LearningEngine {
  constructor() {
    this.rejectionHistory = [];
    this.rejectionPatterns = {};
    this.adjustmentFactors = {
      complexity: 1.0,
      security_threshold: 50,
      maintainability_threshold: 50,
      documentation_weight: 1.0
    };
  }

  async recordDecision(decision) {
    if (decision.action === 'rejected') {
      this.rejectionHistory.push(decision);
      await this.analyzeRejection(decision);
    }

    // Persist to database/file
    await this.saveDecisionHistory();
  }

  async analyzeRejection(decision) {
    const category = decision.rejection_reason.category;

    // Track rejection frequency by category
    if (!this.rejectionPatterns[category]) {
      this.rejectionPatterns[category] = {
        count: 0,
        library_names: [],
        contexts: []
      };
    }

    this.rejectionPatterns[category].count++;
    this.rejectionPatterns[category].library_names.push(decision.name);

    if (decision.rejection_reason.context) {
      this.rejectionPatterns[category].contexts.push(decision.rejection_reason.context);
    }

    // Adjust scoring factors based on patterns
    this.adjustScoringFactors(category, decision.rejection_reason);
  }

  adjustScoringFactors(category, reason) {
    switch (category) {
      case 'complexity':
        // Reduce complexity threshold for future suggestions
        this.adjustmentFactors.complexity *= 0.95;
        console.log(`Adjustment: Complexity factor reduced to ${this.adjustmentFactors.complexity.toFixed(2)}`);
        break;

      case 'security':
        // Increase security score threshold
        this.adjustmentFactors.security_threshold += 5;
        console.log(`Adjustment: Security threshold increased to ${this.adjustmentFactors.security_threshold}`);
        break;

      case 'maintainability':
        // Increase maintainability score threshold
        this.adjustmentFactors.maintainability_threshold += 5;
        console.log(`Adjustment: Maintainability threshold increased to ${this.adjustmentFactors.maintainability_threshold}`);
        break;

      case 'documentation':
        // Increase weight for documentation in scoring
        this.adjustmentFactors.documentation_weight *= 1.1;
        console.log(`Adjustment: Documentation weight increased to ${this.adjustmentFactors.documentation_weight.toFixed(2)}`);
        break;

      case 'performance':
        // Add performance penalty to similar libraries
        console.log('Adjustment: Performance penalty added to similar libraries');
        break;

      case 'license':
        // Filter out incompatible licenses
        console.log('Adjustment: License filter updated');
        break;

      case 'preference':
        // No automatic adjustment, record for reference
        console.log(`Adjustment: Preference recorded for ${reason.library_names.join(', ')}`);
        break;
    }
  }

  getAdjustedScoringCriteria() {
    return {
      maintainability_threshold: Math.min(this.adjustmentFactors.maintainability_threshold, 80),
      security_threshold: Math.min(this.adjustmentFactors.security_threshold, 90),
      complexity_factor: Math.max(this.adjustmentFactors.complexity, 0.5),
      documentation_weight: Math.min(this.adjustmentFactors.documentation_weight, 2.0)
    };
  }

  async getQualityImprovementMetrics() {
    if (this.rejectionHistory.length < 10) {
      return {
        status: 'insufficient_data',
        message: 'Need at least 10 recorded decisions for analysis'
      };
    }

    const totalDecisions = this.rejectionHistory.length;
    const rejections = this.rejectionHistory.filter(d => d.action === 'rejected').length;
    const acceptanceRate = 1 - (rejections / totalDecisions);

    // Calculate trend (improvement over time)
    const recentRejections = this.rejectionHistory.slice(-10).filter(d => d.action === 'rejected').length;
    const earlierRejections = this.rejectionHistory.slice(0, -10).filter(d => d.action === 'rejected').length;

    const trend = recentRejections < earlierRejections ? 'improving' : 'stable';

    return {
      total_decisions: totalDecisions,
      total_rejections: rejections,
      acceptance_rate: (acceptanceRate * 100).toFixed(1) + '%',
      trend,
      adjustments_applied: Object.keys(this.adjustmentFactors),
      common_rejection_categories: Object.entries(this.rejectionPatterns)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([cat, data]) => ({ category: cat, count: data.count }))
        .slice(0, 3)
    };
  }

  async saveDecisionHistory() {
    const historyPath = join(process.cwd(), '.poor-dev', 'learning', 'decision-history.yaml');
    await fs.mkdir(dirname(historyPath), { recursive: true });

    const data = {
      rejection_history: this.rejectionHistory,
      rejection_patterns: this.rejectionPatterns,
      adjustment_factors: this.adjustmentFactors,
      last_updated: new Date().toISOString()
    };

    await fs.writeFile(historyPath, YAML.stringify(data), 'utf8');
  }

  async loadDecisionHistory() {
    const historyPath = join(process.cwd(), '.poor-dev', 'learning', 'decision-history.yaml');

    if (!existsSync(historyPath)) return;

    const data = YAML.parse(await fs.readFile(historyPath, 'utf8'));
    this.rejectionHistory = data.rejection_history || [];
    this.rejectionPatterns = data.rejection_patterns || {};
    this.adjustmentFactors = data.adjustment_factors || this.adjustmentFactors;
  }
}

const learningEngine = new LearningEngine();
```

### Integration with Suggestion Flow

```javascript
// In suggestion-exploration agent

// Get adjusted scoring criteria from learning engine
const adjustedCriteria = learningEngine.getAdjustedScoringCriteria();

// Apply adjusted thresholds when filtering suggestions
const filteredSuggestions = suggestions.filter(s => {
  if (s.maintainability_score < adjustedCriteria.maintainability_threshold) return false;
  if (s.security_score < adjustedCriteria.security_threshold) return false;
  return true;
});

// Apply complexity factor to suggestions
filteredSuggestions.forEach(s => {
  const complexityScore = s.maintainability_score * adjustedCriteria.complexity_factor;
  s.complexity_adjusted_score = complexityScore;
});

// Sort by adjusted score
filteredSuggestions.sort((a, b) => b.complexity_adjusted_score - a.complexity_adjusted_score);
```

### Quality Improvement Tracking

**Metrics Dashboard**:

```yaml
# .poor-dev/learning/quality-metrics.yaml
last_updated: "2026-02-12T10:00:00Z"
total_features_analyzed: 25
total_suggestions_made: 150
total_decisions_recorded: 150

acceptance_rate:
  overall: 68%
  last_10_features: 72%
  trend: "improving"

rejection_analysis:
  most_common_rejections:
    - category: "complexity"
      count: 15
      percentage: 10%
    - category: "security"
      count: 12
      percentage: 8%
    - category: "maintainability"
      count: 10
      percentage: 7%

adjustments_applied:
  - "security_threshold increased from 50 to 70"
  - "maintainability_threshold increased from 50 to 60"
  - "complexity_factor reduced from 1.0 to 0.90"

learning_effectiveness:
  baseline_acceptance_rate: 60%
  current_acceptance_rate: 68%
  improvement: "+8%"
  learning_confidence: "high"
```

### Implementation Checklist (C #9)

- [ ] Implement `lib/learning-engine.mjs`
- [ ] Enhance suggestion-decisions.yaml with rejection reasons
- [ ] Implement rejection category taxonomy
- [ ] Add learning adjustment to suggestion scoring
- [ ] Implement quality metrics dashboard
- [ ] Test learning feedback loop with sample rejections
- [ ] Document learning mechanism in quickstart.md

## Cache Strategy and Cold Start

### Offline Mode Implementation with Cache Seeding Strategy (C #8)

**Issue**: Pre-seeded cache mentioned but no seeding strategy. Must design offline mode architecture with cache seeding strategy, validation logic, and offline-first user experience.

### Offline Mode Architecture

**Architecture Components**:
1. **Pre-seeded Cache**: High-confidence libraries per category (auth, database, API, etc.)
2. **Cache Validation Logic**: Verify cached data is still accurate
3. **Offline Detection**: Automatic detection of network restrictions
4. **Offline-First User Experience**: Seamless operation without API access

### Cache Seeding Strategy (C #8)

**Pre-Seeding Approach**: Load top 100 libraries per category into initial cache

**Seeding Data Structure**:
```yaml
# ${FEATURE_DIR}/exploration-cache.yaml (pre-seeded)
cache_version: "1.0"
last_updated: "2026-02-12T00:00:00Z"
seeding_strategy: "top_100_per_category"
categories:
  authentication:
    # Top 10 authentication libraries
    - name: "passport"
      ecosystem: "npm"
      maintainability_score: 85
      security_score: 90
      rationale: "成熟した認証ミドルウェア"
      last_verified: "2026-02-12"
      popularity_rank: 1
    - name: "next-auth"
      ecosystem: "npm"
      maintainability_score: 90
      security_score: 92
      rationale: "Next.js認証ライブラリ"
      last_verified: "2026-02-12"
      popularity_rank: 2
    # ... (8 more auth libraries)
  database:
    # Top 10 database libraries
    - name: "prisma"
      ecosystem: "npm"
      maintainability_score: 92
      security_score: 88
      rationale: "モダンなORM、TypeScript対応"
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more database libraries)
  api:
    # Top 10 API/web framework libraries
    - name: "express"
      ecosystem: "npm"
      maintainability_score: 95
      security_score: 90
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more API libraries)
  logging:
    # Top 10 logging libraries
    - name: "winston"
      ecosystem: "npm"
      maintainability_score: 88
      security_score: 90
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more logging libraries)
  testing:
    # Top 10 testing libraries
    - name: "jest"
      ecosystem: "npm"
      maintainability_score: 92
      security_score: 95
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more testing libraries)
  validation:
    # Top 10 validation libraries
    - name: "joi"
      ecosystem: "npm"
      maintainability_score: 88
      security_score: 90
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more validation libraries)
  utilities:
    # Top 10 utility libraries
    - name: "lodash"
      ecosystem: "npm"
      maintainability_score: 95
      security_score: 90
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more utility libraries)
  security:
    # Top 10 security libraries
    - name: "helmet"
      ecosystem: "npm"
      maintainability_score: 92
      security_score: 95
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more security libraries)
  caching:
    # Top 10 caching libraries
    - name: "redis"
      ecosystem: "npm"
      maintainability_score: 95
      security_score: 88
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more caching libraries)
  async:
    # Top 10 async libraries
    - name: "async"
      ecosystem: "npm"
      maintainability_score: 90
      security_score: 95
      last_verified: "2026-02-12"
      popularity_rank: 1
    # ... (9 more async libraries)
```

**Seeding Algorithm**:
```javascript
// lib/cache-seeder.mjs

class CacheSeeder {
  constructor() {
    this.cacheDir = join(process.cwd(), '.poor-dev', 'cache');
    this.cacheFile = join(this.cacheDir, 'exploration-cache.yaml');
    this.topN = 10; // Top 10 libraries per category
  }

  async seedCache() {
    console.log('Seeding initial cache with high-confidence libraries...');

    const initialCache = {
      cache_version: '1.0',
      last_updated: new Date().toISOString(),
      seeding_strategy: `top_${this.topN}_per_category`,
      categories: {}
    };

    // Fetch top libraries for each category
    const categories = ['authentication', 'database', 'api', 'logging', 'testing',
                       'validation', 'utilities', 'security', 'caching', 'async'];

    for (const category of categories) {
      const libraries = await this.fetchTopLibraries(category);
      initialCache.categories[category] = libraries;
    }

    // Write cache file
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.cacheFile, YAML.stringify(initialCache), 'utf8');

    console.log(`✓ Cache seeded: ${Object.keys(initialCache.categories).length} categories`);
    return initialCache;
  }

  async fetchTopLibraries(category) {
    // Use GitHub API to fetch top libraries by category
    const query = `${category} language:javascript sort:stars`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${this.topN}`;

    const response = await fetch(url);
    const data = await response.json();

    const libraries = data.items.map(async (repo) => {
      // Validate library existence
      const npmResponse = await fetch(`https://registry.npmjs.org/${repo.name}`);
      const npmExists = npmResponse.ok;

      if (!npmExists) return null;

      // Fetch security score from OSV
      const osvResponse = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: { name: repo.name, ecosystem: 'npm' }
        })
      });
      const osvData = await osvResponse.json();
      const hasCVEs = osvData.vulns && osvData.vulns.length > 0;

      // Calculate maintainability score
      const maintainabilityScore = this.calculateMaintainabilityScore(repo);

      // Calculate security score
      const securityScore = hasCVEs ? 60 : 90;

      return {
        name: repo.name,
        ecosystem: 'npm',
        github_repo: repo.full_name,
        maintainability_score: maintainabilityScore,
        security_score: securityScore,
        rationale: `Highly rated ${category} library with ${repo.stargazers_count} stars`,
        last_verified: new Date().toISOString(),
        popularity_rank: repo.stargazers_count
      };
    });

    // Filter nulls and await all
    return (await Promise.all(libraries)).filter(lib => lib !== null);
  }

  calculateMaintainabilityScore(repo) {
    let score = 50; // Base score

    // Stars contribution (max 30 points)
    const stars = repo.stargazers_count;
    score += Math.min(stars / 1000 * 30, 30);

    // Recent activity contribution (max 20 points)
    const lastUpdate = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) score += 20;
    else if (daysSinceUpdate < 90) score += 10;
    else if (daysSinceUpdate < 180) score += 5;

    return Math.min(score, 100);
  }
}

const cacheSeeder = new CacheSeeder();
```

### Cache Validation Logic

**Validation Strategy**: Periodically re-verify cached libraries for accuracy

```javascript
// lib/cache-validator.mjs

class CacheValidator {
  constructor() {
    this.validationInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.staleThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  async validateCache(cachePath) {
    const cache = YAML.parse(await fs.readFile(cachePath, 'utf8'));
    const now = Date.now();

    console.log('Validating cached data...');

    const validationResults = {
      valid_count: 0,
      stale_count: 0,
      invalid_count: 0,
      libraries: []
    };

    for (const [category, libraries] of Object.entries(cache.categories)) {
      for (const library of libraries) {
        const lastVerified = new Date(library.last_verified).getTime();
        const age = now - lastVerified;

        if (age > this.staleThreshold) {
          validationResults.stale_count++;
          validationResults.libraries.push({
            name: library.name,
            category,
            status: 'stale',
            age_days: Math.floor(age / (24 * 60 * 60 * 1000))
          });
        } else {
          validationResults.valid_count++;
        }
      }
    }

    return validationResults;
  }

  async updateStaleLibraries(cachePath) {
    const cache = YAML.parse(await fs.readFile(cachePath, 'utf8'));
    const now = Date.now();

    for (const [category, libraries] of Object.entries(cache.categories)) {
      for (const library of libraries) {
        const lastVerified = new Date(library.last_verified).getTime();
        const age = now - lastVerified;

        if (age > this.validationInterval) {
          // Re-fetch library data
          const updatedLibrary = await this.fetchLibraryData(library.name);

          if (updatedLibrary) {
            Object.assign(library, updatedLibrary);
            library.last_verified = new Date().toISOString();
          }
        }
      }
    }

    // Write updated cache
    await fs.writeFile(cachePath, YAML.stringify(cache), 'utf8');
    console.log('✓ Cache updated with fresh data');
  }
}

const cacheValidator = new CacheValidator();
```

### Offline-First User Experience

**User Experience Flow**:

1. **Detection Phase**:
   - Check network connectivity on suggestion phase start
   - If offline detected: Switch to offline mode

2. **Offline Mode Notification**:
   ```markdown
   ⚠ Offline Mode Active
   ==========================
   External APIs are currently inaccessible.
   Using pre-seeded cache with top 10 libraries per category.
   Last cache update: 2026-02-12

   Available Categories:
   ✓ authentication (10 libraries)
   ✓ database (10 libraries)
   ✓ api (10 libraries)
   ✓ logging (10 libraries)
   ✓ testing (10 libraries)
   ✓ validation (10 libraries)
   ✓ utilities (10 libraries)
   ✓ security (10 libraries)
   ✓ caching (10 libraries)
   ✓ async (10 libraries)

   Limitations:
   - Suggestions based on cached data (may not be latest)
   - No real-time security validation
   - Limited to pre-seeded categories

   Options:
   1. Continue with offline suggestions (cached data)
   2. Force online mode (may fail if APIs unreachable)
   3. Provide manual input for specific libraries
   ```

3. **Offline Suggestion Flow**:
   ```javascript
   // In suggestion-exploration agent
   if (offlineMode) {
     const cache = await loadCache();
     const suggestions = matchByFeatureCategory(feature, cache);

     // Add offline mode tag
     suggestions.forEach(s => {
       s.tags = s.tags || [];
       s.tags.push('[OFFLINE_MODE]');
       s.data_source = 'cache';
       s.cache_age_days = calculateCacheAge(s.last_verified);
     });

     return suggestions;
   }
   ```

4. **Offline Mode Limitations Display**:
   - For each suggestion, display cache age
   - Show warning if cache data is >30 days old
   - Recommend re-run when online

### Initial Cache Seeding (H #5)

**Issue**: Pre-seeded cache strategy mentioned but no plan for initial population. Must define pre-seeded cache strategy with minimum dataset for common feature categories.

### Minimum Dataset for Pre-Seeded Cache

**Cache Structure** (Minimum required categories):
```yaml
# ${FEATURE_DIR}/exploration-cache.yaml (initial seed - minimum dataset)
cache_version: "1.0"
last_updated: "2026-02-12T00:00:00Z"
categories:
  # Category 1: Authentication (critical for most apps)
  authentication:
    - name: "passport"
      ecosystem: "npm"
      github_repo: "jaredhanson/passport"
      maintainability_score: 85
      security_score: 90
      rationale: "成熟した認証ミドルウェア"
      usage_example: "Local authentication, OAuth providers, JWT"
      last_verified: "2026-02-12"

  # Category 2: Database (essential for data persistence)
  database:
    - name: "prisma"
      ecosystem: "npm"
      github_repo: "prisma/prisma"
      maintainability_score: 92
      security_score: 88
      rationale: "モダンなORM、TypeScript対応"
      usage_example: "Type-safe database access, migrations"
      last_verified: "2026-02-12"
    - name: "typeorm"
      ecosystem: "npm"
      github_repo: "typeorm/typeorm"
      maintainability_score: 88
      security_score: 85
      rationale: "Active RecordパターンのORM"
      usage_example: "Entity-based database operations"
      last_verified: "2026-02-12"

  # Category 3: API (web servers and HTTP)
  api:
    - name: "express"
      ecosystem: "npm"
      github_repo: "expressjs/express"
      maintainability_score: 95
      security_score: 90
      rationale: "最も広く使用されているNode.js Webフレームワーク"
      usage_example: "REST API, middleware, routing"
      last_verified: "2026-02-12"
    - name: "fastify"
      ecosystem: "npm"
      github_repo: "fastify/fastify"
      maintainability_score: 90
      security_score: 92
      rationale: "高速なWebサーバー、スキーマ検証"
      usage_example: "High-performance REST API"
      last_verified: "2026-02-12"

  # Category 4: Logging (observability)
  logging:
    - name: "winston"
      ecosystem: "npm"
      github_repo: "winstonjs/winston"
      maintainability_score: 88
      security_score: 90
      rationale: "多目的なロギングライブラリ"
      usage_example: "File and console logging, transports"
      last_verified: "2026-02-12"
    - name: "pino"
      ecosystem: "npm"
      github_repo: "pinojs/pino"
      maintainability_score: 90
      security_score: 92
      rationale: "高速なJSONロギング"
      usage_example: "Production-grade structured logging"
      last_verified: "2026-02-12"

  # Category 5: Testing (quality assurance)
  testing:
    - name: "jest"
      ecosystem: "npm"
      github_repo: "jestjs/jest"
      maintainability_score: 92
      security_score: 95
      rationale: "JavaScript用の完全なテストソリューション"
      usage_example: "Unit tests, integration tests, mocking"
      last_verified: "2026-02-12"
    - name: "mocha"
      ecosystem: "npm"
      github_repo: "mochajs/mocha"
      maintainability_score: 88
      security_score: 90
      rationale: "柔軟なテストフレームワーク"
      usage_example: "TDD, BDD testing approaches"
      last_verified: "2026-02-12"

  # Category 6: Async/Utilities (code quality)
  async:
    - name: "async"
      ecosystem: "npm"
      github_repo: "caolan/async"
      maintainability_score: 90
      security_score: 95
      rationale: "非同期操作処理のための実用的ユーティリティ"
      usage_example: "Async control flow, collections"
      last_verified: "2026-02-12"
    - name: "rxjs"
      ecosystem: "npm"
      github_repo: "ReactiveX/rxjs"
      maintainability_score: 92
      security_score: 88
      rationale: "リアクティブプログラミングライブラリ"
      usage_example: "Event streams, observables"
      last_verified: "2026-02-12"
```

**Additional Optional Categories** (for expanded cache):
```yaml
# ${FEATURE_DIR}/exploration-cache.yaml (optional expansions)
  # Category 7: Validation (input validation)
  validation:
    - name: "joi"
      ecosystem: "npm"
      github_repo: "sideway/joi"
      maintainability_score: 88
      security_score: 90
      rationale: "オブジェクトスキーマ検証"
      usage_example: "Request body validation"
      last_verified: "2026-02-12"
    - name: "zod"
      ecosystem: "npm"
      github_repo: "colinhacks/zod"
      maintainability_score: 90
      security_score: 92
      rationale: "TypeScript優先のスキーマ検証"
      usage_example: "Type-safe validation"
      last_verified: "2026-02-12"

  # Category 8: Security (web security)
  security:
    - name: "helmet"
      ecosystem: "npm"
      github_repo: "helmetjs/helmet"
      maintainability_score: 92
      security_score: 95
      rationale: "HTTPヘッダーセキュリティ"
      usage_example: "Express security headers"
      last_verified: "2026-02-12"
    - name: "bcrypt"
      ecosystem: "npm"
      github_repo: "kelektiv/node.bcrypt.js"
      maintainability_score: 85
      security_score: 95
      rationale: "パスワードハッシュ化"
      usage_example: "Password hashing and comparison"
      last_verified: "2026-02-12"

  # Category 9: Utilities (helper functions)
  utilities:
    - name: "lodash"
      ecosystem: "npm"
      github_repo: "lodash/lodash"
      maintainability_score: 95
      security_score: 90
      rationale: "モジュラーなユーティリティライブラリ"
      usage_example: "Data manipulation, functional programming"
      last_verified: "2026-02-12"
    - name: "date-fns"
      ecosystem: "npm"
      github_repo: "date-fns/date-fns"
      maintainability_score: 92
      security_score: 88
      rationale: "日付操作ライブラリ"
      usage_example: "Date formatting, parsing, manipulation"
      last_verified: "2026-02-12"

  # Category 10: Caching (performance optimization)
  caching:
    - name: "redis"
      ecosystem: "npm"
      github_repo: "redis/node-redis"
      maintainability_score: 95
      security_score: 88
      rationale: "高速なインメモリデータストア"
      usage_example: "Session storage, caching"
      last_verified: "2026-02-12"
    - name: "node-cache"
      ecosystem: "npm"
      github_repo: "node-cache/node-cache"
      maintainability_score: 88
      security_score: 85
      rationale: "シンプルなメモリキャッシュ"
      usage_example: "In-memory caching, TTL support"
      last_verified: "2026-02-12"
```

**Seeding Strategy**:
```javascript
// lib/cache-seeder.mjs
export async function seedCache(featureDir) {
  const cachePath = join(featureDir, 'exploration-cache.yaml');
  if (existsSync(cachePath)) return; // Don't overwrite

  const initialCache = { /* ... data from above ... */ };
  writeFileSync(cachePath, yaml.dump(initialCache), 'utf-8');
}
```

**Cold Start Flow**:
1. First feature suggestion → Check cache → Not found
2. Seed initial cache with common categories
3. Match by feature keywords
4. Return suggestions from cache
5. Update cache after successful GLM4.7 exploration

### Implementation Checklist

- [ ] Create initial cache data with common categories
- [ ] Implement `lib/cache-seeder.mjs`
- [ ] Add keyword matching logic
- [ ] Test cold start scenarios
- [ ] Document cache strategy

## Offline Mode Definition (H #3)

### Offline Mode Activation Conditions

**Issue**: Entire exploration phase requires GitHub/OSV/npm/PyPI APIs. Restricted network environments must be supported.

**Detection Logic**:
```javascript
// lib/offline-detector.mjs
class OfflineDetector {
  constructor() {
    this.offlineMode = false;
    this.connectivityCache = {
      github: { lastCheck: 0, accessible: false },
      osv: { lastCheck: 0, accessible: false },
      npm: { lastCheck: 0, accessible: false },
      pypi: { lastCheck: 0, accessible: false }
    };
  }

  async checkConnectivity() {
    const results = {
      github: await this.checkEndpoint('https://api.github.com/rate_limit'),
      osv: await this.checkEndpoint('https://api.osv.dev/v1/query'),
      npm: await this.checkEndpoint('https://registry.npmjs.org/express'),
      pypi: await this.checkEndpoint('https://pypi.org/pypi/requests/json')
    };

    // Cache results
    Object.entries(results).forEach(([api, accessible]) => {
      this.connectivityCache[api] = {
        lastCheck: Date.now(),
        accessible
      };
    });

    // Determine if offline mode should be active
    const accessibleCount = Object.values(results).filter(r => r).length;
    this.offlineMode = accessibleCount === 0;

    return {
      offlineMode: this.offlineMode,
      results
    };
  }

  async checkEndpoint(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
```

### Offline Mode Behavior

**Tier 2 Fallback with Offline Mode**:
```markdown
# When offline mode is active
IF offlineDetector.offlineMode === true:
  → Display: "⚠ Offline mode activated. External APIs inaccessible."
  → Use pre-seeded cache as primary data source
  → GLM4.7 internal knowledge as secondary augmentation
  → Add [OFFLINE_MODE] tag to all suggestions
  → Include last cache update timestamp in output
  → User notification: "Suggestions based on cached data from [date]. Manual verification recommended."
```

### Offline Mode Limitations

**Known Limitations in Offline Mode**:
1. **Stale Data**: Cached suggestions may not reflect latest versions or CVEs
2. **No Real-time Validation**: Cannot verify library existence or current maintainability
3. **No CVE Updates**: Security scores based on cached CVE data only
4. **No Alternative Discovery**: Cannot discover new libraries or trending tools
5. **Limited Scope**: Only pre-seeded categories available (auth, database, API, async, testing, logging, etc.)

**Offline Mode Recommendations**:
- Display clear warnings to user
- Allow user to opt-out of offline mode (force online mode)
- Provide option to manually input library information
- Recommend re-run suggestion phase when connectivity restored

### Configuration

**`.poor-dev/config.json` additions**:
```json
{
  "offline_mode": {
    "enabled": false, // Set to true to force offline mode
    "auto_detect": true, // Automatically detect offline status
    "cache_duration": 2592000, // 30 days in seconds
    "allow_force_online": true // Allow user to force online mode despite detection
  }
}
```

### Implementation Checklist

- [ ] Implement `lib/offline-detector.mjs`
- [ ] Add offline mode detection to environment verification (Phase 2 Day 1)
- [ ] Update Tier 2 fallback to use offline mode
- [ ] Add offline mode warnings and notifications
- [ ] Test with network restrictions (simulated)
- [ ] Document offline mode limitations and recommendations

## Data Source Accessibility Verification

### Library Existence Validation (H #4)

**Issue**: GLM4.7 could suggest non-existent libraries (hallucination risk). Must validate library existence before scoring.

### Validation Strategy

**Before Scoring**: All suggested libraries must pass existence validation:

```javascript
// lib/library-validator.mjs
class LibraryValidator {
  constructor() {
    this.npmRegistryUrl = 'https://registry.npmjs.org';
    this.pypiRegistryUrl = 'https://pypi.org/pypi';
    this.githubApiUrl = 'https://api.github.com/repos';
  }

  async validateLibrary(suggestion) {
    const validationResults = {
      exists: false,
      npmExists: false,
      pypiExists: false,
      githubExists: false,
      errors: []
    };

    // Validate based on suggestion type/ecosystem
    if (suggestion.ecosystem === 'npm' || !suggestion.ecosystem) {
      validationResults.npmExists = await this.checkNpmRegistry(suggestion.name);
    }
    if (suggestion.ecosystem === 'pypi') {
      validationResults.pypiExists = await this.checkPyPIRegistry(suggestion.name);
    }

    // Validate GitHub repository if source URL provided
    if (suggestion.github_repo) {
      validationResults.githubExists = await this.checkGitHubRepo(suggestion.github_repo);
    }

    // Determine if library exists (at least one source must be valid)
    validationResults.exists = validationResults.npmExists ||
                                validationResults.pypiExists ||
                                validationResults.githubExists;

    // If library doesn't exist anywhere, mark as hallucination
    if (!validationResults.exists) {
      validationResults.errors.push('Library does not exist in npm, PyPI, or GitHub');
    }

    return validationResults;
  }

  async checkNpmRegistry(packageName) {
    try {
      const response = await fetch(`${this.npmRegistryUrl}/${packageName}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn(`NPM registry check failed for ${packageName}:`, error.message);
      return false;
    }
  }

  async checkPyPIRegistry(packageName) {
    try {
      const response = await fetch(`${this.pypiRegistryUrl}/${packageName}/json`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn(`PyPI registry check failed for ${packageName}:`, error.message);
      return false;
    }
  }

  async checkGitHubRepo(repoPath) {
    try {
      const response = await fetch(`${this.githubApiUrl}/${repoPath}`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn(`GitHub repo check failed for ${repoPath}:`, error.message);
      return false;
    }
  }

  filterHallucinations(suggestions) {
    const valid = [];
    const hallucinations = [];

    suggestions.forEach(suggestion => {
      if (suggestion.validationResult?.exists) {
        valid.push(suggestion);
      } else {
        hallucinations.push(suggestion);
      }
    });

    return { valid, hallucinations };
  }
}
```

### Validation Flow

```javascript
// In suggestion-exploration agent
async function processSuggestions(suggestions) {
  const validator = new LibraryValidator();

  // Step 1: Validate existence for all suggestions
  const validatedSuggestions = await Promise.all(
    suggestions.map(async (suggestion) => {
      const validationResult = await validator.validateLibrary(suggestion);
      return {
        ...suggestion,
        validationResult
      };
    })
  );

  // Step 2: Filter out hallucinations
  const { valid, hallucinations } = validator.filterHallucinations(validatedSuggestions);

  // Step 3: Log hallucinations for monitoring
  if (hallucinations.length > 0) {
    console.warn(`Filtered ${hallucinations.length} hallucinated libraries:`);
    hallucinations.forEach(h => {
      console.warn(`  - ${h.name} (${h.ecosystem})`);
    });
  }

  // Step 4: Only score valid libraries
  const scoredSuggestions = await Promise.all(
    valid.map(suggestion => scoreSuggestion(suggestion))
  );

  return scoredSuggestions;
}
```

### Hallucination Detection Tests

```javascript
describe('Library Existence Validation', () => {
  test('filters non-existent npm packages', async () => {
    const suggestions = [
      { name: 'express', ecosystem: 'npm' }, // Exists
      { name: 'nonexistent-package-xyz-123', ecosystem: 'npm' }, // Does not exist
    ];

    const validator = new LibraryValidator();
    const results = await Promise.all(
      suggestions.map(s => validator.validateLibrary(s))
    );

    expect(results[0].exists).toBe(true);
    expect(results[1].exists).toBe(false);
  });

  test('validates GitHub repositories', async () => {
    const suggestions = [
      { github_repo: 'expressjs/express' }, // Exists
      { github_repo: 'nonexistent/repo-xyz-123' }, // Does not exist
    ];

    const validator = new LibraryValidator();
    const results = await Promise.all(
      suggestions.map(s => validator.validateLibrary(s))
    );

    expect(results[0].githubExists).toBe(true);
    expect(results[1].githubExists).toBe(false);
  });

  test('excludes hallucinated libraries from scoring', async () => {
    const suggestions = [
      { name: 'express', ecosystem: 'npm', github_repo: 'expressjs/express' },
      { name: 'hallucinated-lib', ecosystem: 'npm' },
    ];

    const validator = new LibraryValidator();
    const { valid, hallucinations } = await validator.filterHallucinations(suggestions);

    expect(valid).toHaveLength(1);
    expect(valid[0].name).toBe('express');
    expect(hallucinations).toHaveLength(1);
    expect(hallucinations[0].name).toBe('hallucinated-lib');
  });
});
```

### Implementation Checklist

- [ ] Implement `lib/library-validator.mjs`
- [ ] Add existence validation to suggestion processing flow
- [ ] Add validation tests for npm, PyPI, and GitHub
- [ ] Test with known hallucinated packages
- [ ] Log hallucinations for monitoring
- [ ] Add validation results to suggestion metadata

### GitHub API Verification

```javascript
async function verifyGitHubAPI() {
  try {
    const response = await fetch('https://api.github.com/rate_limit');
    const data = await response.json();
    console.log(`GitHub API available. Remaining: ${data.resources.core.remaining}`);
    return {
      accessible: true,
      remaining: data.resources.core.remaining,
      mode: process.env.GITHUB_TOKEN ? 'authenticated' : 'unauthenticated'
    };
  } catch (error) {
    return { accessible: false, error: error.message };
  }
}
```

### Verification Results Handling

- **Accessible & >1000 remaining**: Proceed normally
- **Accessible but <1000 remaining**: Log warning, use cache heavily
- **Inaccessible**: Mark data unavailable, use defaults (score: 50)

### Implementation Checklist

- [ ] Implement verification functions for all APIs
- [ ] Add verification to Phase 2 setup
- [ ] Test with simulated outages
- [ ] Document fallback behavior

## Timeout Configuration (H #3)

### Feature-Based Timeout Strategy

**Issue**: Global 5-minute timeout not suitable for all feature types.

**Configuration**:
```json
{
  "timeout": {
    "default": 300, // 5 minutes default
    "by_feature_type": {
      "simple": 180,   // 3 minutes (1-3 entities)
      "medium": 300,   // 5 minutes (4-7 entities)
      "complex": 420   // 7 minutes (8+ entities)
    },
    "per_feature_override": {
      "008": 300,
      "009": 420
    }
  }
}
```

**Timeout Detection**:
```javascript
function getTimeoutForFeature(feature) {
  const entityCount = feature.entities.length;
  let type = 'default';

  if (entityCount <= 3) type = 'simple';
  else if (entityCount <= 7) type = 'medium';
  else type = 'complex';

  const config = readConfig();
  return config.timeout.per_feature_override[feature.id] ||
         config.timeout.by_feature_type[type] ||
         config.timeout.default;
}
```

### Implementation Checklist

- [ ] Implement feature-based timeout logic
- [ ] Add timeout configuration to `.poor-dev/config.json`
- [ ] Test timeout scenarios for each feature type
- [ ] Document timeout behavior

**Phase 1: Design & Contracts**

Prerequisites: research.md complete.

1. Extract entities from spec → `data-model.md` (fields, relationships, validation, state transitions).
2. Generate API contracts from functional requirements → `/contracts/` (OpenAPI/GraphQL).

**Output**: data-model.md, /contracts/*, quickstart.md

## File Naming

- **Complete plan**: `plan.md`
- **Phase 0 only**: `research.md`
- **Phase 1 only**: `data-model.md`, `contracts/`, `quickstart.md`

## Key Rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- Phase 1 requires research.md; skip with warning if missing
