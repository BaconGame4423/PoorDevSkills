#!/usr/bin/env bash
# shellcheck shell=bash
# Usage: source lib/retry-helpers.sh
#
# Provides step-level retry logic for dispatch-step.sh calls.
#
# Functions:
#   dispatch_with_retry <step> <project_dir> <prompt_file> <idle_timeout> <max_timeout> <result_file> [max_retries_override] [pre_retry_hook]
#   log_retry_attempt <step> <attempt> <exit_code> <backoff>
#
# Reads retry config from $CONFIG_FILE (set by caller):
#   { "retry": { "enabled": true, "max_retries": 2, "backoff_seconds": 30 } }

RETRY_HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- dispatch_with_retry ---
#
# Wraps dispatch-step.sh with configurable retry + exponential backoff.
#
# Arguments:
#   $1 step            — step name (e.g. "specify", "implement")
#   $2 project_dir     — project root directory
#   $3 prompt_file     — path to composed prompt file
#   $4 idle_timeout    — per-dispatch idle timeout
#   $5 max_timeout     — per-dispatch max timeout
#   $6 result_file     — path to write dispatch result JSON
#   $7 max_retries_override (optional) — override config max_retries
#   $8 pre_retry_hook  (optional) — function name to call before each retry
#
# Exit code: same as final dispatch-step.sh exit code
#
dispatch_with_retry() {
  local step="$1"
  local project_dir="$2"
  local prompt_file="$3"
  local idle_timeout="$4"
  local max_timeout="$5"
  local result_file="$6"
  local max_retries_override="${7:-}"
  local pre_retry_hook="${8:-}"

  # --- Read retry config ---
  local retry_enabled=true
  local max_retries=2
  local backoff_seconds=30

  if [[ -n "${CONFIG_FILE:-}" && -f "${CONFIG_FILE:-}" ]]; then
    local cfg_enabled cfg_max cfg_backoff
    cfg_enabled=$(jq -r 'if .retry.enabled == false then "false" else "true" end' "$CONFIG_FILE" 2>/dev/null || echo "true")
    cfg_max=$(jq -r '.retry.max_retries // 2' "$CONFIG_FILE" 2>/dev/null || echo "2")
    cfg_backoff=$(jq -r '.retry.backoff_seconds // 30' "$CONFIG_FILE" 2>/dev/null || echo "30")

    # Validate: enabled must be true/false
    if [[ "$cfg_enabled" == "false" ]]; then
      retry_enabled=false
    fi

    # Validate: max_retries 0-10
    if [[ "$cfg_max" =~ ^[0-9]+$ ]] && [[ "$cfg_max" -ge 0 ]] && [[ "$cfg_max" -le 10 ]]; then
      max_retries="$cfg_max"
    else
      echo "{\"warning\":\"retry.max_retries out of range (0-10), using default 2\"}" >&2
      max_retries=2
    fi

    # Validate: backoff_seconds 5-300
    if [[ "$cfg_backoff" =~ ^[0-9]+$ ]] && [[ "$cfg_backoff" -ge 5 ]] && [[ "$cfg_backoff" -le 300 ]]; then
      backoff_seconds="$cfg_backoff"
    else
      echo "{\"warning\":\"retry.backoff_seconds out of range (5-300), using default 30\"}" >&2
      backoff_seconds=30
    fi
  fi

  # Override max_retries if caller specified
  if [[ -n "$max_retries_override" ]]; then
    max_retries="$max_retries_override"
  fi

  # Disable retry if enabled=false or max_retries=0
  if [[ "$retry_enabled" == "false" ]] || [[ "$max_retries" -eq 0 ]]; then
    max_retries=0
  fi

  # --- Dispatch loop ---
  local attempt=0
  local total_attempts=$((max_retries + 1))
  local dispatch_exit=0

  while [[ $attempt -lt $total_attempts ]]; do
    attempt=$((attempt + 1))

    # Pre-retry hook (skip on first attempt)
    if [[ $attempt -gt 1 ]]; then
      if [[ -n "$pre_retry_hook" ]] && declare -F "$pre_retry_hook" > /dev/null 2>&1; then
        "$pre_retry_hook"
      fi
    fi

    # Clean result file before dispatch (needed for is_retryable判定)
    rm -f "$result_file" 2>/dev/null || true

    # --- Execute dispatch ---
    dispatch_exit=0
    bash "$RETRY_HELPERS_DIR/dispatch-step.sh" "$step" "$project_dir" "$prompt_file" \
      "$idle_timeout" "$max_timeout" "$result_file" || dispatch_exit=$?

    # Success → return immediately
    if [[ $dispatch_exit -eq 0 ]]; then
      return 0
    fi

    # --- Determine if retryable ---
    # No more retries left
    if [[ $attempt -ge $total_attempts ]]; then
      return $dispatch_exit
    fi

    # RESULT_FILE not created → permanent failure (dispatch-step validation error) → no retry
    if [[ ! -f "$result_file" ]]; then
      return $dispatch_exit
    fi

    # exit 124 (timeout) → retryable
    # Other non-zero with RESULT_FILE → retryable (transient API error etc.)

    # --- Calculate backoff ---
    local backoff=$((backoff_seconds * (1 << (attempt - 1))))

    # Rate limit detection: double backoff, minimum 60s
    if declare -F check_rate_limit > /dev/null 2>&1; then
      local rate_count
      rate_count=$(check_rate_limit)
      if [[ "$rate_count" -gt 0 ]]; then
        backoff=$((backoff * 2))
        [[ $backoff -lt 60 ]] && backoff=60
      fi
    fi

    # --- Log retry ---
    echo "{\"step\":\"$step\",\"status\":\"retry\",\"attempt\":$attempt,\"exit_code\":$dispatch_exit,\"backoff_seconds\":$backoff,\"max_attempts\":$total_attempts}"
    log_retry_attempt "$step" "$attempt" "$dispatch_exit" "$backoff"

    # --- Wait ---
    sleep "$backoff"
  done

  return $dispatch_exit
}

# --- log_retry_attempt ---
#
# Appends a retry record to pipeline-state.json's "retries" array.
# Skips silently if STATE_FILE is not set or file doesn't exist
# (safe for review-runner subshells).
#
# Arguments:
#   $1 step       — step name
#   $2 attempt    — attempt number
#   $3 exit_code  — dispatch exit code
#   $4 backoff    — backoff seconds applied
#
log_retry_attempt() {
  local step="$1"
  local attempt="$2"
  local exit_code="$3"
  local backoff="$4"

  # Skip if STATE_FILE not set or doesn't exist (review-runner subshell)
  if [[ -z "${STATE_FILE:-}" || ! -f "${STATE_FILE:-}" ]]; then
    return 0
  fi

  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local updated
  updated=$(jq \
    --arg step "$step" \
    --argjson attempt "$attempt" \
    --argjson exit_code "$exit_code" \
    --argjson backoff "$backoff" \
    --arg ts "$ts" \
    '.retries = ((.retries // []) + [{"step": $step, "attempt": $attempt, "exit_code": $exit_code, "backoff": $backoff, "ts": $ts}])' \
    "$STATE_FILE") && echo "$updated" | jq '.' > "$STATE_FILE" || true
}
