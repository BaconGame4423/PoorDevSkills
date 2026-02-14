---
description: Pipeline orchestration sub-agent — dispatches steps from classification to completion.
---

## Pipeline Context (injected by caller)

```text
$ARGUMENTS
```

Parse JSON from `$ARGUMENTS`: `flow`, `feature_dir`, `branch`, `summary`, `interactive_mode`, `completed` (array), `arguments` (original user input).

## Step 1: Execute Pipeline Runner

Pipeline execution is handled by `lib/pipeline-runner.sh`. Parse the JSON arguments and invoke:

```bash
# Parse arguments
FLOW=$(echo '$ARGUMENTS' | jq -r '.flow')
FEATURE_DIR=$(echo '$ARGUMENTS' | jq -r '.feature_dir')
BRANCH=$(echo '$ARGUMENTS' | jq -r '.branch')
SUMMARY=$(echo '$ARGUMENTS' | jq -r '.summary')
COMPLETED=$(echo '$ARGUMENTS' | jq -r '.completed | join(",")')

bash lib/pipeline-runner.sh \
  --flow "$FLOW" \
  --feature-dir "$FEATURE_DIR" \
  --branch "$BRANCH" \
  --project-dir "$(pwd)" \
  --completed "$COMPLETED" \
  --summary "$SUMMARY"
```

## Step 2: Result Handling

Handle exit code from `pipeline-runner.sh`:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| `0` | All steps complete | Report success with step summary |
| `1` | Error | Report error details from JSONL output |
| `2` | NO-GO / Pause | Report NO-GO verdict, advise re-run after resolution |
| `3` | Rate limit | Report rate limit, advise waiting and re-running |

stdout is JSONL format — each line is a JSON object describing step progress.
Parse and relay progress to the user.

## Step 3: Error Recovery

- **Step failure**: Artifacts preserved. Re-run `/poor-dev` to resume from last completed step.
- **Rate limit**: Wait and re-run. `pipeline-runner.sh` handles resume via `pipeline-state.json`.
- **NO-GO verdict**: Review output, resolve issues, re-run `/poor-dev`.
- **Gate pause**: `pipeline-runner.sh` exits 0 at gates. Re-run to continue past gate.

## Headers

NON_INTERACTIVE_HEADER and READONLY_HEADER are managed by `lib/compose-prompt.sh` (Single Source of Truth).
Do not define header text in this template.

### PAUSE_FOR_APPROVAL(type, step, display_content)
1. Display `display_content`
2. `bash lib/pipeline-state.sh set-approval "${FEATURE_DIR}" "${TYPE}" "${STEP}"`
3. Message: "Awaiting approval (${type}). Re-run `/poor-dev` to continue."
4. Exit pipeline.
