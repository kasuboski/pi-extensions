# pi-extensions

Personal pi extensions and themes.

## Setup

Install dependencies:

```bash
npm install
scripts/install-extensions
```

## Development

Run `./dev.sh` from this repo to launch Pi with the local extensions and skills. For one extension, use `./dev.sh --ext telemetry`. Use `/reload` to pick up changes without restarting.

For telemetry development, use Node 24.20.0. Install root runtime dependencies with `mise exec node@24.20.0 -- npm ci --ignore-scripts`, then install its pinned development dependencies and run checks:

```bash
cd extensions/telemetry
mise exec node@24.20.0 -- npm ci --ignore-scripts
mise exec node@24.20.0 -- npm run typecheck
```

## Structure

```
extensions/
  morphllm/        # Morph integrations: codebase_search, /fast-compact, /fast-apply
  agent/           # Delegate tasks to specialized subagents
  status-tracker/  # STATUS.md tracker extension
  tinyfish/        # Tinyfish integration
  telemetry/       # Privacy-conscious structural OpenTelemetry tracing
skills/
  design-control-loop/  # Design and build scheduled agentic control loops
```

## Telemetry Extension

Opt in with `<agent-dir>/extensions/telemetry.json` containing a collector `endpoint`. No enable flag or credentials are required for a trusted HTTP collector. See [telemetry configuration, privacy and coverage](extensions/telemetry/README.md). Tested against Pi 1.0.2; the unpinned latest-Pi launcher currently has an upstream Undici startup failure, documented there.

## MorphLLM Extension

Three Morph integrations, all reusing a single `MORPH_API_KEY`:

- **`codebase_search` tool** — agentic natural-language code search via [Morph WarpGrep](https://docs.morphllm.com/sdk/components/warp-grep/index). Spins up a sub-agent that runs ripgrep + file reads in its own context window, so exploration doesn't pollute the parent agent's context. Input is plain English, not regex.
- **`/fast-compact [query]` command** — custom compaction via the [Morph Compact API](https://docs.morphllm.com/compact) instead of pi's built-in LLM summarization. Only activates when `/fast-compact` is used; the built-in `/compact` is unaffected. Refuses to run when no key is set (falls back to built-in summarization only if a configured Morph request fails at runtime).
- **`/fast-apply [on|off|status]` command** — toggle [Morph Fast Apply](https://docs.morphllm.com/fast-apply) edit mode (off by default). When on, the built-in `edit` tool is deactivated and Morph's semantic `edit_file` tool is activated in its place; the model emits only changed lines (using `// ... existing code ...` markers) and Morph merges them server-side. Refuses to enable without a key.

### Setup

Set the `MORPH_API_KEY` environment variable. Get a key at [morphllm.com/dashboard/api-keys](https://morphllm.com/dashboard/api-keys).

```bash
export MORPH_API_KEY="your-api-key-here"
```

See `extensions/morphllm/README.md` for full per-feature details.
