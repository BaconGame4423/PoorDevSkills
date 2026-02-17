#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: extract-output.sh <output_file> <save_to>
#
# Extracts content from dispatch output and saves to target file.
# Handles both opencode JSON format and claude plaintext format.
#
# Supported formats:
#   1. opencode JSON lines (.part.text field)
#   2. claude plaintext (as-is)
#   3. markdown code fence content (```...```)
#
# Processing:
#   - Strips [BRANCH: ...] metadata lines
#   - Validates output is non-empty
#
# stdout: JSON { "status": "ok"|"error", "bytes": N, "format": "opencode"|"plaintext" }
# exit code: 0=success, 1=error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"

OUTPUT_FILE="${1:?Usage: extract-output.sh <output_file> <save_to>}"
SAVE_TO="${2:?Usage: extract-output.sh <output_file> <save_to>}"

if [[ ! -f "$OUTPUT_FILE" ]]; then
  die "Output file not found: $OUTPUT_FILE"
fi

if [[ ! -s "$OUTPUT_FILE" ]]; then
  die "Output file is empty: $OUTPUT_FILE"
fi

# Ensure target directory exists
mkdir -p "$(dirname "$SAVE_TO")"

FORMAT="unknown"

# Strategy 1: opencode JSON format (.part.text)
EXTRACTED=$(jq -r 'select(.type=="text") | .part.text // empty' "$OUTPUT_FILE" 2>/dev/null || true)
if [[ -n "$EXTRACTED" ]]; then
  FORMAT="opencode"
  echo "$EXTRACTED" | sed '/^\[BRANCH:/d' > "$SAVE_TO"
else
  # Strategy 2: plaintext (claude CLI or raw output)
  FORMAT="plaintext"
  sed '/^\[BRANCH:/d' "$OUTPUT_FILE" > "$SAVE_TO"
fi

# Validate result
if [[ ! -s "$SAVE_TO" ]]; then
  die "Extraction produced empty file: $SAVE_TO"
fi

BYTES=$(wc -c < "$SAVE_TO")
echo "{\"status\":\"ok\",\"bytes\":$BYTES,\"format\":\"$FORMAT\"}"
