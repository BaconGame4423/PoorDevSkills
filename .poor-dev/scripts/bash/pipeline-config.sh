#!/usr/bin/env bash
#
# Pipeline configuration CLI
#
# Usage:
#   pipeline-config.sh show                     # Show current config
#   pipeline-config.sh get <key>                # Get a value (e.g., defaults.runtime, steps.intake.model)
#   pipeline-config.sh set <key> <value>        # Set a value
#   pipeline-config.sh reset                    # Reset to defaults
#
# Requires: yq

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(get_repo_root)"
CONFIG_FILE="$REPO_ROOT/.poor-dev/pipeline-config.yaml"

# Valid step names for validation
VALID_STEPS="intake specify clarify plan planreview tasks tasksreview architecturereview implement qualityreview phasereview concept goals milestones roadmap"

# Valid agent names per step (for agent-level model config)
declare -A VALID_AGENTS
VALID_AGENTS[planreview]="pm critical risk value"
VALID_AGENTS[tasksreview]="techlead senior devops junior"
VALID_AGENTS[architecturereview]="architect performance security sre"
VALID_AGENTS[qualityreview]="qa testdesign code security"
VALID_AGENTS[phasereview]="qa regression docs ux"

# Valid fields and their constraints
VALID_RUNTIME_VALUES="claude opencode"
VALID_CONFIRM_VALUES="true false"

# --- Helpers ---

ensure_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo "ERROR: Config file not found: $CONFIG_FILE" >&2
        echo "Run 'poor-dev init' to set up the project." >&2
        exit 1
    fi
}

validate_step_name() {
    local step="$1"
    for valid in $VALID_STEPS; do
        if [[ "$step" == "$valid" ]]; then
            return 0
        fi
    done
    echo "ERROR: Invalid step name '$step'." >&2
    echo "Valid steps: $VALID_STEPS" >&2
    return 1
}

validate_agent_name() {
    local step="$1" agent="$2"
    local agents="${VALID_AGENTS[$step]:-}"
    if [[ -z "$agents" ]]; then
        echo "ERROR: Step '$step' does not have sub-agents." >&2
        return 1
    fi
    for valid in $agents; do
        if [[ "$agent" == "$valid" ]]; then
            return 0
        fi
    done
    echo "ERROR: Invalid agent '$agent' for step '$step'." >&2
    echo "Valid agents: $agents" >&2
    return 1
}

validate_value() {
    local key="$1"
    local value="$2"
    local field="${key##*.}"

    case "$field" in
        runtime)
            for v in $VALID_RUNTIME_VALUES; do
                [[ "$value" == "$v" ]] && return 0
            done
            echo "ERROR: Invalid runtime '$value'. Must be: $VALID_RUNTIME_VALUES" >&2
            return 1
            ;;
        confirm)
            for v in $VALID_CONFIRM_VALUES; do
                [[ "$value" == "$v" ]] && return 0
            done
            echo "ERROR: Invalid confirm value '$value'. Must be: $VALID_CONFIRM_VALUES" >&2
            return 1
            ;;
        max_budget_usd)
            if ! [[ "$value" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                echo "ERROR: Invalid budget '$value'. Must be a number." >&2
                return 1
            fi
            return 0
            ;;
        model)
            # Any string is valid for model
            return 0
            ;;
        *)
            echo "ERROR: Unknown field '$field'. Valid fields: runtime, model, confirm, max_budget_usd" >&2
            return 1
            ;;
    esac
}

# --- Subcommands ---

cmd_show() {
    ensure_config

    printf "\n  Pipeline Configuration\n"
    printf "  ─────────────────────\n\n"

    # Defaults
    local runtime model budget confirm
    runtime="$(yq '.defaults.runtime // "claude"' "$CONFIG_FILE" 2>/dev/null)"
    model="$(yq '.defaults.model // "sonnet"' "$CONFIG_FILE" 2>/dev/null)"
    budget="$(yq '.defaults.max_budget_usd // 5.0' "$CONFIG_FILE" 2>/dev/null)"
    confirm="$(yq '.defaults.confirm // true' "$CONFIG_FILE" 2>/dev/null)"

    printf "  %-24s %s\n" "defaults.runtime" "$runtime"
    printf "  %-24s %s\n" "defaults.model" "$model"
    printf "  %-24s %s\n" "defaults.max_budget_usd" "$budget"
    printf "  %-24s %s\n" "defaults.confirm" "$confirm"

    # Step overrides
    local has_steps
    has_steps="$(yq '.steps | keys | length' "$CONFIG_FILE" 2>/dev/null)"
    if [[ "$has_steps" -gt 0 ]]; then
        printf "\n  Step Overrides:\n"
        printf "  ─────────────────────\n"
        local steps_json
        steps_json="$(yq -o=json '.steps' "$CONFIG_FILE" 2>/dev/null)"
        # Iterate over step keys
        while IFS= read -r step; do
            [[ -z "$step" ]] && continue
            local step_runtime step_model
            step_runtime="$(yq ".steps.$step.runtime // \"\"" "$CONFIG_FILE" 2>/dev/null)"
            step_model="$(yq ".steps.$step.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
            if [[ -n "$step_runtime" && "$step_runtime" != "null" ]]; then
                printf "  %-24s %s\n" "$step.runtime" "$step_runtime"
            fi
            if [[ -n "$step_model" && "$step_model" != "null" ]]; then
                printf "  %-24s %s\n" "$step.model" "$step_model"
            fi
            # Agent-level overrides
            local agents_count
            agents_count="$(yq ".steps.$step.agents | keys | length" "$CONFIG_FILE" 2>/dev/null)" || agents_count=0
            if [[ "$agents_count" -gt 0 ]]; then
                while IFS= read -r agent; do
                    [[ -z "$agent" ]] && continue
                    local agent_model
                    agent_model="$(yq ".steps.$step.agents.$agent.model // \"\"" "$CONFIG_FILE" 2>/dev/null)"
                    if [[ -n "$agent_model" && "$agent_model" != "null" ]]; then
                        printf "  %-24s %s\n" "$step.$agent.model" "$agent_model"
                    fi
                done < <(yq ".steps.$step.agents | keys | .[]" "$CONFIG_FILE" 2>/dev/null)
            fi
        done < <(yq '.steps | keys | .[]' "$CONFIG_FILE" 2>/dev/null)
    fi

    printf "\n"
}

