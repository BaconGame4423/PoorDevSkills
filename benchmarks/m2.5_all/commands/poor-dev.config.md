---
description: Hybrid model configuration — manage CLI/model settings per category or agent
---

## User Input

```text
$ARGUMENTS
```

## Execution

Parse `$ARGUMENTS` to extract the subcommand and its arguments, then delegate to `lib/config.sh`:

```bash
bash lib/config.sh <subcommand> [args...]
```

| Pattern | Subcommand |
|---------|-----------|
| `show` or empty | `show` |
| `default <cli> <model>` | `default <cli> <model>` |
| `set <key> <cli> <model>` | `set <key> <cli> <model>` |
| `unset <key>` | `unset <key>` |
| `tier <name> <cli> <model>` | `tier <name> <cli> <model>` |
| `tier-unset <name>` | `tier-unset <name>` |
| `step-tier <step> <tier>` | `step-tier <step> <tier>` |
| `step-tier-unset <step>` | `step-tier-unset <step>` |
| `depth <auto\|deep\|standard\|light>` | `depth <value>` |
| `speculation <on\|off>` | `speculation <value>` |
| `parallel <on\|off\|auto\|same-branch\|worktree\|phase-split>` | `parallel <value>` |
| `reset` | `reset` |
| anything else | `help` |

Display the output from `lib/config.sh` to the user. If the script returns a non-zero exit code, show the error message.
