#!/usr/bin/env bash
set -euo pipefail
# Usage: compose-prompt.sh <command_file> <output_file> [--header non_interactive] [--header readonly] [--context key=file ...]
#
# Composes a dispatch prompt from a command template file.
#
# Processing:
#   1. Reads command_file
#   2. Strips YAML frontmatter (first --- to next ---)
#   3. Prepends specified headers (Single Source of Truth)
#   4. Appends --context key=file contents
#   5. Writes result to output_file
#
# Context files >10KB are truncated to first 200 lines.
# Missing context files are skipped with a stderr warning.

COMMAND_FILE="${1:?Usage: compose-prompt.sh <command_file> <output_file> [--header ...] [--context key=file ...]}"
OUTPUT_FILE="${2:?Usage: compose-prompt.sh <command_file> <output_file> [--header ...] [--context key=file ...]}"
shift 2

# --- Header definitions (Single Source of Truth) ---

NON_INTERACTIVE_HEADER='## Mode: NON_INTERACTIVE (pipeline sub-agent)
- No AskUserQuestion → use [NEEDS CLARIFICATION: ...] markers
- No Gate Check, Dashboard Update, handoffs, EnterPlanMode/ExitPlanMode
- Output progress: [PROGRESS: ...] / [REVIEW-PROGRESS: ...]
- If blocked → [ERROR: description] and stop
- File scope: FEATURE_DIR + project source only. NEVER modify: agents/, commands/, lib/, .poor-dev/, .opencode/command/, .opencode/agents/, .claude/agents/, .claude/commands/
- Git 操作制限: commit は許可、push は絶対に禁止（git push, git push origin 等すべて）
- Shell infrastructure: mkdir・ディレクトリ作成・/tmp/ 操作は禁止。/tmp/ ファイルは poll-dispatch.sh が自動管理する
- End with: files created/modified, unresolved items'

READONLY_HEADER='## Read-Only Execution Mode
You have READ-ONLY tool access (Edit, Write, Bash, NotebookEdit are disabled).
- Output the spec draft as plain markdown text in your response.
- First line MUST be: `[BRANCH: suggested-short-name]`
- The rest of your output is the spec draft content (using the Spec Template).
- Include `[NEEDS CLARIFICATION: question]` markers inline as needed (max 3).
- Do NOT attempt to create branches, directories, or files.'

# --- Parse arguments ---

HEADERS=()
CONTEXTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --header)
      HEADERS+=("$2")
      shift 2
      ;;
    --context)
      CONTEXTS+=("$2")
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# --- Validate command file ---

if [[ ! -f "$COMMAND_FILE" ]]; then
  echo "Error: Command file not found: $COMMAND_FILE" >&2
  exit 1
fi

# --- Build output ---

{
  # 1. Prepend headers
  for header_name in "${HEADERS[@]}"; do
    case "$header_name" in
      non_interactive)
        echo "$NON_INTERACTIVE_HEADER"
        echo ""
        ;;
      readonly)
        echo "$READONLY_HEADER"
        echo ""
        ;;
      *)
        echo "Warning: Unknown header '$header_name', skipped" >&2
        ;;
    esac
  done

  # 2. Read command file, strip YAML frontmatter
  awk '
    BEGIN { in_front = 0; front_done = 0; dash_count = 0 }
    /^---\s*$/ {
      if (!front_done) {
        dash_count++
        if (dash_count == 1) { in_front = 1; next }
        if (dash_count == 2) { in_front = 0; front_done = 1; next }
      }
    }
    { if (!in_front) print }
  ' "$COMMAND_FILE"

  # 3. Append context files
  for ctx in "${CONTEXTS[@]}"; do
    local_key="${ctx%%=*}"
    local_file="${ctx#*=}"

    if [[ "$local_key" == "$ctx" ]]; then
      echo "Warning: Invalid context format '$ctx' (expected key=file), skipped" >&2
      continue
    fi

    if [[ ! -f "$local_file" ]]; then
      echo "Warning: Context file not found: $local_file (key=$local_key), skipped" >&2
      continue
    fi

    echo ""
    echo "## Context: $local_key"
    echo ""

    local_size=$(wc -c < "$local_file")
    if [[ "$local_size" -gt 10240 ]]; then
      head -200 "$local_file"
      echo ""
      echo "[TRUNCATED: file exceeds 10KB, showing first 200 lines]"
    else
      cat "$local_file"
    fi
  done

} > "$OUTPUT_FILE"
