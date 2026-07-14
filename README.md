# pi-extensions

Personal pi extensions and themes.

## Setup

Install dependencies:

```bash
npm install
scripts/install-extensions
```

## Development

Run `pi` from this repo. Extensions are loaded via `.pi/settings.json`. Use `/reload` to pick up changes without restarting.

## Structure

```
extensions/
  morphllm/        # Morph integrations: codebase_search, /fast-compact, /fast-apply
  agent/           # Delegate tasks to specialized subagents
  status-tracker/  # STATUS.md tracker extension
  tinyfish/        # Tinyfish integration
```

## MorphLLM Extension

Three Morph integrations, all reusing a single `MORPH_API_KEY`:

- **`codebase_search` tool** — agentic natural-language code search via [Morph WarpGrep](https://docs.morphllm.com/sdk/components/warp-grep/index). Spins up a sub-agent that runs ripgrep + file reads in its own context window, so exploration doesn't pollute the parent agent's context. Input is plain English, not regex.
- **`/fast-compact [query]` command** — custom compaction via the [Morph Compact API](https://docs.morphllm.com/compact) instead of pi's built-in LLM summarization. Only activates when `/fast-compact` is used; the built-in `/compact` is unaffected. Falls back to built-in summarization if no key is set.
- **`/fast-apply [on|off|status]` command** — toggle [Morph Fast Apply](https://docs.morphllm.com/fast-apply) edit mode (off by default). When on, the built-in `edit` tool is deactivated and Morph's semantic `edit_file` tool is activated in its place; the model emits only changed lines (using `// ... existing code ...` markers) and Morph merges them server-side. Refuses to enable without a key.

### Setup

Set the `MORPH_API_KEY` environment variable. Get a key at [morphllm.com/dashboard/api-keys](https://morphllm.com/dashboard/api-keys).

```bash
export MORPH_API_KEY="your-api-key-here"
```

See `extensions/morphllm/README.md` for full per-feature details.
