# Project Context (auto-generated)

**Generated**: 2026-02-11
**Project**: poor-dev (v1.0.0)
**Type**: Node.js (ESM)

## File Structure

```text
.
├── bin/
│   └── poor-dev.mjs              # CLI entrypoint (init/update/status)
├── lib/
│   └── installer.mjs             # Installation logic
├── commands/                      # 52 Markdown slash commands
│   ├── poor-dev.md               # Main intake router
│   ├── poor-dev.specify.md       # Feature spec generation
│   ├── poor-dev.plan.md          # Technical planning
│   ├── poor-dev.tasks.md         # Task decomposition
│   ├── poor-dev.implement.md     # Implementation executor
│   ├── poor-dev.bugfix.md        # Bug investigation
│   ├── poor-dev.discovery.md     # Exploration mode
│   ├── poor-dev.harvest.md       # Knowledge harvesting
│   ├── poor-dev.context.md       # Project context generator
│   ├── poor-dev.*review.md       # 5 review orchestrators (plan/tasks/arch/quality/phase)
│   ├── poor-dev.*review-*.md     # 20 individual persona commands
│   └── poor-dev.{ask,report,config,concept,goals,milestones,roadmap,...}.md
├── agents/
│   ├── claude/                    # 21 Claude Code agent definitions
│   └── opencode/                  # 21 OpenCode agent definitions
├── templates/
│   ├── constitution.md            # Project constitution template
│   └── poordevskills-rules.md    # Cross-project rules template
├── specs/                         # Feature specification directories
├── docs/                          # Living dashboards (progress.md, roadmap.md)
├── AGENT.md                       # Complete workflow documentation
├── CLAUDE.md                      # Project instructions for AI
├── README.md                      # User-facing documentation
├── constitution.md                # 10-principle governance
├── bug-patterns.md                # Bug pattern database
└── package.json                   # Node.js package config
```

## Dependencies

No runtime dependencies. Node.js >= 18.0.0 required.

## Entry Points

- **CLI**: `bin/poor-dev.mjs` → subcommands: `init`, `update`, `status`
- **Main workflow**: `/poor-dev` slash command → auto-classifies intent → routes to flow
- **Install**: `npx github:BaconGame4423/PoorDevSkills init`

## Key Exports

```text
lib/installer.mjs: init, update, status
```

## Architecture Summary

- Slash commands are Markdown files interpreted by Claude Code / OpenCode
- 5 review types × 4 personas each = 20 AI reviewer agents (read-only)
- 1 review-fixer agent (write-enabled) for auto-fix loops
- Dual-runtime: Claude Code + OpenCode with per-agent model config
- Config stored in `.poor-dev/config.json`
