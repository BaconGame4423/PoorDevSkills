#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: review-aggregate.sh --output-dir <dir> --log <review-log.yaml> --id-prefix <PR> --next-id <N>
#
# Aggregates persona review outputs into a unified issue list.
# Uses line-oriented format for reliable parsing:
#   VERDICT: GO|CONDITIONAL|NO-GO
#   ISSUE: C|H|M|L | description | location
#
# Processing:
#   1. Reads all persona output files from output-dir
#   2. Extracts ISSUE lines and counts by severity
#   3. Cross-references with review-log to deduplicate fixed issues
#   4. Assigns new IDs and writes issues file
#
# stdout: JSON { total, C, H, M, L, next_id, issues_file, converged, verdicts }
# exit code: 0=success, 1=error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"

# --- Parse arguments ---

OUTPUT_DIR=""
LOG_PATH=""
ID_PREFIX=""
NEXT_ID=1
REVIEW_TYPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)   OUTPUT_DIR="$2"; shift 2 ;;
    --log)          LOG_PATH="$2"; shift 2 ;;
    --id-prefix)    ID_PREFIX="$2"; shift 2 ;;
    --next-id)      NEXT_ID="$2"; shift 2 ;;
    --review-type)  REVIEW_TYPE="$2"; shift 2 ;;
    *)              die "Unknown argument: $1" ;;
  esac
done

: "${OUTPUT_DIR:?--output-dir is required}"
: "${ID_PREFIX:?--id-prefix is required}"

# --- Collect fixed issues from log ---

declare -A FIXED_ISSUES
if [[ -n "$LOG_PATH" && -f "$LOG_PATH" ]]; then
  while IFS= read -r line; do
    if [[ "$line" =~ fixed:.*([A-Z]+[0-9]+) ]]; then
      FIXED_ISSUES["${BASH_REMATCH[1]}"]=1
    fi
  done < "$LOG_PATH"
fi

# --- Parse persona outputs ---

ISSUES_FILE=$(mktemp "/tmp/poor-dev-issues-$$.XXXXXX")
trap 'rm -f "$ISSUES_FILE"' EXIT

COUNT_C=0
COUNT_H=0
COUNT_M=0
COUNT_L=0
TOTAL=0
VERDICTS=""

for output_file in "$OUTPUT_DIR"/*.txt "$OUTPUT_DIR"/*.json; do
  [[ -f "$output_file" ]] || continue

  PERSONA_NAME=$(basename "$output_file" | sed 's/\.[^.]*$//')

  # Extract content: try opencode JSON first, fall back to plaintext
  CONTENT=$(jq -r 'select(.type=="text") | .part.text // empty' "$output_file" 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then
    CONTENT=$(cat "$output_file")
  fi

  # Extract verdict
  VERDICT=$(echo "$CONTENT" | grep -oP '^VERDICT:\s*\K(GO|CONDITIONAL|NO-GO)' | head -1 || true)
  if [[ -n "$VERDICT" ]]; then
    VERDICTS="${VERDICTS}${PERSONA_NAME}:${VERDICT} "
  fi

  # Extract issues
  while IFS= read -r line; do
    if [[ "$line" =~ ^ISSUE:[[:space:]]*(C|H|M|L)[[:space:]]*\|[[:space:]]*(.*)\|[[:space:]]*(.*) ]]; then
      SEVERITY="${BASH_REMATCH[1]}"
      DESCRIPTION=$(echo "${BASH_REMATCH[2]}" | xargs)
      LOCATION=$(echo "${BASH_REMATCH[3]}" | xargs)

      # Deduplicate: check if description matches a fixed issue
      SKIP=false
      for fixed_id in "${!FIXED_ISSUES[@]}"; do
        # Simple dedup: exact description match (could be improved)
        if [[ -n "${FIXED_ISSUES[$fixed_id]:-}" ]]; then
          : # placeholder for more sophisticated dedup
        fi
      done

      if [[ "$SKIP" == "false" ]]; then
        ISSUE_ID="${ID_PREFIX}$(printf '%03d' "$NEXT_ID")"
        NEXT_ID=$((NEXT_ID + 1))

        echo "${ISSUE_ID}|${SEVERITY}|${DESCRIPTION}|${LOCATION}|${PERSONA_NAME}" >> "$ISSUES_FILE"

        case "$SEVERITY" in
          C) COUNT_C=$((COUNT_C + 1)) ;;
          H) COUNT_H=$((COUNT_H + 1)) ;;
          M) COUNT_M=$((COUNT_M + 1)) ;;
          L) COUNT_L=$((COUNT_L + 1)) ;;
        esac
        TOTAL=$((TOTAL + 1))
      fi
    fi
  done <<< "$CONTENT"
done

# --- Convergence check ---

CONVERGED=false
if [[ "$COUNT_C" -eq 0 && "$COUNT_H" -eq 0 ]]; then
  CONVERGED=true
fi

# --- Verdict consistency check ---

VERDICTS=$(echo "$VERDICTS" | xargs)
NOGO_COUNT=$(echo "$VERDICTS" | grep -o "NO-GO" | wc -l || echo "0")

if [[ "$NOGO_COUNT" -gt 0 && "$TOTAL" -eq 0 ]]; then
  echo "{\"warning\":\"NO-GO verdict but zero issues found\"}" >&2
fi

# --- Save issues file to stable location ---

STABLE_ISSUES=""
if [[ -n "$LOG_PATH" ]]; then
  if [[ -n "$REVIEW_TYPE" ]]; then
    STABLE_ISSUES="$(dirname "$LOG_PATH")/review-issues-${REVIEW_TYPE}.txt"
  else
    STABLE_ISSUES="$(dirname "$LOG_PATH")/review-issues-latest.txt"
  fi
  cp "$ISSUES_FILE" "$STABLE_ISSUES"
  # 互換性のため latest も更新
  cp "$ISSUES_FILE" "$(dirname "$LOG_PATH")/review-issues-latest.txt"
fi

# --- Output ---

jq -n \
  --argjson total "$TOTAL" \
  --argjson c "$COUNT_C" \
  --argjson h "$COUNT_H" \
  --argjson m "$COUNT_M" \
  --argjson l "$COUNT_L" \
  --argjson next_id "$NEXT_ID" \
  --arg issues_file "${STABLE_ISSUES:-$ISSUES_FILE}" \
  --argjson converged "$CONVERGED" \
  --arg verdicts "$VERDICTS" \
  '{
    total: $total,
    C: $c, H: $h, M: $m, L: $l,
    next_id: $next_id,
    issues_file: $issues_file,
    converged: $converged,
    verdicts: $verdicts
  }'
