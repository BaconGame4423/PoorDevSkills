# Data Model: Adaptive Sub-Agent Polling System

**Feature**: Adaptive Sub-Agent Polling System
**Branch**: 006-adaptive-agent-polling
**Date**: 2026-02-12

## Overview

This document defines the data model for adaptive polling of sub-agent output streams. The model supports polling configuration, output buffering, completion detection, and polling state management.

## Entities

### PollingConfiguration

Configuration for sub-agent polling behavior.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `dispatchTimeout` | number | Yes | 180 | Maximum timeout in seconds before force-terminating sub-agent |
| `pollingInterval` | number | Yes | 1 | Polling interval in seconds (minimum 1) |
| `completionMarkers` | CompletionMarkerConfig | Yes | See below | Configuration for completion marker detection |
| `minOutputLength` | number | No | 100 | Minimum output length (bytes) to consider sub-agent "started" |

**Validation Rules**:
- `dispatchTimeout` must be >= 10 seconds
- `pollingInterval` must be >= 1 second and <= `dispatchTimeout`
- `minOutputLength` must be >= 0

**State Transitions**: None (immutable after load from config)

**Example**:
```json
{
  "dispatchTimeout": 180,
  "pollingInterval": 1,
  "completionMarkers": {
    "yaml": ["---", "\n..."],
    "json": ["}\n"],
    "requiredField": "v:"
  },
  "minOutputLength": 100
}
```

### CompletionMarkerConfig

Configuration for detecting completion markers in sub-agent output.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `yaml` | string[] | No | ["---", "\n..."] | YAML document end markers to detect |
| `json` | string[] | No | ["}\n"] | JSON closing brace patterns to detect |
| `requiredField` | string | No | "v:" | Required YAML field (indicates valid output) |
| `minSilenceCycles` | number | No | 2 | Number of consecutive polls with no new output before considering complete |

**Validation Rules**:
- Arrays must contain at least one pattern if provided
- `minSilenceCycles` must be >= 1

**State Transitions**: None (immutable after load from config)

**Example**:
```json
{
  "yaml": ["---", "\n..."],
  "json": ["}\n"],
  "requiredField": "v:",
  "minSilenceCycles": 2
}
```

### SubAgentOutputBuffer

Accumulates and manages sub-agent output during polling.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `stdout` | OutputChunk[] | Yes | [] | Collected stdout chunks with timestamps |
| `stderr` | OutputChunk[] | Yes | [] | Collected stderr chunks with timestamps |
| `totalLength` | number | Yes | 0 | Total bytes collected (stdout + stderr) |
| `lastUpdateTime` | number | Yes | 0 | Unix timestamp of last data received |

**Methods**:

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `addChunk(type, data)` | `type: 'stdout'|'stderr'`, `data: string|Buffer` | void | Add output chunk with current timestamp |
| `getFullOutput()` | - | string | Concatenate all stdout chunks |
| `getFullError()` | - | string | Concatenate all stderr chunks |
| `hasMinLength(minLength)` | `minLength: number` | boolean | Check if total length >= minLength |
| `getSilenceDuration()` | - | number | Seconds since last data received |
| `hasRequiredField(field)` | `field: string` | boolean | Check if required YAML field exists in stdout |

**State Transitions**:
- Initial: Empty buffers, totalLength=0
- Receiving data: Chunks added, totalLength increases, lastUpdateTime updated
- Complete: No more chunks expected after completion detection

**Example**:
```javascript
{
  stdout: [
    { data: "p: TECHLEAD\n", timestamp: 1739318400 },
    { data: "v: GO\n", timestamp: 1739318401 },
    { data: "i: []\n", timestamp: 1739318402 }
  ],
  stderr: [],
  totalLength: 28,
  lastUpdateTime: 1739318402
}
```

### OutputChunk

Single chunk of sub-agent output with timestamp.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `data` | string | Yes | - | Output data (string) |
| `timestamp` | number | Yes | - | Unix timestamp when chunk was received |

**Validation Rules**:
- `data` must not be empty
- `timestamp` must be > 0

**State Transitions**: None (immutable after creation)

**Example**:
```javascript
{
  "data": "p: TECHLEAD\n",
  "timestamp": 1739318400
}
```

### PollingState

Tracks the current state of sub-agent polling.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | PollingStatus | Yes | 'pending' | Current polling status |
| `elapsedTime` | number | Yes | 0 | Elapsed time in seconds since polling started |
| `pollCount` | number | Yes | 0 | Number of polls performed |
| `completionDetected` | boolean | Yes | false | Whether completion marker was detected |
| `exitCode` | number \| null | Yes | null | Sub-agent exit code (if exited) |
| `startTime` | number | Yes | 0 | Unix timestamp when polling started |

**PollingStatus Enum**:
- `'pending'`: Polling not yet started
- `'active'`: Polling in progress
- `'completed'`: Sub-agent completed successfully
- `'timeout'`: Maximum timeout reached
- `'error'`: Sub-agent error or failure

