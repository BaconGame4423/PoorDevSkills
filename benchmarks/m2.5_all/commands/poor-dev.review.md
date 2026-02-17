---
description: Route review commands to appropriate orchestrators with sub-agent architecture
handoffs:
  - label: 修正実装
    agent: poor-dev.implement
    prompt: レビュー指摘事項を修正して実装を続けてください
  - label: 計画再調整
    agent: poor-dev.plan
    prompt: プランレビューのフィードバックに基づいて計画を修正してください
---

## User Input

```text
$ARGUMENTS
```

## Command Format

`/poor-dev.review <type> <target>`

## Architecture

Each review type uses an **orchestrator** that:
1. Spawns 4 persona sub-agents in parallel (read-only)
2. Aggregates results
3. Spawns a fixer sub-agent if issues found
4. Loops until 0 issues remain

Persona definitions: `.opencode/agents/` (OpenCode) / `.claude/agents/` (Claude Code)
Orchestrators: `.opencode/command/poor-dev.<type>review.md`

## Review Types

| Type | Command | Personas | Target |
|------|---------|----------|--------|
| `plan` | `/poor-dev.planreview` | PM, RISK, VAL, CRIT | plan.md |
| `tasks` | `/poor-dev.tasksreview` | TECHLEAD, SENIOR, DEVOPS, JUNIOR | tasks.md |
| `architecture` | `/poor-dev.architecturereview` | ARCH, SEC, PERF, SRE | plan.md / data-model.md |
| `quality` | `/poor-dev.qualityreview` | QA, TESTDESIGN, CODE, SEC + adversarial | implementation code |
| `phase` | `/poor-dev.phasereview` | QA, REGRESSION, DOCS, UX | phase artifacts |

## Individual Persona Commands

Each persona can also be invoked directly:

**Plan**: `/poor-dev.planreview-pm`, `-risk`, `-value`, `-critical`
**Tasks**: `/poor-dev.tasksreview-techlead`, `-senior`, `-devops`, `-junior`
**Architecture**: `/poor-dev.architecturereview-architect`, `-security`, `-performance`, `-sre`
**Quality**: `/poor-dev.qualityreview-qa`, `-testdesign`, `-code`, `-security`
**Phase**: `/poor-dev.phasereview-qa`, `-regression`, `-docs`, `-ux`

## Review Loop Flow

```
STEP 1: 4x Review sub-agents (parallel, READ-ONLY)
   ↓ wait for all to complete
STEP 2: Aggregate (orchestrator counts issues by C/H/M/L)
   ↓
STEP 3: Branch
   ├─ Issues > 0 → STEP 4
   └─ Issues = 0 → DONE + handoff
   ↓
STEP 4: 1x Fix sub-agent (sequential, WRITE)
   ↓ wait for completion
   → Back to STEP 1 (new sub-agents, fresh context)
```

**Safety**: Review sub-agents are read-only (no Write/Edit/Bash). Only the fixer agent has write access.

## Output Format (line-oriented)

Per-persona:
```
VERDICT: GO|CONDITIONAL|NO-GO
ISSUE: C | description | file_or_section
ISSUE: H | description | file_or_section
REC: recommendation
```

Aggregated:
```yaml
type: plan
target: plan.md
n: 3
i:
  H:
    - issue description (PERSONA)
  M:
    - issue description (PERSONA)
ps:
  PM: GO
  RISK: CONDITIONAL
  VAL: GO
  CRIT: GO
act: FIX
```

Final (0 issues):
```yaml
type: plan
target: plan.md
v: GO
n: 7
log:
  - {n: 1, issues: 6, fixed: "summary"}
  - {n: 7, issues: 0}
next: /poor-dev.tasks
```

## Quality Gates (quality review only)

Run before persona reviews:
1. Type check (`tsc --noEmit` / `mypy` / `cargo check` / `go vet`)
2. Linting (`eslint` / `ruff lint` / `cargo clippy` / `golangci-lint`)
3. Format check (`prettier --check` / `black --check` / `cargo fmt --check` / `gofmt`)
4. Tests (`npm test` / `pytest` / `cargo test` / `go test`)

## Adversarial Review (quality review only)

After persona reviews, run `swarm_adversarial_review`.
- APPROVED → no additional issues
- NEEDS_CHANGES → add to issue list
- HALLUCINATING → ignore
- 3-strike rule applies

## Constitution Compliance

- **Section III**: Adversarial review and 3-strike rule
- **Section VIII**: Quality gates before merge
- **Section IX**: Store learnings in Hivemind

## Usage Examples

```bash
/poor-dev.planreview specs/NNN-feature/plan.md
/poor-dev.tasksreview specs/NNN-feature/tasks.md
/poor-dev.architecturereview specs/NNN-feature/data-model.md
/poor-dev.qualityreview
/poor-dev.phasereview phase0
```
