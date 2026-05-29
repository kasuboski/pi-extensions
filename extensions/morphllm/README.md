# MorphLLM Extension for Pi

Hooks into pi's compaction system to use the [Morph Compact API](https://docs.morphllm.com/compact) instead of built-in LLM summarization.

## Setup

Set the `MORPH_API_KEY` environment variable. Get a key at [morphllm.com/dashboard/api-keys](https://morphllm.com/dashboard/api-keys).

```bash
export MORPH_API_KEY="your-api-key-here"
```

## How it works

The extension registers a `session_before_compact` event handler that **only activates when `/fast-compact` is used**. The built-in `/compact` command is unaffected.

1. Intercepts the compaction request
2. Sends the conversation messages to the Morph Compact API (~33,000 tok/s)
3. Returns the compacted output as the compaction summary
4. Pi writes it as a proper `CompactionEntry` in the session — identical to built-in compaction

If `MORPH_API_KEY` is not set, compaction falls back to pi's built-in LLM summarization.

**`/compact`** (built-in) always uses the native LLM summarizer. **`/fast-compact`** uses Morph.

## Commands

### `/fast-compact [query]`

Triggers compaction using the Morph API. The optional query focuses the compaction on relevant content.

```
/fast-compact                    # Compact with auto-detected focus
/fast-compact authentication     # Compact, keeping lines about authentication
```

This triggers the same flow as `/compact` — the Morph hook intercepts and provides the summary.

### `/compact [query]` (built-in)

Not intercepted. Always uses pi's native LLM summarization.
