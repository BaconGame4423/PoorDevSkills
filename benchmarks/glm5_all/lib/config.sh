#!/usr/bin/env bash
set -euo pipefail
# Usage: config.sh <subcommand> [args...]
#
# Manages .poor-dev/config.json — all JSON operations for poor-dev.config.
#
# Subcommands:
#   show                                    — Display config table
#   default <cli> <model>                   — Set default cli/model
#   set <key> <cli> <model>                 — Set override
#   unset <key>                             — Remove override
#   tier <name> <cli> <model>               — Set tier definition
#   tier-unset <name>                       — Remove tier
#   step-tier <step> <tier>                 — Assign tier to step
#   step-tier-unset <step>                  — Remove step tier
#   depth <auto|deep|standard|light>        — Set review depth
#   speculation <on|off>                    — Toggle speculation
#   parallel <on|off|auto|same-branch|worktree|phase-split> — Set parallel
#   reset                                   — Reset to defaults

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

CONFIG_DIR=".poor-dev"
CONFIG_FILE="${CONFIG_DIR}/config.json"

# Valid keys
VALID_CATEGORIES="planreview tasksreview architecturereview qualityreview phasereview fixer"
VALID_AGENTS="planreview-pm planreview-risk planreview-value planreview-critical tasksreview-techlead tasksreview-senior tasksreview-devops tasksreview-junior architecturereview-architect architecturereview-security architecturereview-performance architecturereview-sre qualityreview-qa qualityreview-testdesign qualityreview-code qualityreview-security phasereview-qa phasereview-regression phasereview-docs phasereview-ux review-fixer"
VALID_STEPS="specify suggest plan planreview tasks tasksreview implement architecturereview qualityreview phasereview"
VALID_CLIS="claude opencode"
VALID_CLAUDE_MODELS="haiku sonnet opus"
VALID_DEPTHS="auto deep standard light"

DEFAULT_CONFIG='{
  "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" },
  "overrides": {
    "fixer": { "cli": "claude", "model": "sonnet" },
    "phasereview": { "cli": "claude", "model": "haiku" }
  },
  "tiers": {
    "T1": { "cli": "claude", "model": "sonnet" },
    "T2": { "cli": "opencode", "model": "minimax-m2.5" },
    "T3": { "cli": "opencode", "model": "minimax-m2.5-lightning" }
  },
  "step_tiers": {
    "specify": "T2", "suggest": "T3", "plan": "T1",
    "planreview": "T2", "tasks": "T2", "tasksreview": "T2",
    "implement": "T2", "architecturereview": "T2",
    "qualityreview": "T2", "phasereview": "T2"
  },
  "review_depth": "auto",
  "speculation": { "enabled": true, "pairs": { "specify": "suggest" } },
  "parallel": { "enabled": true, "strategy": "auto", "max_concurrent": 3 }
}'

# --- Helpers ---

read_config() {
  if [ -f "$CONFIG_FILE" ]; then
    cat "$CONFIG_FILE"
  else
    mkdir -p "$CONFIG_DIR"
    echo "$DEFAULT_CONFIG" | jq '.' > "$CONFIG_FILE"
    cat "$CONFIG_FILE"
  fi
}

write_config() {
  mkdir -p "$CONFIG_DIR"
  echo "$1" | jq '.' > "$CONFIG_FILE"
}

validate_cli() {
  local cli="$1"
  if ! echo "$VALID_CLIS" | tr ' ' '\n' | grep -qx "$cli"; then
    echo "Error: Invalid CLI '$cli'. Valid: $VALID_CLIS" >&2
    return 1
  fi
}

validate_model() {
  local cli="$1" model="$2"
  if [ "$cli" = "claude" ]; then
    if ! echo "$VALID_CLAUDE_MODELS" | tr ' ' '\n' | grep -qx "$model"; then
      echo "Error: Invalid Claude model '$model'. Valid: $VALID_CLAUDE_MODELS" >&2
      return 1
    fi
  fi
  # opencode models: accept any value (dynamic)
}

