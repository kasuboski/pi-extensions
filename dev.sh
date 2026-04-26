#!/usr/bin/env bash
# Launch pi with --no-extensions --no-skills and load only local extension
# and skill directories.
# Usage:
#   ./dev.sh                                 # load all extensions + all skills
#   ./dev.sh --ext status-tracker            # load only the named extension(s)
#   ./dev.sh --skill github-actions           # load only the named skill(s)
#   ./dev.sh --ext subagent --skill grug      # mix and match
#   ./dev.sh --model sonnet                   # pass extra args to pi
#   ./dev.sh status-tracker subagent           # bare args → treated as extensions
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$SCRIPT_DIR/extensions"
SKILL_DIR="$SCRIPT_DIR/skills"

ext_names=()
skill_names=()
extra_args=()

# Flags that consume the next argument (kept in sync with pi --help)
FLAGS_WITH_VALUE=(
  --provider --model --api-key --system-prompt --append-system-prompt
  --mode --session --fork --session-dir --models --tools --thinking
  --extension --skill --prompt-template --theme --export --list-models
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ext)
      shift; ext_names+=("$1"); shift ;;
    --skill)
      shift; skill_names+=("$1"); shift ;;
    --)
      shift; extra_args+=("$@"); break ;;
    -*)
      extra_args+=("$1")
      # If this flag takes a value, grab the next arg too
      for f in "${FLAGS_WITH_VALUE[@]}"; do
        if [[ "$1" == "$f" ]]; then
          shift; extra_args+=("$1"); break
        fi
      done
      shift ;;
    *)
      # bare positional → treat as extension name
      ext_names+=("$1"); shift ;;
  esac
done

# Default: load all extension directories
if [[ ${#ext_names[@]} -eq 0 ]]; then
  for d in "$EXT_DIR"/*/; do
    [[ -d "$d" ]] && ext_names+=("$(basename "$d")")
  done
fi

# Default: load all skill directories
if [[ ${#skill_names[@]} -eq 0 ]]; then
  for d in "$SKILL_DIR"/*/; do
    [[ -d "$d" ]] && skill_names+=("$(basename "$d")")
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

# Build the --skill arguments
skill_args=()
for name in "${skill_names[@]}"; do
  target="$SKILL_DIR/$name"
  if [[ ! -d "$target" ]]; then
    echo "Error: skill directory not found: $target" >&2
    exit 1
  fi
  skill_args+=("--skill" "$target")
done

echo "Loading extensions: ${ext_names[*]}"
echo "Loading skills: ${skill_names[*]}"
exec bunx --bun @mariozechner/pi-coding-agent --no-extensions --no-skills "${ext_args[@]}" "${skill_args[@]}" "${extra_args[@]}"
