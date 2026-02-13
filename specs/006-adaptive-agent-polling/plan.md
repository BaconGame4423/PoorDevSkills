# Implementation Plan: Adaptive Sub-Agent Polling System

**Branch**: `006-adaptive-agent-polling` | **Date**: 2026-02-12 | **Spec**: [specs/006-adaptive-agent-polling/spec.md](specs/006-adaptive-agent-polling/spec.md)
**Input**: Feature specification from `/specs/006-adaptive-agent-polling/spec.md`

## Summary

Implement adaptive polling for sub-agent output streams to eliminate unnecessary wait time in the poor-dev pipeline. Instead of using a fixed 180-second timeout, poll sub-agent output every second and proceed immediately when completion markers are detected. Configurable maximum safety timeout (default 180s) prevents indefinite hangs.

## Technical Context

**Language/Version**: Node.js 18+ (ES modules, mjs)
**Primary Dependencies**: None (pure Bash/JavaScript)
**Storage**: `.poor-dev/config.json` for configuration
**Testing**: Manual testing with mock sub-agents; unit tests for polling logic
**Target Platform**: Linux/macOS (Bash-based CLI tool)
**Project Type**: Single project (CLI tool)
**Performance Goals**: 60% reduction in average wait time for fast-responding tasks; no increase in CPU usage
**Constraints**: Must maintain backward compatibility with existing sub-agent dispatch patterns; must not break existing review loops
**Scale/Scope**: Small focused optimization affecting all review orchestrator commands (planreview, tasksreview, architecturereview, qualityreview, phasereview)

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

### Compliance Verification

**I. AI優先開発**: ✅ Pass - This is an optimization to improve AI agent efficiency; uses existing AI models

**II. スキルベースアーキテクチャ**: ✅ Pass - Implementation fits within existing poor-dev command structure

**III. レビュー主導品質**: ✅ Pass - Will undergo full review pipeline; 3-strike rule applies

**IV. 重要パスのテストファースト**: ⚠️ CONDITIONAL - Core polling logic should have unit tests; integration tests for full workflow

**V. 段階的配信とMVP重視**: ✅ Pass - User story P1 (Output-Driven Pipeline Progression) is MVP; P2 (Safety Timeout) is fallback

**VI. スワーム調整**: ⚠️ CONDITIONAL - May need to update Swarm Mail for sub-agent output streaming

**VII. 可観測性とデバッグ性**: ✅ Pass - Structured logging required; must include request ID, agent name, timestamp

**VIII. 検証ゲート**: ✅ Pass - Must pass type check (if any), linting, tests before completion

**IX. メモリと知識管理**: ✅ Pass - Decisions will be stored in Hivemind; CASS used to research polling patterns

**X. セキュリティとプライバシー**: ✅ Pass - No secrets involved; standard input sanitization

**Overall Status**: ✅ GO (with conditions)

**Conditions**:
- Add unit tests for polling logic before Phase 1 completion
- Ensure Swarm Mail compatibility if streaming output across agents
- Verify no security regressions from faster sub-agent termination

## Project Structure

### Documentation (this feature)

```text
specs/006-adaptive-agent-polling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # /poor-dev.tasks output (NOT created by /poor-dev.plan)
```

### Source Code (repository root)

```text
# Single project structure (maintaining existing)
bin/
├── poor-dev.mjs         # Main CLI entry
commands/
├── poor-dev.planreview.md
├── poor-dev.tasksreview.md
├── poor-dev.architecturereview.md
├── poor-dev.qualityreview.md
├── poor-dev.phasereview.md
└── poor-dev.review.md   # Review orchestrator router
lib/
├── subagent-poller.mjs  # NEW: Polling utility module
├── completion-detector.mjs  # NEW: Completion marker detection
└── config-loader.mjs    # NEW: Config loader (if not exists)
agents/
├── opencode/
│   ├── tasksreview-techlead.md
│   └── ... (other personas)
└── claude/
    └── ... (other personas)
tests/
├── unit/
│   ├── subagent-poller.test.mjs
│   └── completion-detector.test.mjs
└── integration/
    └── review-loop.test.mjs
.poor-dev/
└── config.json          # Configuration for dispatch_timeout
```