cmd_get() {
    ensure_config
    local key="$1"
    local yq_path

    # Agent-level key: "planreview.pm.model" → ".steps.planreview.agents.pm.model"
    case "$key" in
        defaults.*) yq_path=".$key" ;;
        *.*.*)
            local step_name="${key%%.*}"
            local rest="${key#*.}"
            local agent_name="${rest%%.*}"
            local field="${rest#*.}"
            yq_path=".steps.$step_name.agents.$agent_name.$field"
            ;;
        *.*) yq_path=".steps.$key" ;;
        *) yq_path=".$key" ;;
    esac

    local value
    value="$(yq "$yq_path // \"\"" "$CONFIG_FILE" 2>/dev/null)"
    if [[ -z "$value" || "$value" == "null" ]]; then
        echo ""
    else
        echo "$value"
    fi
}

cmd_set() {
    ensure_config
    local key="$1"
    local value="$2"

    # Parse key to validate
    case "$key" in
        defaults.*)
            validate_value "$key" "$value" || exit 1
            ;;
        *.*.*)
            # Agent-level: "planreview.pm.model" → "steps.planreview.agents.pm.model"
            local step_name="${key%%.*}"
            local rest="${key#*.}"
            local agent_name="${rest%%.*}"
            local field="${rest#*.}"
            validate_step_name "$step_name" || exit 1
            validate_agent_name "$step_name" "$agent_name" || exit 1
            key="steps.$step_name.agents.$agent_name.$field"
            validate_value "$key" "$value" || exit 1
            ;;
        *.*)
            # Step-specific: extract step name
            local step_name="${key%%.*}"
            validate_step_name "$step_name" || exit 1
            # Rewrite key for yq path: "intake.model" → "steps.intake.model"
            key="steps.$key"
            validate_value "$key" "$value" || exit 1
            ;;
        *)
            echo "ERROR: Invalid key format '$key'." >&2
            echo "Use 'defaults.<field>', '<step>.<field>', or '<step>.<agent>.<field>' format." >&2
            echo "Examples: defaults.runtime, intake.model, planreview.pm.model" >&2
            exit 1
            ;;
    esac

    # Determine value type for yq
    local yq_value
    case "$value" in
        true|false)
            yq_value="$value"
            ;;
        [0-9]*.*)
            yq_value="$value"
            ;;
        *)
            yq_value="\"$value\""
            ;;
    esac

    yq -i ".$key = $yq_value" "$CONFIG_FILE"
    printf "OK: %s = %s\n" "$key" "$value"
}

cmd_reset() {
    ensure_config

    yq -i '.defaults.runtime = "claude"' "$CONFIG_FILE"
    yq -i '.defaults.model = "sonnet"' "$CONFIG_FILE"
    yq -i '.defaults.max_budget_usd = 5.0' "$CONFIG_FILE"
    yq -i '.defaults.confirm = true' "$CONFIG_FILE"
    yq -i 'del(.steps)' "$CONFIG_FILE"
    yq -i '.steps.intake.model = "haiku"' "$CONFIG_FILE"
    yq -i '.steps.implement.model = "opus"' "$CONFIG_FILE"

    printf "OK: Configuration reset to defaults.\n"
}

# --- Main dispatch ---

SUBCOMMAND="${1:-show}"
shift || true

case "$SUBCOMMAND" in
    show)
        cmd_show
        ;;
    get)
        if [[ $# -lt 1 ]]; then
            echo "Usage: pipeline-config.sh get <key>" >&2
            exit 1
        fi
        cmd_get "$1"
        ;;
    set)
        if [[ $# -lt 2 ]]; then
            echo "Usage: pipeline-config.sh set <key> <value>" >&2
            echo "Examples:" >&2
            echo "  pipeline-config.sh set defaults.runtime opencode" >&2
            echo "  pipeline-config.sh set intake.model haiku" >&2
            exit 1
        fi
        cmd_set "$1" "$2"
        ;;
    reset)
        cmd_reset
        ;;
    *)
        echo "Usage: pipeline-config.sh <show|get|set|reset> [args]" >&2
        exit 1
        ;;
esac
