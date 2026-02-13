# Research: Adaptive Sub-Agent Polling System

**Feature**: Adaptive Sub-Agent Polling System
**Branch**: 006-adaptive-agent-polling
**Date**: 2026-02-12

## Research Overview

This document consolidates research findings for implementing adaptive polling to eliminate fixed timeouts in sub-agent dispatch. Current implementation uses a fixed 180-second timeout for all sub-agent tasks, causing unnecessary wait time for fast-responding tasks.

## Current Implementation Analysis

### Dispatch Mechanism

**Finding**: Review orchestrators (`poor-dev.planreview.md`, `poor-dev.tasksreview.md`, etc.) use multiple dispatch patterns:

1. **Native Execution** (same CLI runtime):
   - `Task(subagent_type="tasksreview-techlead", ...)` - for OpenCode
   - `@tasksreview-techlead` - shorthand for same-model execution
   - Both use the Task tool which handles internal dispatching

2. **Cross-CLI Execution** (different CLI runtime):
   - `Bash: opencode run --model <model> --agent tasksreview-techlead ... (run_in_background: true)`
   - `Bash: claude -p --model <model> --agent tasksreview-techlead --no-session-persistence ... (run_in_background: true)`
   - These spawn background processes and wait for completion

**Implication**: The 180-second timeout is likely enforced at the CLI tool level (OpenCode's `run` command or Claude's command), not in the orchestrator Markdown files themselves. We need to add polling logic that monitors these background processes more intelligently.

### Wait Mechanism

**Finding**: Orchestrator documentation shows:
- `↓ wait for all to complete` - indicates waiting for parallel sub-agents
- `↓ wait for completion` - indicates waiting for single sub-agent (fixer)
- No explicit timeout handling visible in Markdown files

**Implication**: The timeout is likely a default behavior of the underlying tools (OpenCode/Claude CLI). We need to add explicit polling logic that can check process status and output streams at intervals.

### Sub-Agent Output Format

**Finding**: All review sub-agents are instructed to output:
- `Output compact English YAML.`
- Example output format:
  ```yaml
  p: TECHLEAD
  v: GO|CONDITIONAL|NO-GO
  i:
    - C: description
    - H: description
  ```

**Implication**: Natural completion markers include:
- YAML document end (end of file or `---` separator)
- Specific YAML structure completion (e.g., presence of `v:` field)
- File size stabilization (no new output for N seconds)

## Configuration Structure

### Current Config Status

**Finding**: `.poor-dev/config.json` is referenced in:
- `constitution.md` - mentions `.poor-dev/config.json` `dispatch_timeout` field (default 180s)
- `.poor-dev/context.md` - "Config stored in `.poor-dev/config.json`"
- File does not exist in repository (needs to be created)

**Decision**: Create `.poor-dev/config.json` with structure:

```json
{
  "default": {
    "cli": "opencode",
    "model": "zai-coding-plan/glm-4.7"
  },
  "overrides": {},
  "dispatch_timeout": 180,
  "polling": {
    "interval": 1,
    "completion_markers": {
      "yaml": ["---", "\n..."],
      "json": ["}\n"],
      "min_output_length": 100
    }
  }
}
```

**Rationale**: Structure maintains existing dual-runtime config while adding polling-specific settings. Default values match spec requirements (1s interval, 180s timeout).

### Alternatives Considered

**Alternative 1**: Use environment variables
- `POOR_DEV_DISPATCH_TIMEOUT`, `POOR_DEV_POLLING_INTERVAL`
- **Rejected**: Environment variables are harder to document and discover; config.json is more project-specific

**Alternative 2**: Use CLI flags per command
- `--timeout 60 --poll-interval 1`
- **Rejected**: Too verbose; most users want consistent settings across all commands

**Alternative 3**: Hardcode values
- Polling interval 1s, timeout 180s
- **Rejected**: Spec requires configurable timeout for flexibility

## Polling Techniques

### Technique 1: Bash Polling

**Approach**:
```bash
# Spawn sub-agent in background
AGENT_PID=$(opencode run ... & echo $!)
# Poll output every second
while kill -0 $AGENT_PID 2>/dev/null; do
  OUTPUT=$(cat /tmp/agent_output_$AGENT_PID 2>/dev/null || echo "")
  if is_complete "$OUTPUT"; then
    break
  fi
  sleep 1
done
```

**Pros**:
- Simple, no dependencies
- Works with any subprocess
- Easy to test

**Cons**:
- Requires temporary file management
- Signal handling (`kill -0`) may be platform-specific
- Hard to capture stderr separately

**Decision**: Not recommended for cross-platform compatibility concerns

### Technique 2: Node.js async polling with child_process

**Approach**:
```javascript
import { spawn } from 'child_process';

async function pollSubAgent(command, config) {
  const proc = spawn(command[0], command.slice(1), {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  const startTime = Date.now();
  const completionMarkers = config.polling.completion_markers;

  proc.stdout.on('data', (chunk) => {
    output += chunk.toString();
    if (isComplete(output, completionMarkers)) {
      proc.kill('SIGTERM');
    }
  });

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
    throw new Error('Sub-agent timeout');
  }, config.dispatch_timeout * 1000);

  await new Promise((resolve, reject) => {
    proc.on('close', resolve);
    proc.on('error', reject);
  });

  clearTimeout(timeout);
  return output;
}
```

**Pros**:
- Cross-platform (Node.js runtime)
- Direct access to stdout/stderr streams
- No temp files needed
- Better error handling

**Cons**:
- Requires spawning Node.js process for each orchestrator
- More complex than Bash

