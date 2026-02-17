#!/usr/bin/env bash
# shellcheck shell=bash
# Usage: source lib/utils.sh
#
# Common utilities for poor-dev bash scripts.
# All scripts in lib/ should source this file.
#
# Provides:
#   json_get <json> <jq_expr>         — Extract value from JSON
#   json_get_or <json> <jq_expr> <default> — Extract with default
#   die <message> [exit_code]         — Error exit with JSON stderr
#   make_temp <prefix>                — Create temp file with cleanup
#   read_config <project_dir>         — Read .poor-dev/config.json
#   cleanup_temp_files                — Remove registered temp files

# --- JSON helpers ---

json_get() {
  echo "$1" | jq -r "$2" 2>/dev/null
}

json_get_or() {
  local result
  result=$(echo "$1" | jq -r "$2 // \"$3\"" 2>/dev/null)
  if [[ -z "$result" || "$result" == "null" ]]; then
    echo "$3"
  else
    echo "$result"
  fi
}

# --- Error output ---

die() {
  echo "{\"error\":\"$1\"}" >&2
  exit "${2:-1}"
}

# --- Temp file management ---

_POOR_DEV_TEMP_FILES=()

make_temp() {
  local prefix="${1:-poor-dev}"
  local tmp
  tmp=$(mktemp "/tmp/poor-dev-${prefix}-$$.XXXXXX")
  _POOR_DEV_TEMP_FILES+=("$tmp")
  echo "$tmp"
}

cleanup_temp_files() {
  for f in "${_POOR_DEV_TEMP_FILES[@]}"; do
    rm -f "$f" 2>/dev/null || true
  done
}

# --- Config ---

read_config() {
  local project_dir="$1"
  cat "$project_dir/.poor-dev/config.json" 2>/dev/null || echo '{}'
}
