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
  status-tracker/    # STATUS.md tracker extension
  subagent/          # Delegate tasks to specialized subagents
```
