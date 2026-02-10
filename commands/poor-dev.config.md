---
description: Hybrid model configuration — manage CLI/model settings per category or agent
---

## User Input

```text
$ARGUMENTS
```

## Config File

Path: `.poor-dev/config.json` (project-root, survives `npx poor-dev update`)

### Default Config (used by `reset`)

```json
{
  "default": {
    "cli": "opencode",
    "model": "zai-coding-plan/glm-4.7"
  },
  "overrides": {
    "fixer": { "cli": "claude", "model": "sonnet" },
    "phasereview": { "cli": "claude", "model": "haiku" }
  }
}
```

### Valid Keys

Categories: `planreview`, `tasksreview`, `architecturereview`, `qualityreview`, `phasereview`, `fixer`

Agents: `planreview-pm`, `planreview-risk`, `planreview-value`, `planreview-critical`, `tasksreview-techlead`, `tasksreview-senior`, `tasksreview-devops`, `tasksreview-junior`, `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`, `qualityreview-qa`, `qualityreview-testdesign`, `qualityreview-code`, `qualityreview-security`, `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`, `review-fixer`

CLIs: `claude`, `opencode`

Claude models (fixed): `haiku`, `sonnet`, `opus`

OpenCode models: dynamic — run `opencode models 2>/dev/null` to list.

---

## Subcommand Routing

Parse `$ARGUMENTS` and execute the matching subcommand:

| Pattern | Action |
|---------|--------|
| `show` or empty | → Show |
| `default <cli> <model>` | → Set Default |
| `set <key> <cli> <model>` | → Set Override |
| `unset <key>` | → Unset Override |
| `reset` | → Reset to Default Config |
| anything else | → Show help with valid syntax |

---

## Subcommand: `show`

1. Run Bash: `cat .poor-dev/config.json 2>/dev/null`
   - If file missing → auto-create with default config (see above), then read again.
2. Run Bash: `opencode models 2>/dev/null` (skip if opencode not installed)
3. Format output as table:

```
Default: <cli> / <model>

Category/Agent     CLI        Model                    Source
---------------------------------------------------------------
planreview         opencode   zai-coding-plan/glm-4.7  (default)
tasksreview        opencode   zai-coding-plan/glm-4.7  (default)
...
fixer              claude     sonnet                    (override)

Available models (OpenCode):
  <output from opencode models>

Available models (Claude Code):
  haiku, sonnet, opus
```

Show resolution: for each category, check overrides first, then default.

---

## Subcommand: `default <cli> <model>`

1. Validate `<cli>` is `claude` or `opencode`. Error + show valid values if not.
2. Validate `<model>`:
   - If cli=claude: must be `haiku`, `sonnet`, or `opus`.
   - If cli=opencode: run `opencode models 2>/dev/null` and check presence. If opencode not installed, accept any value with warning.
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Update `default.cli` and `default.model`.
5. Write back. Show confirmation.

---

## Subcommand: `set <key> <cli> <model>`

1. Validate `<key>` is a valid category or agent name (see Valid Keys above). Error + show valid keys if not.
2. Validate `<cli>` and `<model>` (same as `default`).
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Set `overrides.<key>` = `{ "cli": "<cli>", "model": "<model>" }`.
5. Write back. Show confirmation.

---

## Subcommand: `unset <key>`

1. Validate `<key>` exists in `overrides`. Error if not found.
2. Read `.poor-dev/config.json`.
3. Remove `overrides.<key>`.
4. Write back. Show confirmation + what the key now resolves to (default).

---

## Subcommand: `reset`

1. `mkdir -p .poor-dev`
2. Write default config (see Default Config above) to `.poor-dev/config.json`.
3. Show confirmation + run `show` to display result.

---

## Error Handling

| Error | Response |
|-------|----------|
| Invalid CLI name | Error message + show `claude`, `opencode` |
| Invalid model | Error message + list available models for the specified CLI |
| Invalid key | Error message + list all valid category/agent keys |
| Bad syntax / no args | Show help with all valid subcommand patterns |
| Config file missing | Auto-create with default config |
| `opencode` not installed | Warning + skip OpenCode model validation (accept any value) |
| `claude` not installed | Warning + skip Claude model validation (accept any value) |

---

## Implementation Notes

- All operations use Bash to read/write `.poor-dev/config.json`. Use `jq` if available, otherwise manipulate JSON directly as LLM.
- `mkdir -p .poor-dev` before any write.
- Config file is plain JSON — no comments, no trailing commas.
