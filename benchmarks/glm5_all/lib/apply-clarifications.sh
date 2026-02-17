#!/usr/bin/env bash
set -euo pipefail
# Usage: apply-clarifications.sh <feature_dir> <<< "user answers"
#
# Reads pending-clarifications.json from the feature directory,
# appends a ## Clarifications section to spec.md with the user's answers,
# then removes pending-clarifications.json.
#
# stdin:  User's answer text (free-form)
# stdout: JSON result object

FEATURE_DIR="${1:?Usage: apply-clarifications.sh <feature_dir>}"

PENDING_FILE="$FEATURE_DIR/pending-clarifications.json"
SPEC_FILE="$FEATURE_DIR/spec.md"

# --- Validate inputs ---

if [[ ! -f "$PENDING_FILE" ]]; then
  echo "{\"error\":\"no pending-clarifications.json found\",\"feature_dir\":\"$FEATURE_DIR\"}"
  exit 1
fi

if [[ ! -f "$SPEC_FILE" ]]; then
  echo "{\"error\":\"no spec.md found\",\"feature_dir\":\"$FEATURE_DIR\"}"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo '{"error":"jq is required but not installed"}'
  exit 1
fi

# --- Read user answers from stdin ---

USER_ANSWERS="$(cat)"

if [[ -z "$USER_ANSWERS" ]]; then
  echo "{\"error\":\"no answers provided on stdin\"}"
  exit 1
fi

# --- Build clarifications section ---

TODAY=$(date +"%Y-%m-%d")
QUESTION_COUNT=$(jq -r 'length' "$PENDING_FILE" 2>/dev/null || echo "0")

{
  echo ""
  echo "## Clarifications"
  echo ""
  echo "### $TODAY"
  echo ""
  echo "**Questions:**"
  echo ""
  jq -r 'to_entries[] | "  \(.key + 1). \(.value)"' "$PENDING_FILE" 2>/dev/null | sed 's/\[NEEDS CLARIFICATION: //;s/\]$//'
  echo ""
  echo "**Answers:**"
  echo ""
  echo "$USER_ANSWERS"
  echo ""
} >> "$SPEC_FILE"

# --- Cleanup ---

rm -f "$PENDING_FILE"

# --- Clear approval state ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/pipeline-state.sh" ]]; then
  bash "$SCRIPT_DIR/pipeline-state.sh" clear-approval "$FEATURE_DIR" > /dev/null 2>&1 || true
fi

# --- Output result ---

echo "{\"status\":\"applied\",\"questions\":$QUESTION_COUNT,\"spec\":\"$SPEC_FILE\"}"
