---
description: "Agent Teams orchestrator for all development flows"
---

# poor-dev.team — Agent Teams Orchestrator

Orchestrate development workflows using Claude Code Agent Teams.

## Phase 0: Discussion

Before creating any teams:
1. Classify the user's request into a flow type (feature, bugfix, investigation, roadmap, discovery)
2. Discuss scope and requirements with the user
3. Create `discussion-summary.md` in the feature directory
4. No teammates are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `npx poor-dev-next --flow <FLOW> --state-dir <DIR> --project-dir .`
2. Parse the JSON output and execute the action:
   - `create_team` → TeamCreate + Task(spawn teammates) + monitor + TeamDelete
   - `create_review_team` → Opus-mediated review loop (see §Review Loop below)
   - `user_gate` → Ask user the question, then `--gate-response`
   - `done` → Report completion to user
3. After action completes: `npx poor-dev-next --step-complete <step>`
4. Return to step 1

## Review Loop (Opus-Mediated)

For `create_review_team` actions:
1. TeamCreate with reviewers + fixer
2. Assign review task to reviewer(s)
3. Reviewer sends ISSUE:/VERDICT: output via SendMessage
4. Parse with review-aggregate logic:
   - No VERDICT line → ask reviewer to retry (max 2)
   - C=0, H=0 → step complete → TeamDelete
   - C>0 or H>0 → summarize issues → send to fixer
5. Fixer reports fixed/rejected YAML → Opus updates review-log
6. Loop back to step 2 (max iterations from config)
7. Exceeded max → user_gate → TeamDelete

## Error Handling

- Teammate no response 5min → SendMessage ping → 2min grace → respawn (max 3)
- All teammates fail simultaneously → rate limit suspected → 120s wait → retry (max 3)
- Review loop > max_iterations → user confirmation required
- Fixer output validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `npx poor-dev-next` to resume

## Team Naming

Format: `pd-<step>-<NNN>` where NNN is from the feature directory name.

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Teammates NEVER execute git commands.