validate_key() {
  local key="$1"
  if ! echo "$VALID_CATEGORIES $VALID_AGENTS" | tr ' ' '\n' | grep -qx "$key"; then
    echo "Error: Invalid key '$key'." >&2
    echo "Valid categories: $VALID_CATEGORIES" >&2
    echo "Valid agents: $VALID_AGENTS" >&2
    return 1
  fi
}

validate_step() {
  local step="$1"
  if ! echo "$VALID_STEPS" | tr ' ' '\n' | grep -qx "$step"; then
    echo "Error: Invalid step '$step'. Valid: $VALID_STEPS" >&2
    return 1
  fi
}

# Resolve a single step/key to its effective cli/model + source
resolve_one() {
  local cfg="$1" key="$2"
  echo "$cfg" | jq -r --arg key "$key" '
    # Derive category
    ($key | split("-") | .[0]) as $cat |
    if .overrides[$key] != null then
      "\(.overrides[$key].cli)\t\(.overrides[$key].model)\toverride"
    elif .overrides[$cat] != null and ($cat != $key) then
      "\(.overrides[$cat].cli)\t\(.overrides[$cat].model)\toverride(\($cat))"
    elif .step_tiers[$key] != null then
      .step_tiers[$key] as $tier |
      if .tiers[$tier] != null then
        "\(.tiers[$tier].cli)\t\(.tiers[$tier].model)\tstep_tier(\($tier))"
      else
        "\(.default.cli)\t\(.default.model)\tdefault(tier \($tier) undefined)"
      end
    elif .default != null then
      "\(.default.cli)\t\(.default.model)\tdefault"
    else
      "claude\tsonnet\thardcoded"
    end
  '
}

# --- Subcommands ---

cmd_show() {
  local cfg
  cfg=$(read_config)

  # Default
  local def_cli def_model
  def_cli=$(echo "$cfg" | jq -r '.default.cli // "claude"')
  def_model=$(echo "$cfg" | jq -r '.default.model // "sonnet"')
  echo "Default: $def_cli / $def_model"
  echo ""

  # Tiers
  echo "Tiers:"
  echo "$cfg" | jq -r '.tiers // {} | to_entries[] | "  \(.key): \(.value.cli) / \(.value.model)"'
  echo ""

  # Step table
  printf "%-20s %-6s %-10s %-30s %s\n" "Step" "Tier" "CLI" "Model" "Source"
  printf "%s\n" "$(printf '%.0s-' {1..80})"
  for step in $VALID_STEPS; do
    local tier resolved cli model source
    tier=$(echo "$cfg" | jq -r --arg s "$step" '.step_tiers[$s] // "—"')
    resolved=$(resolve_one "$cfg" "$step")
    cli=$(echo "$resolved" | cut -f1)
    model=$(echo "$resolved" | cut -f2)
    source=$(echo "$resolved" | cut -f3)
    printf "%-20s %-6s %-10s %-30s (%s)\n" "$step" "$tier" "$cli" "$model" "$source"
  done

  # Overrides (non-step keys)
  local has_overrides
  has_overrides=$(echo "$cfg" | jq '[.overrides // {} | keys[] | select(. as $k | ["'$(echo $VALID_STEPS | sed 's/ /","/g')'"] | index($k) | not)] | length')
  if [ "$has_overrides" -gt 0 ]; then
    echo ""
    echo "Overrides (non-step):"
    echo "$cfg" | jq -r --argjson steps '["'$(echo $VALID_STEPS | sed 's/ /","/g')'"]' '
      .overrides // {} | to_entries[] | select(.key as $k | $steps | index($k) | not) |
      "  \(.key): \(.value.cli) / \(.value.model)"
    '
  fi

  echo ""

  # Review depth
  local depth
  depth=$(echo "$cfg" | jq -r '.review_depth // "auto"')
  echo "Review depth: $depth"

  # Speculation
  local spec_enabled spec_pairs
  spec_enabled=$(echo "$cfg" | jq -r '.speculation.enabled // false')
  spec_pairs=$(echo "$cfg" | jq -r '.speculation.pairs // {} | to_entries | map("\(.key) → \(.value)") | join(", ")')
  if [ "$spec_enabled" = "true" ]; then
    echo "Speculation: enabled ($spec_pairs)"
  else
    echo "Speculation: disabled"
  fi

  # Parallel
  local par_enabled par_strategy par_max
  par_enabled=$(echo "$cfg" | jq -r '.parallel.enabled // false')
  par_strategy=$(echo "$cfg" | jq -r '.parallel.strategy // "auto"')
  par_max=$(echo "$cfg" | jq -r '.parallel.max_concurrent // 3')
  if [ "$par_enabled" = "true" ]; then
    echo "Parallel: enabled (strategy: $par_strategy, max: $par_max)"
  else
    echo "Parallel: disabled"
  fi

  echo ""

  # Available models
  if command -v opencode >/dev/null 2>&1; then
    echo "Available models (OpenCode):"
    opencode models 2>/dev/null | sed 's/^/  /' || echo "  (unable to list)"
  fi
  echo "Available models (Claude Code): $VALID_CLAUDE_MODELS"
}

