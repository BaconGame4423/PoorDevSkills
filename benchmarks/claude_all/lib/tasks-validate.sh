#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: tasks-validate.sh <tasks.md path>
#
# Validates tasks.md format and checks for issues:
#   1. Checklist syntax validation (- [ ] [TXXX] pattern)
#   2. depends reference existence check
#   3. files glob overlap detection within parallel groups
#
# stdout: JSON { "valid": true/false, "errors": [...], "warnings": [...], "stats": {...} }
# exit code: 0=valid, 1=invalid, 2=warnings only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"

TASKS_FILE="${1:?Usage: tasks-validate.sh <tasks.md path>}"

if [[ ! -f "$TASKS_FILE" ]]; then
  die "Tasks file not found: $TASKS_FILE"
fi

ERRORS=()
WARNINGS=()

# --- Collect all task IDs ---

declare -A TASK_IDS
declare -A TASK_FILES
declare -A TASK_PARALLEL

TASK_COUNT=0
BAD_FORMAT_COUNT=0

while IFS= read -r line; do
  # Match task lines: - [ ] [TXXX] or - [X] [TXXX]
  if [[ "$line" =~ ^[[:space:]]*-[[:space:]]\[[[:space:]Xx]\][[:space:]]\[([A-Z][0-9]+)\] ]]; then
    TASK_ID="${BASH_REMATCH[1]}"
    TASK_IDS["$TASK_ID"]=1
    TASK_COUNT=$((TASK_COUNT + 1))

    # Check for parallel marker
    if [[ "$line" =~ \[P(:[a-z][a-z0-9-]*)?\] ]]; then
      GROUP="${BASH_REMATCH[1]:-:default}"
      GROUP="${GROUP#:}"
      TASK_PARALLEL["$TASK_ID"]="$GROUP"
    fi

  elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]\[[[:space:]Xx]\][[:space:]] ]] && [[ ! "$line" =~ \[[A-Z][0-9]+\] ]]; then
    # Task line without proper ID
    BAD_FORMAT_COUNT=$((BAD_FORMAT_COUNT + 1))
    ERRORS+=("Missing task ID in line: $(echo "$line" | head -c 80)")
  fi

  # Collect files metadata
  if [[ "$line" =~ ^[[:space:]]+-[[:space:]]files:[[:space:]]*(.*) ]]; then
    FILES_VAL="${BASH_REMATCH[1]}"
    # Associate with most recent task ID
    if [[ -n "${TASK_ID:-}" ]]; then
      TASK_FILES["$TASK_ID"]="$FILES_VAL"
    fi
  fi

  # Check depends references
  if [[ "$line" =~ ^[[:space:]]+-[[:space:]]depends:[[:space:]]*\[(.*)\] ]]; then
    DEPS_VAL="${BASH_REMATCH[1]}"
    IFS=',' read -ra DEP_ARRAY <<< "$DEPS_VAL"
    for dep in "${DEP_ARRAY[@]}"; do
      dep=$(echo "$dep" | xargs)  # trim
      if [[ -n "$dep" ]]; then
        # Will validate after collecting all IDs
        : # placeholder
      fi
    done
  fi
done < "$TASKS_FILE"

# --- Second pass: validate depends references ---

while IFS= read -r line; do
  if [[ "$line" =~ ^[[:space:]]+-[[:space:]]depends:[[:space:]]*\[(.*)\] ]]; then
    DEPS_VAL="${BASH_REMATCH[1]}"
    IFS=',' read -ra DEP_ARRAY <<< "$DEPS_VAL"
    for dep in "${DEP_ARRAY[@]}"; do
      dep=$(echo "$dep" | xargs)
      if [[ -n "$dep" && -z "${TASK_IDS[$dep]:-}" ]]; then
        ERRORS+=("depends reference to non-existent task: $dep")
      fi
    done
  fi
done < "$TASKS_FILE"

# --- Check parallel group file overlaps ---

declare -A GROUP_FILES
for task_id in "${!TASK_PARALLEL[@]}"; do
  group="${TASK_PARALLEL[$task_id]}"
  files="${TASK_FILES[$task_id]:-}"
  if [[ -z "$files" && -n "$group" ]]; then
    WARNINGS+=("Task $task_id has [P] marker but no files: metadata")
  fi
  if [[ -n "$files" ]]; then
    # Collect files per group for overlap detection
    existing="${GROUP_FILES[$group]:-}"
    if [[ -n "$existing" ]]; then
      GROUP_FILES["$group"]="$existing|$task_id:$files"
    else
      GROUP_FILES["$group"]="$task_id:$files"
    fi
  fi
done

# Simple overlap detection: check if any glob prefix matches another
for group in "${!GROUP_FILES[@]}"; do
  IFS='|' read -ra ENTRIES <<< "${GROUP_FILES[$group]}"
  for ((i=0; i<${#ENTRIES[@]}; i++)); do
    for ((j=i+1; j<${#ENTRIES[@]}; j++)); do
      ID_I="${ENTRIES[$i]%%:*}"
      FILES_I="${ENTRIES[$i]#*:}"
      ID_J="${ENTRIES[$j]%%:*}"
      FILES_J="${ENTRIES[$j]#*:}"

      # Check for obvious overlaps (same prefix)
      IFS=',' read -ra GLOBS_I <<< "$FILES_I"
      IFS=',' read -ra GLOBS_J <<< "$FILES_J"
      for gi in "${GLOBS_I[@]}"; do
        gi=$(echo "$gi" | xargs)
        for gj in "${GLOBS_J[@]}"; do
          gj=$(echo "$gj" | xargs)
          # Simple check: if one glob is a prefix of another
          if [[ "$gi" == "$gj" ]] || \
             [[ "${gi%/**}" == "${gj%/**}" && "$gi" == *"/**" && "$gj" == *"/**" ]]; then
            WARNINGS+=("Potential file overlap in parallel group '$group': $ID_I ($gi) vs $ID_J ($gj)")
          fi
        done
      done
    done
  done
done

# --- Phase count ---

PHASE_COUNT=$(grep -c '^## Phase' "$TASKS_FILE" 2>/dev/null || echo 0)

# --- Output ---

VALID=true
EXIT_CODE=0
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  VALID=false
  EXIT_CODE=1
elif [[ ${#WARNINGS[@]} -gt 0 ]]; then
  EXIT_CODE=0  # warnings don't fail
fi

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERRORS_JSON=$(printf '%s\n' "${ERRORS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
else
  ERRORS_JSON='[]'
fi
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARNINGS_JSON=$(printf '%s\n' "${WARNINGS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
else
  WARNINGS_JSON='[]'
fi

jq -n \
  --argjson valid "$VALID" \
  --argjson errors "$ERRORS_JSON" \
  --argjson warnings "$WARNINGS_JSON" \
  --argjson task_count "$TASK_COUNT" \
  --argjson bad_format "$BAD_FORMAT_COUNT" \
  --argjson phase_count "$PHASE_COUNT" \
  '{
    valid: $valid,
    errors: $errors,
    warnings: $warnings,
    stats: {
      tasks: $task_count,
      bad_format: $bad_format,
      phases: $phase_count
    }
  }'

exit $EXIT_CODE
