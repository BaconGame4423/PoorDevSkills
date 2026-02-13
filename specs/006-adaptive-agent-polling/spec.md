# Feature Specification: Adaptive Sub-Agent Polling System

**Feature Branch**: `006-adaptive-agent-polling`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "サブエージェントから応答を待つ時間を予想してTimeout設定すると時間ロスが大きい。毎秒サブエージェントの出力をチェックして一定の出力が得られたら次に行くようにするのはどう。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Output-Driven Pipeline Progression (Priority: P1)

When the pipeline executes a sub-agent task (e.g., `/poor-dev.specify` or `/poor-dev.plan`), the system should poll the sub-agent's output stream every second instead of waiting for a fixed timeout period. Once the sub-agent has produced sufficient output, the pipeline should immediately proceed to the next step, reducing wasted wait time for fast-responding tasks.

**Why this priority**: This is the core improvement that addresses the user's pain point of time waste from fixed timeouts. Most tasks complete faster than the current 180-second timeout, and this optimization will provide immediate time savings across all pipeline steps.

**Independent Test**: Run a simple sub-agent task (e.g., `/poor-dev.specify` with a minimal description) and verify that the pipeline proceeds to the next step within seconds rather than waiting 180 seconds. Measure actual wait time vs. fixed timeout.

**Acceptance Scenarios**:
1. **Given** a sub-agent task is dispatched, **When** the sub-agent produces output within 5 seconds, **Then** the pipeline should detect this output and proceed to the next step without waiting the full 180-second timeout
2. **Given** a sub-agent task is dispatched, **When** the sub-agent produces output incrementally over time, **Then** the pipeline should poll every second and continue polling until output reaches a sufficient threshold, then proceed
3. **Given** a sub-agent task is dispatched, **When** the sub-agent produces no output, **Then** the pipeline should wait until a maximum safety timeout before timing out and reporting failure

---

### User Story 2 - Safety Timeout Fallback (Priority: P2)

While the adaptive polling improves speed for responsive agents, there must still be a maximum timeout to prevent indefinite hanging when sub-agents fail or become unresponsive.

**Why this priority**: Safety and reliability. Without a maximum timeout, a failed sub-agent could hang the pipeline indefinitely, creating a poor user experience.

**Independent Test**: Simulate a hung sub-agent (e.g., by pointing to a non-existent command or using a mock agent that never responds) and verify that the pipeline eventually times out and reports an error rather than hanging forever.

**Acceptance Scenarios**:
1. **Given** a sub-agent task is dispatched, **When** the sub-agent produces no output within the maximum safety timeout (e.g., 180 seconds), **Then** the pipeline should terminate the task and report a timeout error
2. **Given** a sub-agent task is dispatched, **When** the sub-agent produces partial output but then stops producing output, **Then** the pipeline should continue polling until the maximum safety timeout is reached, then report timeout with any partial output collected

---

### Edge Cases
- What happens when sub-agent produces output that is too short or appears incomplete? The system should either have a minimum length threshold or wait for a termination signal from the sub-agent.
- How does the system handle sub-agents that produce output but never complete (e.g., streaming output indefinitely)? Should require either a completion marker or a maximum elapsed time.
- What happens if the polling interval (1 second) causes high CPU usage on the host system? Should be minimal overhead, but worth monitoring.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST poll sub-agent output streams at regular intervals (default: 1 second) instead of using a fixed wait time
- **FR-002**: System MUST detect when sub-agent has produced "sufficient output" and immediately proceed to the next pipeline step
- **FR-003**: System MUST maintain a maximum safety timeout to prevent indefinite waiting when sub-agents fail or hang
- **FR-004**: System MUST detect completion by recognizing a completion marker in sub-agent output (e.g., JSON closing brace, specific end-of-output pattern)
- **FR-005**: System MUST collect and pass through all sub-agent output to the pipeline for logging/debugging purposes
- **FR-006**: System MUST handle both standard output and standard error streams from sub-agents

### Key Entities *(include if feature involves data)*
- **Polling Configuration**: Contains polling interval (default 1s), maximum safety timeout (default 180s), and output sufficiency criteria (minimum length, completion markers)
- **Sub-Agent Output Buffer**: Accumulates output from the sub-agent process during polling, with timestamp for each chunk
- **Polling State**: Tracks current polling status (active/paused/complete), elapsed time, and whether sufficiency criteria have been met

## Assumptions Made *(mandatory)*

| ID | Category | Assumption | Basis | Impact if Wrong |
|----|----------|-----------|-------|-----------------|
| A-001 | Sub-agent behavior | Sub-agents produce all output before completing (or emit a completion marker) | Standard process behavior in CLI tools | If sub-agents stream output continuously without completion marker, need additional logic to detect "done" state |
| A-002 | Output criteria | "Sufficient output" is determined by detecting a completion marker in the output stream | User preference for marker-based detection over character count | If sub-agents do not emit recognizable completion markers, the system falls back to process termination detection |
| A-003 | Performance impact | Polling at 1-second intervals has negligible performance impact and does not cause noticeable CPU usage | Typical shell polling overhead is minimal | If polling causes significant CPU load, may need to increase interval or implement event-driven output detection |
| A-004 | Safety timeout | Maximum safety timeout is configurable via `.poor-dev/config.json` `dispatch_timeout` field (default 180s) | User preference for configurability; existing config field already available | If users set excessively long timeouts, resource utilization may increase |

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: Average pipeline wait time for sub-agent tasks is reduced by at least 60% for tasks that complete within 10 seconds
- **SC-002**: Zero occurrences of indefinite hangs (all tasks eventually complete or timeout with error)
- **SC-003**: No increase in CPU usage or system load compared to current fixed-timeout implementation
- **SC-004**: All existing pipeline functionality remains unchanged (no regressions in output quality, error handling, or task completion)

**Clarification Resolution**:
- **Output sufficiency criteria**: 完了マーカー検知方式を採用。サブエージェントの出力に特定の完了マーカー（例: JSON の閉じ括弧、特定のパターン）を検知したら次のステップへ進む。
- **Maximum safety timeout**: `.poor-dev/config.json` の `dispatch_timeout` フィールドで設定可能にする（既存フィールドを活用）。デフォルトは180秒を維持。