**Structure Decision**: Single project structure - this is a CLI tool optimization, not a new application. New utility modules in `lib/` maintain separation of concerns and are reusable across all review orchestrators.

## Timeline Estimates

**Phase 0: Outline & Research** - 2-4 hours
- Dispatch mechanism analysis: 30-60 min
- Completion marker patterns: 30-60 min
- Config structure review: 15-30 min
- Polling techniques research: 30-60 min
- Swarm Mail compatibility: 30-60 min

**Phase 1: Design & Contracts** - 3-5 hours
- Data model design: 60-90 min
- Contract generation: 60-90 min
- Quickstart guide: 60-90 min

## Risk Mitigation & Rollback Plan

### Risk: Swarm Mail incompatibility
**Mitigation**: Research in Phase 0 will confirm streaming support. If incompatible, implement buffered output collection as fallback.
**Rollback**: Keep existing fixed timeout mechanism if streaming cannot be implemented safely.

### Risk: Sub-agent output fragmentation
**Mitigation**: Completion detector will handle multi-line markers with configurable timeout windows.
**Rollback**: Revert to fixed timeout if detection proves unreliable after testing.

### Risk: CPU increase from frequent polling
**Mitigation**: Polling interval configurable (default 1s). Monitor CPU during testing. Add rate limiting if needed.
**Rollback**: Increase polling interval or revert to fixed timeout if CPU impact exceeds threshold.

### Rollback Strategy
- Git branch isolation allows clean revert
- Old timeout code preserved during migration
- Feature flag via config.json can disable adaptive polling
- Full rollback: `git checkout <main>` + delete branch

### Failure Handling
- Sub-agent timeout failure: Log error, fail current review, continue to next persona
- Config parse error: Fall back to default 180s timeout, log warning
- Completion detection timeout: Log partial output, fail gracefully with timeout message
- Swarm Mail capture failure: Buffer in memory, log warning, proceed without streaming

## Complexity Tracking

> Fill ONLY if Constitution Check has violations to justify.

No violations requiring complexity tracking. All conditions are acceptable and do not justify increased complexity.

## Phase Details

**Phase 0: Outline & Research**

### Unknowns to Research
1. [NEEDS CLARIFICATION] What is the current sub-agent dispatch mechanism? Does it use `wait`, `sleep`, or async polling?
2. [NEEDS CLARIFICATION] How are sub-agents currently spawned? Bash background processes? Node.js `child_process`?
3. [NEEDS CLARIFICATION] What completion markers do sub-agents naturally emit? JSON closing braces? YAML document end markers?
4. [NEEDS CLARIFICATION] Is there existing config.json structure, or does it need to be created?
5. [NEEDS CLARIFICATION] How does Swarm Mail handle sub-agent output currently? Does it stream or collect at end?

### Research Tasks
1. **Dispatch Mechanism Analysis**: Research current review orchestrator dispatch code to understand timeout implementation
2. **Completion Marker Patterns**: Analyze existing sub-agent output to identify natural completion patterns
3. **Config Structure**: Review existing `.poor-dev/config.json` if it exists; design schema if not
4. **Polling Techniques**: Research Bash polling patterns (e.g., `while sleep 1; do...`) vs Node.js async polling
5. **Swarm Mail Compatibility**: Investigate how Swarm Mail captures sub-agent output; determine if streaming support exists

### Output: research.md

**Phase 1: Design & Contracts**

Prerequisites: research.md complete.

### Data Model (`data-model.md`)
Extract entities from spec → data model:
- PollingConfiguration (fields: interval, maxTimeout, completionMarkers)
- SubAgentOutputBuffer (fields: chunks[], timestamps[], currentLength)
- PollingState (fields: status, elapsedTime, completionDetected)
- CompletionMarker (fields: pattern, type, examples)

### Contracts (`/contracts/`)
Generate API contracts from functional requirements:
- `polling-interface.md` - Interface for polling utility
- `completion-detector-contract.md` - Completion detection rules
- `review-orchestrator-integration.md` - Integration contract for all review commands

### Quickstart Guide (`quickstart.md`)
- How to configure timeout in config.json
- How completion markers work (with examples)
- Testing with mock sub-agents
- Troubleshooting guide

**Output**: data-model.md, /contracts/*, quickstart.md
