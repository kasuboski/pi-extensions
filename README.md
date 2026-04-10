# pi-extensions

Personal pi extensions and themes.

## Setup

Install dependencies:

```bash
npm install
cd extensions/status-tracker && npm install
cd extensions/subagent && npm install
```

## Development

Run `pi` from this repo. Extensions are loaded via `.pi/settings.json`. Use `/reload` to pick up changes without restarting.

## Structure

```
extensions/
  openrouter-free/  # OpenRouter free model provider with fallback
  status-tracker/   # STATUS.md tracker extension
  subagent/         # Delegate tasks to specialized subagents
```

## OpenRouter Free Provider

Routes requests through ordered lists of free OpenRouter models with automatic fallback. Requires `OPENROUTER_API_KEY` env var.

Create `.pi/openrouter-free.json` (project) or `~/.pi/openrouter-free.json` (global):

```json
{
  "models": {
    "explore": {
      "order": ["google/gemma-4-31b-it:free", "qwen/qwen3-coder:free"]
    }
  }
}
```

See `extensions/openrouter-free/example-config.json` for a full example.
