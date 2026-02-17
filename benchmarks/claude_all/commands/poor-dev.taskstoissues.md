---
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. Determine the feature directory from the current branch:
   - Get current branch: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   - Extract numeric prefix
   - Find matching directory: `FEATURE_DIR=$(ls -d specs/${PREFIX}-* 2>/dev/null | head -1)`
   - Set derived paths and verify tasks.md exists
   - If not found, show error — suggest running `/poor-dev.tasks` first
1. Extract the path to **tasks**: `TASKS=$FEATURE_DIR/tasks.md`
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL
