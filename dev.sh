#!/usr/bin/env bash
# Launch pi with --no-extensions and load only local extension directories.
# Usage:
#   ./dev.sh                        # load all extensions under ./extensions
#   ./dev.sh status-tracker         # load only the named extension(s)
#   ./dev.sh status-tracker subagent --model sonnet   # pass extra args to pi
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$SCRIPT_DIR/extensions"

# Collect extension names (positional args before --)
ext_names=()
extra_args=()
seen_separator=false

for arg in "$@"; do
  if [[ "$arg" == "--" ]]; then
    seen_separator=true
    continue
  fi
  if $seen_separator; then
    extra_args+=("$arg")
  else
    # If the arg looks like a flag (-something), treat it and everything after as extra args
    if [[ "$arg" == -* ]]; then
      seen_separator=true
      extra_args+=("$arg")
    else
      ext_names+=("$arg")
    fi
  fi
done

# Default: load all extension directories
if [[ ${#ext_names[@]} -eq 0 ]]; then
  for d in "$EXT_DIR"/*/; do
    [[ -d "$d" ]] && ext_names+=("$(basename "$d")")
  done
fi

# Build the -e arguments
ext_args=()
for name in "${ext_names[@]}"; do
  target="$EXT_DIR/$name"
  if [[ ! -d "$target" ]]; then
    echo "Error: extension directory not found: $target" >&2
    exit 1
  fi
  ext_args+=("-e" "$target")
done

echo "Loading extensions: ${ext_names[*]}"
exec bunx --bun @mariozechner/pi-coding-agent --no-extensions "${ext_args[@]}" "${extra_args[@]}"
