#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail
# Usage: resume-pipeline.sh --feature-dir <dir> --project-dir <dir>
#
# Resumes the pipeline after spec approval.
# Reads pipeline-state.json to determine flow, branch, and completed steps.
# Launches pipeline-runner.sh in the background (specify already completed).
#
# stdout: JSON { "status": "resumed", "pid": N, "log_path": "..." }
# exit code: 0=success, 1=error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "$SCRIPT_DIR/utils.sh"

# --- Parse arguments ---

FEATURE_DIR=""
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *)             die "Unknown argument: $1" ;;
  esac
done

: "${FEATURE_DIR:?--feature-dir is required}"
: "${PROJECT_DIR:?--project-dir is required}"
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

FD="$PROJECT_DIR/$FEATURE_DIR"
STATE_FILE="$FD/pipeline-state.json"

if [[ ! -f "$STATE_FILE" ]]; then
  die "pipeline-state.json not found in $FD"
fi

# --- Read state ---

STATE=$(cat "$STATE_FILE")
FLOW=$(json_get "$STATE" '.flow')
STATUS=$(json_get "$STATE" '.status')

if [[ "$FLOW" == "null" || -z "$FLOW" ]]; then
  die "Invalid pipeline-state.json: missing flow"
fi

# Get branch
BRANCH=$(cd "$PROJECT_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
if [[ -z "$BRANCH" ]]; then
  die "Cannot determine current branch"
fi

# Clear any pending approval
if [[ "$STATUS" == "awaiting-approval" ]]; then
  bash "$SCRIPT_DIR/pipeline-state.sh" clear-approval "$FD" > /dev/null
fi

# Read summary from input.txt
SUMMARY=""
if [[ -f "$FD/input.txt" ]]; then
  SUMMARY=$(head -1 "$FD/input.txt")
fi

# --- Launch pipeline-runner.sh in background ---

PIPELINE_LOG="$FD/pipeline.log"
PIPELINE_PID_FILE="$FD/pipeline.pid"

nohup bash "$SCRIPT_DIR/pipeline-runner.sh" \
  --flow "$FLOW" \
  --feature-dir "$FEATURE_DIR" \
  --branch "$BRANCH" \
  --project-dir "$PROJECT_DIR" \
  --summary "$SUMMARY" > "$PIPELINE_LOG" 2>&1 &
PIPELINE_PID=$!
echo "$PIPELINE_PID" > "$PIPELINE_PID_FILE"

jq -n \
  --arg status "resumed" \
  --argjson pid "$PIPELINE_PID" \
  --arg log_path "$PIPELINE_LOG" \
  --arg flow "$FLOW" \
  --arg feature_dir "$FEATURE_DIR" \
  '{ status: $status, pid: $pid, log_path: $log_path, flow: $flow, feature_dir: $feature_dir }'
