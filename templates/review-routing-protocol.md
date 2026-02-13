## Execution Routing Protocol

**Mandatory dispatch logic — apply to every persona and to `review-fixer`.**

```
resolved_cli = config resolution from STEP 0
current_cli  = runtime you are executing in ("claude" or "opencode")

IF resolved_cli == current_cli:
  # Native execution
  IF current_cli == "claude":
    → Task(subagent_type="<AGENT>", model=<resolved model>, prompt="<INSTRUCTION>")
  ELSE:  # current_cli == "opencode"
    → @<AGENT>  (if config model == session default)
    → Bash: opencode run --model <model> --agent <AGENT> "<INSTRUCTION>"  (if different model)
ELSE:
  # Cross-CLI — REQUIRED even if native feels more convenient
  IF resolved_cli == "opencode":
    → Bash: opencode run --model <model> --agent <AGENT> --format json "<INSTRUCTION>" (run_in_background: true)
  ELSE:  # resolved_cli == "claude"
    → Bash: claude -p --model <model> --agent <AGENT> --no-session-persistence --output-format text "<INSTRUCTION>" (run_in_background: true)
```

**VIOLATION**: Using native Task/subagent when config resolves to a different CLI is a routing bug. Follow the tree above exactly.
