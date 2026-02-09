---
description: "Answer questions about the codebase, specifications, and project structure."
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after the command **is** their question. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

### Step 1: Gather Context

Read the following project files to build understanding:

1. `README.md` — project overview
2. `.poor-dev/memory/constitution.md` — project principles
3. `AGENT.md` — workflow documentation (if exists)
4. Scan `specs/` for available spec directories:
   - Read `specs/*/spec.md` — feature specifications
   - Read `specs/*/plan.md` — implementation plans (if exist)

### Step 2: Answer the Question

Using the gathered context, answer `$ARGUMENTS` comprehensively:

- Reference specific file paths and line numbers when citing code
- Quote relevant sections from specs or plans
- If the question is about architecture, trace through the codebase to show how components connect
- If the question is about a specific feature, check both the spec and implementation
- If the question requires information not found in the codebase, state what's missing clearly

### Step 3: Suggest Follow-ups

After answering, briefly suggest 1-2 related questions the user might want to explore next. Keep suggestions concise.

## Guidelines

- **No file modifications** — this command is read-only
- **Be specific** — always include file paths and code references
- **Be honest** — if you don't have enough information, say so rather than guessing
- **Language** — respond in the same language as the user's question