cmd_default() {
  local cli="${1:?Usage: config.sh default <cli> <model>}"
  local model="${2:?Usage: config.sh default <cli> <model>}"
  validate_cli "$cli" || return 1
  validate_model "$cli" "$model" || return 1
  local cfg
  cfg=$(read_config)
  cfg=$(echo "$cfg" | jq --arg cli "$cli" --arg model "$model" '.default = {"cli": $cli, "model": $model}')
  write_config "$cfg"
  echo "Default set: $cli / $model"
}

cmd_set() {
  local key="${1:?Usage: config.sh set <key> <cli> <model>}"
  local cli="${2:?Usage: config.sh set <key> <cli> <model>}"
  local model="${3:?Usage: config.sh set <key> <cli> <model>}"
  validate_key "$key" || return 1
  validate_cli "$cli" || return 1
  validate_model "$cli" "$model" || return 1
  local cfg
  cfg=$(read_config)
  cfg=$(echo "$cfg" | jq --arg k "$key" --arg cli "$cli" --arg model "$model" '.overrides[$k] = {"cli": $cli, "model": $model}')
  write_config "$cfg"
  echo "Override set: $key → $cli / $model"
}

cmd_unset() {
  local key="${1:?Usage: config.sh unset <key>}"
  local cfg
  cfg=$(read_config)
  local exists
  exists=$(echo "$cfg" | jq --arg k "$key" '.overrides[$k] != null')
  if [ "$exists" != "true" ]; then
    echo "Error: Override '$key' not found." >&2
    return 1
  fi
  cfg=$(echo "$cfg" | jq --arg k "$key" 'del(.overrides[$k])')
  write_config "$cfg"
  local resolved
  resolved=$(resolve_one "$cfg" "$key")
  local r_cli r_model r_source
  r_cli=$(echo "$resolved" | cut -f1)
  r_model=$(echo "$resolved" | cut -f2)
  r_source=$(echo "$resolved" | cut -f3)
  echo "Override removed: $key (now resolves to: $r_cli / $r_model via $r_source)"
}

