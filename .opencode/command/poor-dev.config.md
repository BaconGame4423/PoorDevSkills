---
description: "Interactively view and edit pipeline-config.yaml settings."
---

## User Input

```text
$ARGUMENTS
```

## Outline

### Step 1: Load Current Configuration

Read `.poor-dev/pipeline-config.yaml` and display current settings in a formatted table:

```
Current Configuration:
┌──────────────────┬──────────┐
│ Setting          │ Value    │
├──────────────────┼──────────┤
│ defaults.runtime │ claude   │
│ defaults.model   │ sonnet   │
│ defaults.budget  │ 5.0      │
│ defaults.confirm │ true     │
├──────────────────┼──────────┤
│ intake.model     │ haiku    │
│ implement.model  │ opus     │
└──────────────────┴──────────┘
```

### Step 2: Choose Action

- **Claude Code**: Use `AskUserQuestion` tool with:
  - question: "設定を変更しますか？"
  - options:
    1. "表示のみ（変更なし）"
    2. "デフォルト値を変更"
    3. "ステップ別設定を変更"
    4. "設定をリセット"
- **OpenCode**: Use `question` tool with the same content.

### Step 3: Apply Changes

**デフォルト値を変更**:
- Ask which default to change (runtime, model, max_budget_usd, confirm)
- Ask for the new value
- Validate: runtime must be `claude` or `opencode`, confirm must be `true` or `false`, max_budget_usd must be a number
- Apply with: `yq -i ".defaults.<field> = <value>" .poor-dev/pipeline-config.yaml`

**ステップ別設定を変更**:
- Ask which step to configure
- Valid steps: `intake`, `specify`, `clarify`, `plan`, `planreview`, `tasks`, `tasksreview`, `architecturereview`, `implement`, `qualityreview`, `phasereview`, `concept`, `goals`, `milestones`, `roadmap`
- Ask which field to set (runtime, model)
- Validate values as above
- Apply with: `yq -i ".steps.<step>.<field> = <value>" .poor-dev/pipeline-config.yaml`

**設定をリセット**:
- Confirm with user before resetting
- Copy `.poor-dev/templates/workflow-state-template.yaml` is NOT the config — reset means restoring default config values:
  ```bash
  yq -i '.defaults.runtime = "claude"' .poor-dev/pipeline-config.yaml
  yq -i '.defaults.model = "sonnet"' .poor-dev/pipeline-config.yaml
  yq -i '.defaults.max_budget_usd = 5.0' .poor-dev/pipeline-config.yaml
  yq -i '.defaults.confirm = true' .poor-dev/pipeline-config.yaml
  yq -i 'del(.steps)' .poor-dev/pipeline-config.yaml
  yq -i '.steps.intake.model = "haiku"' .poor-dev/pipeline-config.yaml
  yq -i '.steps.implement.model = "opus"' .poor-dev/pipeline-config.yaml
  ```

### Step 4: Show Changes

After any modification, re-read the config and display the updated table with a diff summary showing what changed.

## Guidelines

- **Validate all inputs** before writing to YAML
- **Show before/after** for every change
- **Language** — interact in Japanese
