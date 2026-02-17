---
description: Investigate problems, analyze root causes, and explore unknown issues without assuming they are bugs.
handoffs:
  - label: Start Bug Fix
    agent: poor-dev.bugfix
    prompt: Convert this investigation into a bug fix
    send: false
  - label: Create Feature Spec
    agent: poor-dev.specify
    prompt: Convert investigation findings into a feature specification
    send: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Investigate a problem, behavior, or phenomenon without assuming it's a bug. This command is for:
- "Why is X happening?"
- "I need to understand how X works"
- "Something seems off, but I'm not sure what"
- Performance investigation without known root cause
- Behavioral analysis

The investigation produces findings and a recommended next action, but does NOT modify code.

## Operating Constraints

**STRICTLY READ-ONLY**: Do not modify any files. Output a structured investigation report.

## Execution Steps

### 1. Problem Statement Extraction

Parse `$ARGUMENTS` to extract:
- **Phenomenon**: What is being observed?
- **Context**: When/where does it occur?
- **Expectations**: What did the user expect? (if any)

### 2. Evidence Gathering

Based on the problem type, gather relevant evidence:

**Code Investigation**:
- Search for relevant code patterns using Grep
- Read key files to understand the flow
- Trace data/control flow through the system

**Behavior Investigation**:
- Check logs, configuration files
- Review recent changes (git log)
- Examine runtime state indicators

**Performance Investigation**:
- Identify potential bottlenecks
- Check for N+1 queries, memory issues, blocking operations
- Review algorithmic complexity

### 3. Hypothesis Generation

Generate 2-4 hypotheses for the root cause:
- Rate each hypothesis by likelihood (High/Medium/Low)
- Identify what evidence would support/refute each
- Note any assumptions made

### 4. Root Cause Analysis

For each hypothesis:
1. Seek confirming/disconfirming evidence
2. Apply 5 Whys if applicable
3. Narrow down to most likely cause(s)

### 5. Investigation Report

Output a structured report:

```markdown
## Investigation Report

**Problem**: [phenomenon description]
**Context**: [when/where]
**Investigated**: [timestamp]

### Findings

1. **[Finding 1]**: [description with evidence]
2. **[Finding 2]**: [description with evidence]

### Root Cause Analysis

| Hypothesis | Likelihood | Evidence For | Evidence Against | Verdict |
|------------|------------|--------------|------------------|---------|
| [H1] | High/Med/Low | ... | ... | Confirmed/Ruled out/Inconclusive |
| [H2] | ... | ... | ... | ... |

### Most Likely Cause

[Detailed explanation of the most likely root cause]

### Impact Assessment

- **Severity**: Critical/High/Medium/Low
- **Scope**: [affected components/users]
- **Urgency**: [time sensitivity]

### Recommended Actions

1. [Primary recommendation]
2. [Alternative approaches]

### Next Steps

Based on this investigation, consider:
- If this is a confirmed bug → `/poor-dev.bugfix` with findings
- If this requires a new feature → `/poor-dev.specify` with requirements
- If this is expected behavior → Document in project knowledge
- If investigation is incomplete → Gather more data and re-investigate
```

### 6. Classification Recommendation

Based on findings, recommend the appropriate next action:

| Finding Type | Recommended Command |
|--------------|---------------------|
| Confirmed bug | `/poor-dev.bugfix` |
| Missing feature | `/poor-dev.specify` |
| Documentation needed | `/poor-dev.report` |
| Expected behavior | No action (document finding) |
| Inconclusive | Ask user for more context |

## Guidelines

- **Be systematic**: Follow evidence, not assumptions
- **Document uncertainty**: Mark inconclusive findings clearly
- **Avoid premature fixes**: Focus on understanding first
- **Cross-reference**: Link to specific files and line numbers
- **Stay in scope**: Don't drift into tangential issues