cmd_tier() {
  local name="${1:?Usage: config.sh tier <name> <cli> <model>}"
  local cli="${2:?Usage: config.sh tier <name> <cli> <model>}"
  local model="${3:?Usage: config.sh tier <name> <cli> <model>}"
  validate_cli "$cli" || return 1
  validate_model "$cli" "$model" || return 1
  local cfg
  cfg=$(read_config)
  cfg=$(echo "$cfg" | jq --arg n "$name" --arg cli "$cli" --arg model "$model" '.tiers[$n] = {"cli": $cli, "model": $model}')
  write_config "$cfg"
  # Show which steps use this tier
  local steps_using
  steps_using=$(echo "$cfg" | jq -r --arg n "$name" '[.step_tiers // {} | to_entries[] | select(.value == $n) | .key] | join(", ")')
  echo "Tier set: $name → $cli / $model"
  [ -n "$steps_using" ] && echo "Steps using $name: $steps_using"
}

cmd_tier_unset() {
  local name="${1:?Usage: config.sh tier-unset <name>}"
  local cfg
  cfg=$(read_config)
  local exists
  exists=$(echo "$cfg" | jq --arg n "$name" '.tiers[$n] != null')
  if [ "$exists" != "true" ]; then
    echo "Error: Tier '$name' not found." >&2
    return 1
  fi
  # Warn about referencing step_tiers
  local refs
  refs=$(echo "$cfg" | jq -r --arg n "$name" '[.step_tiers // {} | to_entries[] | select(.value == $n) | .key] | join(", ")')
  cfg=$(echo "$cfg" | jq --arg n "$name" 'del(.tiers[$n])')
  write_config "$cfg"
  echo "Tier removed: $name"
  [ -n "$refs" ] && echo "Warning: These steps still reference tier '$name': $refs"
}

cmd_step_tier() {
  local step="${1:?Usage: config.sh step-tier <step> <tier>}"
  local tier="${2:?Usage: config.sh step-tier <step> <tier>}"
  validate_step "$step" || return 1
  local cfg
  cfg=$(read_config)
  local tier_exists
  tier_exists=$(echo "$cfg" | jq --arg t "$tier" '.tiers[$t] != null')
  if [ "$tier_exists" != "true" ]; then
    local available
    available=$(echo "$cfg" | jq -r '.tiers | keys | join(", ")')
    echo "Error: Tier '$tier' not found. Available: $available" >&2
    return 1
  fi
  cfg=$(echo "$cfg" | jq --arg s "$step" --arg t "$tier" '.step_tiers[$s] = $t')
  write_config "$cfg"
  local resolved
  resolved=$(resolve_one "$cfg" "$step")
  local r_cli r_model
  r_cli=$(echo "$resolved" | cut -f1)
  r_model=$(echo "$resolved" | cut -f2)
  echo "Step tier set: $step → $tier ($r_cli / $r_model)"
}

cmd_step_tier_unset() {
  local step="${1:?Usage: config.sh step-tier-unset <step>}"
  validate_step "$step" || return 1
  local cfg
  cfg=$(read_config)
  local exists
  exists=$(echo "$cfg" | jq --arg s "$step" '.step_tiers[$s] != null')
  if [ "$exists" != "true" ]; then
    echo "Error: Step tier for '$step' not found." >&2
    return 1
  fi
  cfg=$(echo "$cfg" | jq --arg s "$step" 'del(.step_tiers[$s])')
  write_config "$cfg"
  local resolved
  resolved=$(resolve_one "$cfg" "$step")
  local r_cli r_model r_source
  r_cli=$(echo "$resolved" | cut -f1)
  r_model=$(echo "$resolved" | cut -f2)
  r_source=$(echo "$resolved" | cut -f3)
  echo "Step tier removed: $step (now resolves to: $r_cli / $r_model via $r_source)"
}

cmd_depth() {
  local value="${1:?Usage: config.sh depth <auto|deep|standard|light>}"
  if ! echo "$VALID_DEPTHS" | tr ' ' '\n' | grep -qx "$value"; then
    echo "Error: Invalid depth '$value'. Valid: $VALID_DEPTHS" >&2
    return 1
  fi
  local cfg
  cfg=$(read_config)
  cfg=$(echo "$cfg" | jq --arg v "$value" '.review_depth = $v')
  write_config "$cfg"
  echo "Review depth set: $value"
}

