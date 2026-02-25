---
description: "Select and start a development flow directly without intake classification."
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
    send: true
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
    send: true
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
    send: true
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
    send: true
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
    send: true
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

### Step 1: Flow Selection

If `$ARGUMENTS` contains `--flow-type <type>`, use that directly.

Otherwise:
1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --list-flows --project-dir .`
2. Parse the JSON output to get available flows
3. Build AskUserQuestion options:
   - Built-in pipeline flows (feature, bugfix, roadmap) with their descriptions
   - Discovery shortcut (discovery-init) with its description
   - Investigation flow (investigation) with its description
   - Custom flows (builtin: false) with their descriptions
   - Utility shortcuts (ask, report) — always at the end
4. Ask user: "どのフローを開始しますか？"

Also available via `--flow-type`: ask, report.

### Step 2: Non-Pipeline / Discovery Shortcuts

- **ask/report**: Invoke `/poor-dev.ask` or `/poor-dev.report` directly. End.
- **discovery**: Invoke `/poor-dev.discovery` directly. End. (Handles own branch.)

### Step 3: Get Description

For pipeline flows (feature, bugfix, roadmap): use description from `$ARGUMENTS` or ask user.

### Step 4: Branch & Directory Creation

Generate short name (2-4 words). Find highest branch number N. Use N+1.
```bash
git fetch --all --prune
git checkout -b NNN-short-name
mkdir -p specs/NNN-short-name
```

### Step 5: Route by Flow Type

- **Feature**: Report selection. Next: `/poor-dev.specify`
- **Bugfix**: Create `$FEATURE_DIR/bug-report.md` with template. Next: `/poor-dev.bugfix`
- **Roadmap**: Report selection. Next: `/poor-dev.concept`
