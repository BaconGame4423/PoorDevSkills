#!/usr/bin/env bash
set -euo pipefail
# Usage: config-resolver.sh <step> [<config_path>]
# Resolves CLI/model for a pipeline step using the 5-level resolution chain.
#
# stdout: JSON { "cli": "opencode|claude", "model": "..." }
#
# Resolution chain (first match wins):
#   1. overrides.${STEP}
#   2. overrides.${CATEGORY}  (STEP minus last hyphen segment)
#   3. step_tiers.${STEP} → tiers[tier_name]
#   4. default
#   5. hardcoded: {"cli":"claude","model":"sonnet"}

if ! command -v jq >/dev/null 2>&1; then
  echo '{"error":"jq is required but not installed"}' >&2
  exit 1
fi

STEP="${1:?Usage: config-resolver.sh <step> [config_path]}"
CONFIG_PATH="${2:-.poor-dev/config.json}"

# Read config (empty object if missing)
if [ -f "$CONFIG_PATH" ]; then
  CONFIG=$(cat "$CONFIG_PATH")
else
  CONFIG='{}'
fi

# Derive category: strip last hyphen segment (e.g., planreview-pm → planreview)
if [[ "$STEP" == *-* ]]; then
  CATEGORY="${STEP%-*}"
else
  CATEGORY="$STEP"
fi

# 5-level resolution chain via single jq call
RESULT=$(echo "$CONFIG" | jq -r --arg step "$STEP" --arg cat "$CATEGORY" '
  # Level 1: overrides.<step>
  if .overrides[$step] != null and .overrides[$step].cli != null then
    .overrides[$step]
  # Level 2: overrides.<category>
  elif .overrides[$cat] != null and .overrides[$cat].cli != null then
    .overrides[$cat]
  # Level 3: step_tiers.<step> → tiers[tier]
  elif .step_tiers[$step] != null then
    (.step_tiers[$step]) as $tier |
    if .tiers[$tier] != null and .tiers[$tier].cli != null then
      .tiers[$tier]
    elif .default != null and .default.cli != null then
      .default  # tier undefined → fallback to default
    else
      {"cli":"claude","model":"sonnet"}
    end
  # Level 4: default
  elif .default != null and .default.cli != null then
    .default
  # Level 5: hardcoded
  else
    {"cli":"claude","model":"sonnet"}
  end
  | {"cli": .cli, "model": .model}
')

echo "$RESULT"
