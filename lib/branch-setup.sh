#!/usr/bin/env bash
set -euo pipefail
# Usage: branch-setup.sh <short-name>
#
# Creates a feature branch and specs directory with auto-numbered prefix.
#
# Processing:
#   1. git fetch --all --prune
#   2. Finds highest numeric prefix N across remote/local branches and specs/
#   3. Creates branch (N+1)-short-name and directory specs/(N+1)-short-name
#
# stdout: JSON { "number": "NNN", "branch": "NNN-short-name", "feature_dir": "specs/NNN-short-name" }
# exit code: 0=success, 1=error

SHORT_NAME="${1:?Usage: branch-setup.sh <short-name>}"

# --- Fetch latest ---

git fetch --all --prune 2>/dev/null || true

# --- Find highest number across all sources ---

MAX_N=0

# Remote branches
while IFS= read -r line; do
  num=$(echo "$line" | sed -n 's|.*/\([0-9]\{1,\}\)-.*|\1|p')
  if [[ -n "$num" ]]; then
    num=$((10#$num))  # strip leading zeros
    [[ $num -gt $MAX_N ]] && MAX_N=$num
  fi
done < <(git branch -r 2>/dev/null || true)

# Local branches
while IFS= read -r line; do
  num=$(echo "$line" | sed -n 's|^[* ]*\([0-9]\{1,\}\)-.*|\1|p')
  if [[ -n "$num" ]]; then
    num=$((10#$num))
    [[ $num -gt $MAX_N ]] && MAX_N=$num
  fi
done < <(git branch 2>/dev/null || true)

# specs/ directories
if [[ -d "specs" ]]; then
  for d in specs/*/; do
    [[ -d "$d" ]] || continue
    base=$(basename "$d")
    num=$(echo "$base" | sed -n 's|^\([0-9]\{1,\}\)-.*|\1|p')
    if [[ -n "$num" ]]; then
      num=$((10#$num))
      [[ $num -gt $MAX_N ]] && MAX_N=$num
    fi
  done
fi

# --- Compute new number ---

NEW_N=$((MAX_N + 1))
NUMBER=$(printf "%03d" "$NEW_N")
BRANCH="${NUMBER}-${SHORT_NAME}"
FEATURE_DIR="specs/${BRANCH}"

# --- Check for conflicts ---

if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
  echo "Error: Branch '$BRANCH' already exists" >&2
  exit 1
fi

# --- Create branch and directory ---

git checkout -b "$BRANCH" || {
  echo "Error: Failed to create branch '$BRANCH'" >&2
  exit 1
}

mkdir -p "$FEATURE_DIR"

# --- Output JSON ---

jq -n \
  --arg number "$NUMBER" \
  --arg branch "$BRANCH" \
  --arg feature_dir "$FEATURE_DIR" \
  '{"number": $number, "branch": $branch, "feature_dir": $feature_dir}'