**Decision**: **RECOMMENDED** - Best balance of cross-platform compatibility and functionality. Use existing `lib/` directory structure.

### Technique 3: Hybrid (Bash for dispatch, Node.js for polling)

**Approach**:
- Use Bash to spawn sub-agent (as currently done)
- Write Node.js polling script that wraps the Bash dispatch
- Orchestrators call the polling script instead of direct Bash commands

**Pros**:
- Minimal changes to orchestrator Markdown files
- Polling logic centralized
- Easy to test independently

**Cons**:
- Additional script dependency
- Indirect execution path harder to debug

**Decision**: Acceptable alternative to Technique 2; implementation can decide based on simplicity

## Completion Marker Detection

### Detection Rules

**Finding**: Sub-agents output structured YAML with specific format. Completion can be detected by:

1. **Structural markers**:
   - YAML document end: `---` or `...` at end of file
   - JSON closing brace: `}\n` (if JSON format requested)
   - Required field presence: `v:` field in YAML (always present)

2. **Heuristic markers**:
   - Minimum output length: 100 characters (prevents false positives)
   - No new output for 2 consecutive polls (2 seconds of silence)
   - Process exited but output collected

3. **Fallback**:
   - Maximum timeout reached (safety net)

**Decision**: Implement multi-layered detection:
- Primary: Required field presence (`v:` in YAML)
- Secondary: Minimum length (100 chars)
- Tertiary: Process exit with output
- Fallback: Timeout

### Alternatives Considered

**Alternative 1**: Count-based completion (wait for N lines)
- **Rejected**: Sub-agents may produce variable-length output

**Alternative 2**: Time-based completion (assume done after N seconds)
- **Rejected**: Defeats the purpose of adaptive polling

**Alternative 3**: Custom completion marker (sub-agent emits `DONE` at end)
- **Rejected**: Requires changes to all 20+ sub-agent definitions

## Swarm Mail Compatibility

### Current Swarm Mail Usage

**Finding**: Swarm Mail is mentioned in `constitution.md` for multi-agent coordination, but:
- No Swarm Mail usage found in review orchestrator Markdown files
- Orchestrators directly spawn sub-agents without Swarm Mail

**Implication**: Swarm Mail is likely used for other workflows (not review loops). Review orchestrators are independent.

**Decision**: Swarm Mail compatibility not a concern for this feature. Review orchestrators will continue to spawn sub-agents directly.

## Implementation Decision Summary

### Architecture

**Choice**: Technique 2 (Node.js async polling) + Hybrid wrapper

**Implementation Plan**:
1. Create `lib/subagent-poller.mjs` - Core polling utility
2. Create `lib/completion-detector.mjs` - Completion marker detection
3. Create `lib/config-loader.mjs` - Config.json loader (if not exists)
4. Update orchestrator Markdown files to use polling wrapper
5. Create `.poor-dev/config.json` template

### Files to Modify

**New files**:
- `lib/subagent-poller.mjs`
- `lib/completion-detector.mjs`
- `lib/config-loader.mjs`
- `tests/unit/subagent-poller.test.mjs`
- `tests/unit/completion-detector.test.mjs`
- `tests/integration/review-loop.test.mjs`
- `.poor-dev/config.json`

**Modified files**:
- `commands/poor-dev.planreview.md`
- `commands/poor-dev.tasksreview.md`
- `commands/poor-dev.architecturereview.md`
- `commands/poor-dev.qualityreview.md`
- `commands/poor-dev.phasereview.md`

### Backward Compatibility

**Strategy**:
- Polling wrapper falls back to original Bash dispatch if config.json missing
- Use existing default values (180s timeout, 1s interval) when config not specified
- No changes required to sub-agent agent definitions

### Risk Assessment

**Low Risk**:
- Polling logic is internal utility; no public API changes
- Config.json creation is optional (fallback to defaults)
- Testing with mock sub-agents isolates from real AI calls

**Medium Risk**:
- Cross-platform compatibility (Bash vs Node.js subprocess handling)
- Integration with existing orchestrator Markdown flow

**Mitigation**:
- Unit tests for core polling logic
- Integration tests with mock sub-agents
- Gradual rollout (test on one orchestrator first)

## Open Questions

### Question 1: Config File Distribution

**Issue**: Config.json needs to be created per project. How should it be distributed?

**Options**:
1. Generate on first `/poor-dev` command execution
2. Include in repository as `.poor-dev/config.json.example`
3. Auto-create with defaults on first use

**Decision**: Auto-create with defaults on first use. User can override as needed.

### Question 2: Testing Real Sub-Agents

**Issue**: Unit tests use mock output, but need to verify real-world performance.

**Approach**:
- Unit tests: Mock output streams with various completion scenarios
- Integration tests: Use fast sub-agent commands (e.g., `/poor-dev.ask` simple question)
- Manual testing: Run review orchestrators with real sub-agents

### Question 3: Error Handling

**Issue**: What happens when sub-agent fails or produces invalid output?

**Handling**:
- Sub-agent non-zero exit code: Return error with collected output
- Invalid YAML/JSON: Return partial output with error marker
- Timeout: Return error with partial output collected

## Next Steps (Phase 1)

1. Extract data model from research findings → `data-model.md`
2. Design API contracts → `/contracts/`
3. Write quickstart guide → `quickstart.md`
4. Proceed to task breakdown → `/poor-dev.tasks`

## References

- Spec: `/specs/006-adaptive-agent-polling/spec.md`
- Constitution: `/constitution.md`
- Context: `/.poor-dev/context.md`
- Agent definitions: `/agents/opencode/*.md`