**State Transitions**:
```
pending → active (polling started)
  active → completed (completion marker detected OR exit code 0)
  active → timeout (elapsed time >= dispatchTimeout)
  active → error (non-zero exit code OR other error)
completed, timeout, error → terminal (no further transitions)
```

**Example**:
```javascript
{
  "status": "active",
  "elapsedTime": 5,
  "pollCount": 5,
  "completionDetected": true,
  "exitCode": null,
  "startTime": 1739318400
}
```

### SubAgentCommand

Represents a sub-agent command to execute.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cli` | 'claude' \| 'opencode' | Yes | - | CLI runtime to use |
| `model` | string | Yes | - | Model identifier |
| `agent` | string | Yes | - | Agent name |
| `prompt` | string | Yes | - | Prompt to send to agent |
| `outputFormat` | 'text' \| 'json' \| 'yaml' | No | 'yaml' | Expected output format |
| `crossRuntime` | boolean | No | false | Whether executing across different CLI runtimes |

**Validation Rules**:
- `model` must be non-empty
- `agent` must match existing agent definitions
- `prompt` must be non-empty

**State Transitions**: None (immutable after creation)

**Example**:
```javascript
{
  "cli": "opencode",
  "model": "zai-coding-plan/glm-4.7",
  "agent": "tasksreview-techlead",
  "prompt": "Review tasks.md. Output compact English YAML.",
  "outputFormat": "yaml",
  "crossRuntime": false
}
```

### PollingResult

Result of sub-agent polling operation.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `success` | boolean | Yes | - | Whether operation succeeded |
| `stdout` | string | Yes | "" | Collected stdout output |
| `stderr` | string | Yes | "" | Collected stderr output |
| `exitCode` | number \| null | Yes | null | Sub-agent exit code |
| `elapsedTime` | number | Yes | 0 | Total elapsed time in seconds |
| `pollCount` | number | Yes | 0 | Number of polls performed |
| `status` | PollingStatus | Yes | 'completed' | Final polling status |
| `completionMethod` | string \| null | Yes | null | How completion was detected (e.g., "marker", "exit", "timeout") |

**Validation Rules**:
- If `success` is true, `exitCode` must be 0
- If `success` is false, `stdout` or `stderr` should contain error information

**State Transitions**: None (immutable after creation)

**Example**:
```javascript
{
  "success": true,
  "stdout": "p: TECHLEAD\nv: GO\ni: []",
  "stderr": "",
  "exitCode": 0,
  "elapsedTime": 3,
  "pollCount": 3,
  "status": "completed",
  "completionMethod": "marker"
}
```

## Relationships

```
PollingConfiguration
  └─ contains → CompletionMarkerConfig

SubAgentCommand
  └─ executed with → PollingConfiguration

SubAgentOutputBuffer
  └─ composed of → OutputChunk[]

PollingState
  └─ references → PollingConfiguration
  └─ references → SubAgentOutputBuffer

PollingResult
  └─ derived from → PollingState
  └─ derived from → SubAgentOutputBuffer
```

## Data Flow

```
1. Load Config
   config.json → PollingConfiguration

2. Spawn Sub-Agent
   SubAgentCommand + PollingConfiguration → Spawn process

3. Poll Loop
   For each poll:
   - Read stdout/stderr → SubAgentOutputBuffer.addChunk()
   - Check completion → completion-detector.check()
   - Update state → PollingState

4. Return Result
   PollingState + SubAgentOutputBuffer → PollingResult
```

## Storage

**In-memory**:
- `SubAgentOutputBuffer` - Lives during polling operation
- `PollingState` - Lives during polling operation
- `SubAgentCommand` - Created per sub-agent dispatch

**Disk**:
- `.poor-dev/config.json` - Persistent configuration

**No database** - This is a CLI tool optimization, all state is ephemeral

## Validation Summary

| Entity | Validation Focus |
|--------|------------------|
| PollingConfiguration | Timeout/interval bounds, marker patterns |
| CompletionMarkerConfig | Pattern non-empty, silence cycles >= 1 |
| SubAgentOutputBuffer | Chunk data non-empty, timestamp valid |
| PollingState | Valid status transitions, time constraints |
| SubAgentCommand | Valid CLI/model/agent, prompt non-empty |
| PollingResult | Success/exitCode consistency |

## Performance Considerations

**Memory**:
- `SubAgentOutputBuffer`: Holds all output in memory until completion
- Mitigation: Maximum timeout of 180s limits accumulation

**CPU**:
- Polling at 1s intervals: Minimal impact (one check per second per active sub-agent)
- Parallel sub-agents: 4 reviews × 1 poll/second = 4 checks/second (negligible)

**I/O**:
- Reading subprocess streams: Standard async I/O, no blocking
- Temporary files: Not used (Node.js streams directly)

## Extension Points

**Future Enhancements**:
1. Configurable completion markers per output format
2. Adaptive polling interval (increase interval after long-running agents)
3. Output buffering to file for large outputs
4. Per-agent timeout overrides in config.json
5. Real-time output streaming to parent process

## References

- Spec: `/specs/006-adaptive-agent-polling/spec.md`
- Research: `/specs/006-adaptive-agent-polling/research.md`
- Config template: `.poor-dev/config.json`
