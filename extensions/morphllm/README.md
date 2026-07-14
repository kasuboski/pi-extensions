# MorphLLM Extension for Pi

Two Morph integrations for pi:

- **`codebase_search` tool** — agentic natural-language code search via [Morph WarpGrep](https://docs.morphllm.com/sdk/components/warp-grep/index).
- **`/fast-compact` command** — custom compaction via the [Morph Compact API](https://docs.morphllm.com/compact) instead of built-in LLM summarization.

## Setup

Set the `MORPH_API_KEY` environment variable. Get a key at [morphllm.com/dashboard/api-keys](https://morphllm.com/dashboard/api-keys).

```bash
export MORPH_API_KEY="your-api-key-here"
```

Both features reuse this single key. Without it, the tool surfaces a clear error on call and `/fast-compact` falls back to pi's built-in summarization.

## `codebase_search` tool

Registers a `codebase_search` tool the model can call. It spins up a Morph WarpGrep **sub-agent** that runs ripgrep + file reads in its own context window and returns relevant code snippets — so exploration doesn't pollute the parent agent's context.

- **Input is plain English, not regex.** The model is steered away from grep patterns: write queries like *"Find where authentication requests are handled in the Express routes"*.
- Searches the agent's current working directory (`ctx.cwd`), using the ripgrep bundled with the SDK.
- The tool name is intentionally `codebase_search` — if the model saw "grep" it would pass regex.

```text
# What the model sends
codebase_search({ search_term: "How does the payment flow work?" })

# What comes back (formatted file:content pairs)
```

Failures (e.g. a bad key returning a 401) are returned as tool errors with a formatted reason; a successful search with zero matches returns normally with *"No relevant code found."*

## `/fast-compact [query]`

Triggers compaction using the Morph Compact API. The optional query focuses the compaction on relevant content.

```
/fast-compact                    # Compact with auto-detected focus
/fast-compact authentication     # Compact, keeping lines about authentication
```

The extension registers a `session_before_compact` event handler that **only activates when `/fast-compact` is used** — the built-in `/compact` command is unaffected. If `MORPH_API_KEY` is not set, compaction falls back to pi's built-in LLM summarization.

This triggers the same flow as `/compact` — the Morph hook intercepts and provides the summary.

### `/compact [query]` (built-in)

Not intercepted. Always uses pi's native LLM summarization.
