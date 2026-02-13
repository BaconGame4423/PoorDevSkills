# Implementation Tasks: Best Practice and Tool Suggestion Phase

**Feature**: Best Practice and Tool Suggestion Phase
**Branch**: `008-add-bestpractice-suggest-phase`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Target**: WSL 2 Ubuntu MVP (native Windows support deferred to post-MVP)
**Generated**: 2026-02-12

## Overview

This document breaks down the implementation of the suggestion phase feature into specific, executable tasks organized by user story. Each task includes clear file paths and follows a checklist format for execution tracking.

**Total Tasks**: 145
**Est. Effort**: 14 days (Feb 17 - Mar 2, 2026)

## Task Generation Rules

Every task follows this format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **Checkbox**: `- [ ]` (markdown checkbox)
- **Task ID**: Sequential (T001, T002, T003...)
- **[P] marker**: Only if parallelizable (different files, no dependencies)
- **[Story] label**: Required for user story phases only (US1, US2, US3, US4)

---

## Phase 1: Setup

**Goal**: Initialize project structure and verify all dependencies for implementation

**Independent Test**: Run dependency verification script and confirm all critical dependencies pass

### Phase 1 Tasks

- [X] T001 Create commands directory structure for suggestion command in commands/poor-dev.suggest.md
- [X] T002 Create agents/opencode directory for GLM4.7 exploration agent
- [X] T003 Create lib/ directory for suggestion utilities (parser, validator, cache)
- [X] T004 Create .poor-dev directory structure for configuration and caching
- [X] T005 Verify jq installation on development environment (run `jq --version` and verify output)
- [X] T006 Verify GLM4.7 model access and availability (run `gh model list` and verify zai-coding-plan/glm-4.7 is available)
- [X] T007 Test GitHub API connectivity (https://api.github.com/rate_limit) (success: API returns 200 OK)
- [X] T008 Test OSV API connectivity (https://api.osv.dev/v1/query) (success: API returns 200 OK)
- [X] T009 Test npm registry connectivity (https://registry.npmjs.org/express) (success: API returns 200 OK)
- [X] T010 Check GITHUB_TOKEN environment variable for increased rate limit
- [X] T011 Create dependency verification script in scripts/verify-dependencies.sh (check jq version, GLM4.7 access, API connectivity, GITHUB_TOKEN, exit with status 0 on success)
- [X] T101 Implement cache path detection in lib/cache-initializer.mjs (.poor-dev/cache/exploration-cache.yaml)
- [X] T102 Implement pre-seeded data structure in lib/cache-initializer.mjs (categories: authentication, database, api, logging, testing)
- [X] T103 Implement cache initialization in lib/cache-initializer.mjs (create cache if not exists)
- [X] T054 Test WebFetch tool availability in GLM4.7 sub-agent mode (verify WebFetch is accessible when dispatching GLM4.7 tasks)

---

## Phase 2: Foundational

**Goal**: Build core infrastructure blocks required by all user stories

**Independent Test**: Execute all foundational utilities with test data and verify correct output

### Phase 2 Tasks

- [X] T012 [P] Create suggestion parser utility in lib/suggestion-parser.mjs with YAML parsing and validation
- [X] T013 [P] Create suggestion validator utility in lib/suggestion-validator.mjs with maintainability/security scoring
- [X] T014 [P] Create backup manager utility in lib/backup-manager.mjs with automatic backup on write
- [X] T015 Create cache initializer utility in lib/cache-initializer.mjs with pre-seeded data
- [X] T016 Create cache validator utility in lib/cache-validator.mjs with monthly validation
- [X] T017 Define maintainability scoring algorithm in lib/suggestion-validator.mjs (commit recency, issue resolution, contributor activity, documentation quality)
- [X] T018 Define security scoring algorithm in lib/suggestion-validator.mjs (CVEs, audit status, dependency health, code quality)
- [X] T019 Implement threshold filtering logic in lib/suggestion-validator.mjs (maintainability >= 50 AND security >= 50)
- [X] T020 Implement warning marker logic in lib/suggestion-validator.mjs ([RISK] for mixed signals, [CAUTION] for borderline scores)
- [X] T021 Implement backup creation function in lib/backup-manager.mjs with timestamp-based backup files
- [X] T022 Implement backup recovery function in lib/backup-manager.mjs with rollback capability
- [X] T023 Implement cache pre-seeding in lib/cache-initializer.mjs (authentication, database, api, logging, testing categories)
- [X] T024 Implement cache validation in lib/cache-validator.mjs (GitHub API, OSV API checks for last commit and CVEs)
- [X] T025 Implement YAML schema validation in lib/suggestion-parser.mjs for ExplorationSession, Suggestion, SuggestionDecision entities
- [X] T026 Create exploration session state manager in lib/suggestion-parser.mjs with state transition validation
- [X] T027 Create suggestion decision recorder in lib/suggestion-parser.mjs with traceability

---

## Phase 3: User Story 1 - Development Team Gets Best Practice Suggestions (P1)

**Goal**: Provide developers with actionable, vetted best practice recommendations

**Independent Test**: Run suggestion phase for a simple feature (e.g., adding user authentication) and verify at least one suggestion is generated with maintainability and security scores

**Success Criteria**:
- At least one suggestion generated
- Each suggestion has type, description, rationale, maintainability_score, security_score
- Suggestions filtered by threshold (>= 50 for both scores)

### Phase 3 Tasks

- [X] T028 [US1] Create suggestion phase command file in commands/poor-dev.suggest.md with command interface (success: command accessible via poor-dev suggest)
- [X] T029 [US1] Implement config resolution logic in commands/poor-dev.suggest.md (overrides.suggest → overrides.default → built-in) (success: config loaded correctly from priority order)
- [X] T030 [US1] Implement spec.md reading and validation in commands/poor-dev.suggest.md (success: spec.md parsed without errors)
- [X] T031 [US1] Implement exploration session initialization in commands/poor-dev.suggest.md with UUID generation (success: exploration-session.yaml created with valid UUID)
- [X] T032 [US1] Implement progress marker system in commands/poor-dev.suggest.md with format [PROGRESS: step-name] (success: progress markers display during execution)
- [X] T033 [US1] Implement error marker system in commands/poor-dev.suggest.md ([ERROR: description]) (success: error messages display on failure)
- [X] T034 [US1] Implement suggestion display formatting in commands/poor-dev.suggest.md with score visualization (maintainability_score, security_score as colored badges or progress bars) (success: suggestions displayed with colored score indicators)
- [X] T035 [US1] Implement suggestion comparison view in commands/poor-dev.suggest.md with rationale display (show all suggestions side-by-side for comparison) (success: comparison view shows all suggestions)
- [X] T036 [US1] Create exploration-session.yaml output template in commands/poor-dev.suggest.md (success: template includes required fields)
- [X] T037 [US1] Create suggestions.yaml output template in commands/poor-dev.suggest.md (success: template includes required fields)
- [X] T038 [US1] Create suggestion-decisions.yaml output template in commands/poor-dev.suggest.md (success: template includes required fields)
- [X] T039 [US1] Implement file write operation in commands/poor-dev.suggest.md with automatic backup (success: backup created before write)

---

## Phase 4: User Story 2 - GLM4.7 Conducts Exploration (P1)

**Goal**: GLM4.7 automatically conducts research and evaluation of relevant best practices, tools, and libraries

**Independent Test**: Trigger suggestion phase and verify exploration completes automatically without manual intervention within 5 minutes

**Success Criteria**:
- Exploration completes within 5 minutes
- Status updates provided during exploration ([PROGRESS] markers)
- Structured output produced (YAML format)

### Phase 4 Tasks

- [X] T040 [US2] Create GLM4.7 exploration agent definition in agents/opencode/suggestion-exploration.md with subagent mode
- [X] T041 [US2] Define exploration prompt template in agents/opencode/suggestion-exploration.md with NON_INTERACTIVE_HEADER
- [X] T042 [US2] Define research process in agents/opencode/suggestion-exploration.md (WebFetch for docs, GitHub repos, community sources)
- [X] T043 [US2] Define output format specification in agents/opencode/suggestion-exploration.md (YAML structure)
- [X] T044 [US2] Define maintainability scoring guidance in agents/opencode/suggestion-exploration.md (0-100 scale, band descriptions)
- [X] T045 [US2] Define security scoring guidance in agents/opencode/suggestion-exploration.md (0-100 scale, band descriptions)
- [X] T046 [US2] Define threshold filtering rules in agents/opencode/suggestion-exploration.md (exclude < 50)
- [X] T047 [US2] Set 5-minute timeout constraint in agents/opencode/suggestion-exploration.md
- [X] T048 [US2] Implement GLM4.7 Task dispatch in commands/poor-dev.suggest.md with model parameter (zai-coding-plan/glm-4.7, use Bash tool with gh CLI)
- [X] T049 [US2] Implement cross-CLI dispatch fallback in commands/poor-dev.suggest.md for non-opencode targets
- [X] T050 [US2] Implement adaptive polling mechanism in commands/poor-dev.suggest.md with idle timeout and max timeout
- [X] T051 [US2] Implement polling interval configuration in commands/poor-dev.suggest.md (config.polling.interval: 30s default, idle_timeout: 300s, max_timeout: 900s)
- [X] T052 [US2] Implement exploration status tracking in commands/poor-dev.suggest.md (pending → in_progress → completed/failed)
- [X] T053 [US2] Implement timeout handling in commands/poor-dev.suggest.md with graceful degradation

---

## Phase 5: User Story 3 - Maintainability and Security Validation (P1)

**Goal**: Validate all suggested tools/libraries for maintainability and security to ensure only safe recommendations

**Independent Test**: Request suggestions for a feature requiring a popular library and verify all suggestions include explicit maintainability and security assessments

**Success Criteria**:
- Maintainability score calculated (0-100)
- Security score calculated (0-100)
- Libraries with scores < 50 excluded
- Libraries with critical CVEs excluded

### Phase 5 Tasks

- [X] T055 [US3] Implement maintainability scoring in lib/suggestion-validator.mjs with GitHub REST API integration (GET /repos/{owner}/{repo}/stats/commit_activity)
- [X] T056 [US3] Implement commit recency scoring in lib/suggestion-validator.mjs (last commit date check)
- [X] T057 [US3] Implement issue resolution rate scoring in lib/suggestion-validator.mjs (resolved/total issues)
- [X] T058 [US3] Implement contributor activity scoring in lib/suggestion-validator.mjs (active contributors in 6 months)
- [X] T059 [US3] Implement documentation quality scoring in lib/suggestion-validator.mjs (README, docs, examples)
- [X] T060 [US3] Implement security scoring in lib/suggestion-validator.mjs with OSV REST API integration (POST /v1/query for CVE lookup)
- [X] T061 [US3] Implement known vulnerabilities check in lib/suggestion-validator.mjs (CVE lookup via OSV API)
- [X] T062 [US3] Implement security audit status scoring in lib/suggestion-validator.mjs (audit recency check)
- [X] T063 [US3] Implement dependency health scoring in lib/suggestion-validator.mjs (outdated dependencies)
- [X] T064 [US3] Implement code quality indicators scoring in lib/suggestion-validator.mjs (test coverage, linter)
- [X] T065 [US3] Apply inclusion threshold filtering in commands/poor-dev.suggest.md (maintainability >= 50 AND security >= 50)
- [X] T066 [US3] Apply exclusion rules in commands/poor-dev.suggest.md (critical CVEs, scores < 50)
- [X] T067 [US3] Apply warning markers in commands/poor-dev.suggest.md ([RISK] for mixed signals, [CAUTION] for borderline)
- [X] T068 [US3] Implement API rate limiting strategy in lib/suggestion-validator.mjs (queuing, exponential backoff, circuit breaker)
- [X] T069 [US3] Implement GITHUB_TOKEN support in lib/suggestion-validator.mjs for increased rate limit
- [X] T070 [US3] Implement validation caching in lib/suggestion-validator.mjs (24-hour cache TTL)

---

## Phase 6: User Story 4 - Developers Review and Select Suggestions (P2)

**Goal**: Developers can review suggestions with clear context and make informed decisions on adoption

**Independent Test**: Review completed suggestion phase output and verify each suggestion includes sufficient context for decision-making

**Success Criteria**:
- Each suggestion shows: type, description, rationale, scores, adoption_examples
- Developers can accept/reject individual suggestions
- Decisions recorded for traceability

### Phase 6 Tasks

- [X] T071 [US4] Implement suggestion review interface in commands/poor-dev.suggest.md with structured display
- [X] T072 [US4] Implement suggestion detail view in commands/poor-dev.suggest.md with full context
- [X] T073 [US4] Implement accept/reject prompt in commands/poor-dev.suggest.md with QuestionTools bypass
- [X] T074 [US4] Implement decision collection in commands/poor-dev.suggest.md with [NEEDS CLARIFICATION] markers for orchestrator
- [X] T075 [US4] Implement suggestion decision recording in commands/poor-dev.suggest.md (suggestion-decisions.yaml)
- [X] T076 [US4] Implement decision summary generation in commands/poor-dev.suggest.md (accepted, rejected, pending counts)
- [X] T077 [US4] Implement manual suggestion addition option in commands/poor-dev.suggest.md
- [X] T078 [US4] Implement rejection with reason tracking in commands/poor-dev.suggest.md

---

## Phase 7: Fallback & Error Handling

**Goal**: Gracefully handle failures with multi-tier fallback system (FR-010)

**Independent Test**: Simulate GLM4.7 exploration failure and verify fallback mechanisms activate correctly

**Success Criteria**:
- Tier 1: Cache-based fallback activates when GLM4.7 fails
- Tier 2: Manual research fallback activates when cache unavailable
- Tier 3: Continue without suggestions when manual declined

### Phase 7 Tasks

- [X] T079 Implement Tier 1 cache fallback in commands/poor-dev.suggest.md (check exploration-cache.yaml)
- [X] T080 Implement cache relevance matching in commands/poor-dev.suggest.md (keyword matching on feature description)
- [X] T081 Implement Tier 2 manual fallback in commands/poor-dev.suggest.md (user prompt for manual input)
- [X] T082 Implement Tier 3 continue fallback in commands/poor-dev.suggest.md (empty suggestions.yaml)
- [X] T083 Implement failure logging in commands/poor-dev.suggest.md (exploration-failures.log)
- [X] T084 Implement corruption detection in lib/backup-manager.mjs (schema validation on write)
- [X] T085 Implement suggestion-decisions corruption recovery in lib/backup-manager.mjs (re-display suggestions)
- [X] T086 Implement state inconsistency recovery in lib/backup-manager.mjs (reconstruct session from suggestions.yaml)

---

## Phase 8: Pipeline Integration

**Goal**: Integrate suggestion phase into existing pipeline (specify → suggest → plan)

**Independent Test**: Run full pipeline from specify to plan and verify suggestion phase executes correctly between specify and plan

**Success Criteria**:
- Suggest phase executes after specify completes
- Suggest phase artifacts generated in feature directory
- Plan phase can access suggestion artifacts

### Phase 8 Tasks

- [X] T087 Update commands/poor-dev.md to add suggest step to pipeline after specify
- [X] T088 Update commands/poor-dev.md to verify suggestion artifacts exist before plan phase
- [X] T089 Update commands/poor-dev.specify.md to indicate suggestion phase is next step
- [X] T090 Update .poor-dev/config.json to add overrides.suggest.model configuration
- [X] T091 Update .poor-dev/config.json to add polling configuration (interval, idle_timeout, max_timeout)
- [X] T092 Test full pipeline execution (specify → suggest → plan) with integration test

---

## Phase 9: Backup & Recovery

**Goal**: Implement robust backup and recovery for critical state files

**Independent Test**: Corrupt exploration-session.yaml and verify recovery from backup succeeds

**Success Criteria**:
- Automatic backup created on file write
- Backup directory structure created
- Recovery from backup succeeds
- Backup retention policy enforced (5 backups, 7 days)

### Phase 9 Tasks

- [X] T093 Implement backup directory creation in lib/backup-manager.mjs (${FEATURE_DIR}/.backups/)
- [X] T094 Implement backup file naming in lib/backup-manager.mjs (timestamp-based)
- [X] T095 Implement backup on write in lib/backup-manager.mjs (call before file write)
- [X] T096 Implement backup listing in lib/backup-manager.mjs (list last 5 backups)
- [X] T097 Implement recovery function in lib/backup-manager.mjs (restore from latest backup)
- [X] T098 Implement backup retention policy in lib/backup-manager.mjs (delete backups older than 7 days)
- [X] T099 Implement backup archiving in lib/backup-manager.mjs (archive to .completed-backups/ on pipeline completion)
- [X] T100 Implement emergency recovery command in commands/poor-dev.suggest.md (poor-dev recover-suggestions)

---

## Phase 10: Cache Management

**Goal**: Implement cache initialization and validation for cold start scenarios

**Independent Test**: Run suggestion phase on fresh environment and verify pre-seeded cache initializes correctly

**Success Criteria**:
- Pre-seeded cache initializes on first run
- Cache contains high-confidence libraries for common categories
- Monthly validation updates cache with stale library detection

### Phase 10 Tasks

- [X] T104 Implement cache last_updated tracking in lib/cache-initializer.mjs
- [X] T105 Implement cache freshness check in lib/cache-validator.mjs (check if cache is >= 1 month old)
- [X] T106 Implement cache validation in lib/cache-validator.mjs (validate all libraries via GitHub/OSV APIs)
- [X] T107 Implement stale library tagging in lib/cache-validator.mjs ([STALE] tag with warning)
- [X] T108 Implement cache update in lib/cache-validator.mjs (write updated libraries with validation_status)
- [X] T109 Implement cache versioning in lib/cache-validator.mjs (increment cache_version on update)
- [X] T110 Implement cache rollback in lib/cache-validator.mjs (backup before update, rollback on corruption)
- [X] T111 Implement manual cache refresh command in commands/poor-dev.suggest.md (poor-dev refresh-suggestion-cache)

---

## Phase 11: Windows Support (WSL Only)

**Goal**: Ensure suggestion phase works correctly on WSL 2 Ubuntu

**Independent Test**: Run full suggestion phase on WSL 2 Ubuntu and verify all functionality works

**Success Criteria**:
- Dependencies verified (jq, GLM4.7, APIs)
- Suggestion phase completes successfully
- All artifacts generated correctly

### Phase 11 Tasks

- [X] T112 Verify jq installation on WSL 2 Ubuntu (sudo apt-get install jq) (success: jq --version returns version number)
- [X] T113 Test GLM4.7 dispatch on WSL 2 Ubuntu (success: GLM4.7 task completes successfully)
- [X] T114 Test API connectivity on WSL 2 Ubuntu (GitHub, OSV, npm) (success: all APIs return 200 OK)
- [X] T115 Test full suggestion phase execution on WSL 2 Ubuntu (success: suggestions.yaml generated without errors)

---

## Phase 12: Testing & Validation

**Goal**: Comprehensive testing of all functionality before production use

**Independent Test**: Execute all test suites and verify all tests pass

### Phase 12 Tasks

- [X] T116 Create dependency verification test in tests/dependency-verification.test.mjs
- [X] T117 Create suggestion parser test in tests/suggestion-parser.test.mjs
- [X] T118 Create suggestion validator test in tests/suggestion-validator.test.mjs
- [X] T119 Create maintainability scoring test in tests/maintainability-scoring.test.mjs
- [X] T120 Create security scoring test in tests/security-scoring.test.mjs
- [X] T121 Create threshold filtering test in tests/threshold-filtering.test.mjs
- [X] T122 Create backup manager test in tests/backup-manager.test.mjs
- [X] T123 Create cache initializer test in tests/cache-initializer.test.mjs
- [X] T124 Create cache validator test in tests/cache-validator.test.mjs
- [X] T125 Create GLM4.7 exploration test in tests/glm47-exploration.test.mjs
- [X] T126 Create suggestion phase integration test in tests/suggestion-phase-integration.test.mjs
- [X] T127 Create API integration test in tests/api-integration.test.mjs (GitHub, OSV, npm)
- [X] T128 Create fallback mechanism test in tests/fallback.test.mjs
- [X] T129 Create corruption recovery test in tests/corruption-recovery.test.mjs
- [X] T130 Execute all test suites and verify pass rate >= 90%
- [X] T131 Fix any failing tests

---

## Phase 13: Polish & Cross-Cutting Concerns

**Goal**: Documentation, logging, error messages, and final polish

**Independent Test**: Run suggestion phase and verify all progress markers, error messages, and documentation are clear and helpful

### Phase 13 Tasks

- [X] T132 Add inline comments to complex code sections only (guidelines: document business logic, API integrations, scoring algorithms - NOT required per CLAUDE.md)
- [X] T133 Create quickstart guide in specs/008-add-bestpractice-suggest-phase/quickstart.md
- [X] T134 Document backup/recovery procedures in quickstart.md
- [X] T135 Document cache refresh procedures in quickstart.md
- [X] T136 Document escalation paths for failures in quickstart.md
- [X] T137 Document WSL 2 Ubuntu setup in quickstart.md
- [X] T138 Add structured logging to suggestion phase command in commands/poor-dev.suggest.md with duration tracking
- [X] T139 Improve error messages for common failure scenarios in commands/poor-dev.suggest.md
- [X] T140 Add completion summary to suggestion phase command in commands/poor-dev.suggest.md
- [X] T141 Review all progress markers for clarity and consistency
- [X] T142 Review all error markers for clarity and actionability
- [X] T143 Perform final code review and cleanup
- [X] T144 Create basic deploy documentation in specs/008-add-bestpractice-suggest-phase/deploy.md (manual deployment steps, feature branch deployment, testing verification)
- [X] T145 Verify all files follow existing code style conventions

---

## Dependencies

### User Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 4 (US2: GLM4.7 Exploration) → Phase 5 (US3: Validation) → Phase 3 (US1: Suggestions) → Phase 6 (US4: Review)
```

**Dependencies**:
- **Phase 1 (Setup)** → Depends on: None (initial setup)
- **US2 (GLM4.7 Exploration)** → Depends on: Phase 1 Setup, Phase 2 Foundational
- **US3 (Validation)** → Depends on: Phase 2 Foundational, Phase 4 (US2)
- **US1 (Suggestions)** → Depends on: Phase 2 Foundational, Phase 5 (US3)
- **US4 (Review)** → Depends on: Phase 3 (US1)
- **Phase 7 (Fallback)** → Depends on: Phase 4 (US2)
- **Phase 8 (Pipeline Integration)** → Depends on: Phase 3 (US1), Phase 6 (US4)
- **Phase 9 (Backup & Recovery)** → Depends on: Phase 2 Foundational
- **Phase 10 (Cache Management)** → Depends on: Phase 2 Foundational
- **Phase 11 (Windows Support)** → Depends on: Phase 12 (Testing)
- **Phase 12 (Testing)** → Depends on: All implementation phases
- **Phase 13 (Polish)** → Depends on: Phase 12 (Testing)

### Critical Path

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 4 (US2: Exploration) → Phase 5 (US3: Validation) → Phase 3 (US1: Suggestions) → Phase 6 (US4: Review) → Phase 12 (Testing)
```

### Parallel Execution Opportunities

**Phase 12 - Testing** (Parallelizable):
- T116-T131: Test suites can be implemented in parallel

## Implementation Strategy

### MVP Scope (Phase 1-7)

**Timeline**: Days 1-7 (Feb 17 - Feb 23, 2026)

**Features**:
- ✅ Basic suggestion flow (spec → suggest → plan)
- ✅ GLM4.7 exploration with 5-minute timeout
- ✅ Maintainability and security validation
- ✅ Threshold filtering (>= 50 for both scores)
- ✅ User review and decision collection
- ✅ 3-tier fallback (cache → manual → continue)
- ✅ Basic backup and recovery

**Deferrals to Post-MVP** (if schedule pressure):
- Test Suite 8: Persistent failure detection with monitoring
- Advanced caching: Tiered invalidation, cache warming
- Enhanced UX: Developer feedback, suggestion improvement
- Native Windows PowerShell support (deferred to Phase 3)
- CI/CD pipeline integration and automated testing
- Deployment verification procedures and infrastructure provisioning
- Performance monitoring infrastructure (SC-005 measurement tracked manually in MVP)

### Incremental Delivery

**Day 1-2 (Phase 1-2)**:
- Setup and foundational utilities complete
- Dependency verification passes

**Day 3-4 (Phase 4-5)**:
- GLM4.7 exploration working
- Validation logic complete
- Threshold filtering functional

**Day 5 (Phase 3)**:
- Suggestion phase command complete
- Suggestions generated and displayed

**Day 6 (Phase 6-7)**:
- User review interface complete
- Fallback mechanisms functional

**Day 7 (Phase 8-9)**:
- Pipeline integration complete
- Backup and recovery functional

**Day 8-10 (Phase 10-11)**:
- Cache management complete
- WSL 2 Ubuntu support verified

**Day 11-12 (Phase 12)**:
- All test suites created and passing
- Bug fixes and validation

**Day 13-14 (Phase 13)**:
- Polish and documentation complete
- Final validation and cleanup

## Success Validation

### Per-User Story Independent Test Criteria

| User Story | Independent Test | Success Criteria |
|------------|------------------|------------------|
| US1 | Run suggestion phase for simple feature | At least 1 suggestion with scores |
| US2 | Trigger suggestion phase | Exploration completes within 5 minutes |
| US3 | Request suggestions for library category | All suggestions have maintainability and security assessments |
| US4 | Review completed suggestion output | Each suggestion has sufficient context for decision-making |

### MVP Acceptance Criteria

- [ ] All P1 user stories implemented (US1, US2, US3, US4 is P2 but in scope)
- [ ] Suggestion phase executes after specify in pipeline
- [ ] GLM4.7 exploration completes within 5 minutes for typical features
- [ ] All suggested tools/libraries have maintainability >= 50 AND security >= 50
- [ ] 3-tier fallback functional (cache → manual → continue)
- [ ] Backup and recovery functional for critical state files
- [ ] Pre-seeded cache initializes on cold start
- [ ] WSL 2 Ubuntu support verified
- [ ] All test suites passing (>= 90% pass rate)
- [ ] Documentation complete (quickstart.md, inline comments where necessary)

## Format Validation

**Task Format Check**:
- [ ] All tasks start with `- [ ]` (checkbox)
- [ ] All tasks have sequential Task ID (T001-T145)
- [ ] Parallelizable tasks have `[P]` marker
- [ ] User story phase tasks have `[USx]` label
- [ ] All tasks include specific file path
- [ ] All tasks have clear, actionable description

## Summary

**Total Tasks**: 145
**Tasks by Phase**:
- Phase 1 (Setup): 15 tasks
- Phase 2 (Foundational): 16 tasks
- Phase 3 (US1): 12 tasks
- Phase 4 (US2): 14 tasks
- Phase 5 (US3): 16 tasks
- Phase 6 (US4): 8 tasks
- Phase 7 (Fallback): 8 tasks
- Phase 8 (Pipeline Integration): 6 tasks
- Phase 9 (Backup & Recovery): 8 tasks
- Phase 10 (Cache Management): 8 tasks
- Phase 11 (Windows Support): 4 tasks
- Phase 12 (Testing): 16 tasks
- Phase 13 (Polish): 14 tasks

**Parallel Opportunities Identified**: 1 phase with parallelizable tasks
**Suggested MVP Scope**: Phase 1-7 (Days 1-7) + Phase 8-9 (Day 7)
**Independent Test Criteria**: Defined for each user story
**Go/No-Go Criteria**: scripts/verify-dependencies.sh exits with code 0 on Day 0

---

**Next Steps**:
1. Review tasks.md for completeness and accuracy
2. Adjust task count or split/merge if needed
3. Begin Phase 1 implementation
4. Verify Day 0 dependency checklist before Phase 2
5. Follow incremental delivery schedule above
