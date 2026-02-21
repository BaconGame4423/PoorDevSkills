---
description: "Agent Teams orchestrator for all development flows"
---

# poor-dev.team — Agent Teams Orchestrator

Orchestrate development workflows using Claude Code Agent Teams.

## Phase 0: Discussion

Before creating any teams:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `npm run build` in the DevSkills source repo and re-run `poor-dev init`
1. Classify the user's request into a flow type (feature, bugfix, investigation, roadmap, discovery)
2. Discuss scope and requirements with the user
3. Create `discussion-summary.md` in the feature directory
4. No teammates are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --flow <FLOW> --state-dir <DIR> --project-dir .`
2. Parse the JSON output and execute the action:
   - `create_team` → TeamCreate + Task(spawn teammates) + monitor + TeamDelete
   - `create_review_team` → Opus-mediated review loop (see §Review Loop below)
   - `user_gate` → See §User Gates below
   - `done` → Report completion to user
3. After action completes: see §Conditional Steps below
4. Return to step 1

### Conditional Steps

When a step is in the flow's `conditionals` list (e.g., bugfix, rebuildcheck):
1. After teammate completes work, scan output for conditional markers:
   - `[SCALE: SMALL]` → key: `<step>:SCALE_SMALL`
   - `[SCALE: LARGE]` → key: `<step>:SCALE_LARGE`
   - `[RECLASSIFY: FEATURE]` → key: `<step>:RECLASSIFY_FEATURE`
   - `[VERDICT: REBUILD]` → key: `<step>:REBUILD`
   - `[VERDICT: CONTINUE]` → key: `<step>:CONTINUE`
2. If marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --set-conditional "<key>" --state-dir <DIR> --project-dir .`
3. If no marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`

### User Gates

When the TS helper returns `user_gate`:
1. Display the `message` to the user
2. Present `options` as choices
3. After user responds: `node .poor-dev/dist/bin/poor-dev-next.js --gate-response <response> --state-dir <DIR> --project-dir .`
4. Parse the returned action and continue the Core Loop

## Review Loop (Opus-Mediated, Parallel Reviewers)

For `create_review_team` with multiple reviewers:
1. TeamCreate with N reviewers + 1 fixer
2. Assign review task to ALL N reviewers simultaneously (parallel)
3. Wait for all N to respond (or timeout 5min each)
4. Aggregate results:
   a. Merge all ISSUE: lines into unified list
   b. Deduplicate: same file:line + same severity → keep first
   c. Combine VERDICT: take the WORST verdict (NO-GO > CONDITIONAL > GO)
   d. If any reviewer returned no VERDICT → retry that reviewer (max 2)
5. If C=0, H=0 across ALL reviewers → step complete → TeamDelete
6. If C>0 or H>0 → summarize deduplicated issues → send to fixer
7. Fixer reports fixed/rejected YAML → Opus reviews the diff:
   a. Read the modified files
   b. Verify: no new code duplication ≥10 lines introduced
   c. Verify: no debug statements (console.*, debugger) added
   d. If violations found: send back to fixer with specific rejection
   e. If clean: update review-log and commit
8. Loop back to step 2 (max iterations from config)
9. Exceeded max → user_gate → TeamDelete

## Error Handling

- Teammate no response 5min → SendMessage ping → 2min grace → respawn (max 3)
- All teammates fail simultaneously → rate limit suspected → 120s wait → retry (max 3)
- Review loop > max_iterations → user confirmation required
- Fixer output validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `node .poor-dev/dist/bin/poor-dev-next.js` to resume

## Team Naming

Format: `pd-<step>-<NNN>` where NNN is from the feature directory name.

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Teammates NEVER execute git commands.

### When to Commit
- After `create_team` for `implement` step completes: stage and commit all implementation changes
- After fixer reports modifications in a review loop: stage and commit the fixes
- After `create_team` for artifact-producing steps (specify, suggest, plan, tasks, testdesign): commit the generated artifact
- Commit message format: `type: 日本語タイトル` (per CLAUDE.md conventions)
