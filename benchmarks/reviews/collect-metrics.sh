#!/usr/bin/env bash
# ============================================================
# collect-metrics.sh - benchLLMメトリクス収集スクリプト
# ============================================================
# Usage: ./collect-metrics.sh <directory_name>
# Example: ./collect-metrics.sh m2.5_all
# ============================================================

set -euo pipefail

BENCH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <directory_name>"
    echo "Available directories:"
    for d in "$BENCH_ROOT"/*/; do
        name=$(basename "$d")
        [[ "$name" == "reviews" ]] && continue
        echo "  $name"
    done
    exit 1
fi

DIR_NAME="$1"
DIR_PATH="$BENCH_ROOT/$DIR_NAME"

if [ ! -d "$DIR_PATH" ]; then
    echo "Error: Directory '$DIR_PATH' not found."
    exit 1
fi

echo "============================================================"
echo "Metrics for: $DIR_NAME"
echo "============================================================"
echo ""

# ----------------------------------------------------------
# 1. File statistics
# ----------------------------------------------------------
echo "--- File Statistics ---"

# Count source files (exclude hidden dirs, node_modules)
total_files=$(find "$DIR_PATH" -type f \
    -not -path '*/.git/*' \
    -not -path '*/.opencode/*' \
    -not -path '*/.claude/*' \
    -not -path '*/.poor-dev/*' \
    -not -path '*/node_modules/*' \
    2>/dev/null | wc -l)
echo "Source files: $total_files"

# Lines and bytes for main output files
echo ""
echo "Output files:"
total_output_lines=0
total_output_bytes=0
while IFS= read -r f; do
    [ -f "$f" ] || continue
    lines=$(wc -l < "$f")
    bytes=$(wc -c < "$f")
    relpath="${f#$DIR_PATH/}"
    printf "  %-40s %6d lines  %8d bytes\n" "$relpath" "$lines" "$bytes"
    total_output_lines=$((total_output_lines + lines))
    total_output_bytes=$((total_output_bytes + bytes))
done < <(find "$DIR_PATH" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.ts" -o -name "*.py" \) -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.opencode/*' -not -path '*/.claude/*' -not -path '*/.poor-dev/*' -not -path '*/_runs/*' 2>/dev/null | sort)
echo ""
echo "Total output: $total_output_lines lines, $total_output_bytes bytes"

# ----------------------------------------------------------
# 2. Pipeline state (DevSkills workflow stage)
# ----------------------------------------------------------
echo ""
echo "--- Pipeline State ---"

# Check for DevSkills artifacts (recursive search)
for artifact in spec.md plan.md tasks.md review-log.yaml; do
    found=$(find "$DIR_PATH" -name "$artifact" -not -path '*/_runs/*' -not -path '*/.git/*' 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        relpath="${found#$DIR_PATH/}"
        echo "  [x] $artifact ($relpath)"
    else
        echo "  [ ] $artifact"
    fi
done

# Check pipeline-state.json if exists
if [ -f "$DIR_PATH/.poor-dev/pipeline-state.json" ]; then
    echo ""
    echo "  pipeline-state.json:"
    cat "$DIR_PATH/.poor-dev/pipeline-state.json" 2>/dev/null | head -20
elif [ -f "$DIR_PATH/pipeline-state.json" ]; then
    echo ""
    echo "  pipeline-state.json:"
    cat "$DIR_PATH/pipeline-state.json" 2>/dev/null | head -20
else
    echo "  pipeline-state.json: not found"
fi

# ----------------------------------------------------------
# 3. Git log
# ----------------------------------------------------------
echo ""
echo "--- Git History ---"

if [ -d "$DIR_PATH/.git" ]; then
    git -C "$DIR_PATH" log --oneline --all --format='%h %ai %s' 2>/dev/null || echo "  (no commits)"

    first_commit=$(git -C "$DIR_PATH" log --all --reverse --format='%ai' 2>/dev/null | head -1)
    last_commit=$(git -C "$DIR_PATH" log --all --format='%ai' 2>/dev/null | head -1)
    commit_count=$(git -C "$DIR_PATH" rev-list --all --count 2>/dev/null || echo 0)
    echo ""
    echo "  Commits: $commit_count"
    echo "  First: $first_commit"
    echo "  Last:  $last_commit"
else
    echo "  No git repository found"
fi

# ----------------------------------------------------------
# 4. Timing estimation
# ----------------------------------------------------------
echo ""
echo "--- Timing Estimation ---"

# Try to get timing from git or file modification times
if [ -d "$DIR_PATH/.git" ]; then
    first_ts=$(git -C "$DIR_PATH" log --all --reverse --format='%at' 2>/dev/null | head -1)
else
    # Fallback: use oldest output file modification time (recursive)
    earliest_mod=""
    while IFS= read -r f; do
        [ -f "$f" ] || continue
        mod=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)
        if [ -z "$earliest_mod" ] || [ "$mod" -lt "$earliest_mod" ]; then
            earliest_mod=$mod
        fi
    done < <(find "$DIR_PATH" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.ts" -o -name "*.py" \) -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/_runs/*' 2>/dev/null)
    first_ts="${earliest_mod:-}"
fi

# Get latest modification time of output files (recursive)
latest_mod=0
while IFS= read -r f; do
    [ -f "$f" ] || continue
    mod=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)
    if [ "$mod" -gt "$latest_mod" ]; then
        latest_mod=$mod
    fi
done < <(find "$DIR_PATH" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.ts" -o -name "*.py" \) -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/_runs/*' 2>/dev/null)

if [ -n "$first_ts" ] && [ "$latest_mod" -gt 0 ]; then
    wall_clock=$((latest_mod - first_ts))
    echo "  Estimated wall clock: ${wall_clock}s (git init → last file mod)"
    if [ "$total_output_lines" -gt 0 ] && [ "$wall_clock" -gt 0 ]; then
        rate=$(echo "scale=2; $total_output_lines / $wall_clock" | bc 2>/dev/null || echo "N/A")
        echo "  Output rate: ${rate} lines/sec"
    fi
else
    echo "  Could not estimate wall clock time"
fi

# ----------------------------------------------------------
# 5. Model configuration
# ----------------------------------------------------------
echo ""
echo "--- Model Configuration ---"

if [ -f "$DIR_PATH/.poor-dev/config.json" ]; then
    echo "  poor-dev config:"
    cat "$DIR_PATH/.poor-dev/config.json" 2>/dev/null
elif [ -f "$DIR_PATH/opencode.json" ]; then
    echo "  opencode.json:"
    cat "$DIR_PATH/opencode.json" 2>/dev/null
else
    echo "  No model configuration found"
fi

echo ""
echo "============================================================"
echo "Done."