cmd_speculation() {
  local value="${1:?Usage: config.sh speculation <on|off>}"
  local enabled
  case "$value" in
    on) enabled="true" ;;
    off) enabled="false" ;;
    *) echo "Error: Invalid value '$value'. Use 'on' or 'off'." >&2; return 1 ;;
  esac
  local cfg
  cfg=$(read_config)
  cfg=$(echo "$cfg" | jq --argjson e "$enabled" '.speculation.enabled = $e')
  write_config "$cfg"
  if [ "$enabled" = "true" ]; then
    local pairs
    pairs=$(echo "$cfg" | jq -r '.speculation.pairs // {} | to_entries | map("\(.key) → \(.value)") | join(", ")')
    echo "Speculation: enabled ($pairs)"
  else
    echo "Speculation: disabled"
  fi
}

cmd_parallel() {
  local value="${1:?Usage: config.sh parallel <on|off|auto|same-branch|worktree|phase-split>}"
  local cfg
  cfg=$(read_config)
  case "$value" in
    on)
      cfg=$(echo "$cfg" | jq '.parallel.enabled = true | .parallel.strategy = "auto"')
      ;;
    off)
      cfg=$(echo "$cfg" | jq '.parallel.enabled = false')
      ;;
    auto|same-branch|worktree|phase-split)
      cfg=$(echo "$cfg" | jq --arg s "$value" '.parallel.enabled = true | .parallel.strategy = $s')
      ;;
    *)
      echo "Error: Invalid value '$value'. Valid: on, off, auto, same-branch, worktree, phase-split" >&2
      return 1
      ;;
  esac
  write_config "$cfg"
  local par_enabled par_strategy
  par_enabled=$(echo "$cfg" | jq -r '.parallel.enabled')
  par_strategy=$(echo "$cfg" | jq -r '.parallel.strategy // "auto"')
  if [ "$par_enabled" = "true" ]; then
    echo "Parallel: enabled (strategy: $par_strategy)"
  else
    echo "Parallel: disabled"
  fi
}

cmd_reset() {
  mkdir -p "$CONFIG_DIR"
  echo "$DEFAULT_CONFIG" | jq '.' > "$CONFIG_FILE"
  echo "Config reset to defaults."
}

cmd_help() {
  cat <<'HELP'
Usage: config.sh <subcommand> [args...]

Subcommands:
  show                                     Display current configuration
  default <cli> <model>                    Set default CLI/model
  set <key> <cli> <model>                  Set override for category/agent
  unset <key>                              Remove override
  tier <name> <cli> <model>                Define a tier
  tier-unset <name>                        Remove a tier
  step-tier <step> <tier>                  Assign tier to step
  step-tier-unset <step>                   Remove step tier assignment
  depth <auto|deep|standard|light>         Set review depth
  speculation <on|off>                     Toggle speculation
  parallel <on|off|auto|same-branch|...>   Set parallel strategy
  reset                                    Reset to default config
HELP
}

# --- Main ---

SUBCMD="${1:-show}"
shift 2>/dev/null || true

case "$SUBCMD" in
  show)          cmd_show ;;
  default)       cmd_default "$@" ;;
  set)           cmd_set "$@" ;;
  unset)         cmd_unset "$@" ;;
  tier)          cmd_tier "$@" ;;
  tier-unset)    cmd_tier_unset "$@" ;;
  step-tier)     cmd_step_tier "$@" ;;
  step-tier-unset) cmd_step_tier_unset "$@" ;;
  depth)         cmd_depth "$@" ;;
  speculation)   cmd_speculation "$@" ;;
  parallel)      cmd_parallel "$@" ;;
  reset)         cmd_reset ;;
  help|--help|-h) cmd_help ;;
  *)
    echo "Unknown subcommand: $SUBCMD" >&2
    cmd_help >&2
    exit 1
    ;;
esac
