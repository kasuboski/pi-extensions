# Agent Tool

Spawn a subagent with an isolated context window. The subagent works autonomously and returns a single text result.

## Features

- **Isolated context**: Each agent runs in a separate `pi` process
- **Full overrides**: Control system prompt, model, thinking level, and tool access
- **Streaming output**: See tool calls and progress as they happen
- **Markdown rendering**: Final output rendered with proper formatting (expanded view)
- **Usage tracking**: Shows turns, tokens, cost, and context usage
- **Abort support**: Ctrl+C propagates to kill the agent process
- **Subagent-aware**: Sets `PI_SUBAGENT=1` so extensions like status-tracker deactivate
- **Herdr-aware**: When `HERDR_ENV=1`, starts each agent in its own herdr tab instead of a hidden subprocess

## Usage

### Basic (inherits defaults)
```
Use the agent tool to implement input validation on the /api/users endpoint.
```

### With overrides
```
Use the agent tool with model "aperture/glm-5.2", thinking "low", and tools
["read", "grep", "find", "ls"] to explore the authentication code.
```

## Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string (required) | The task or instruction for the agent |
| `systemPrompt` | string | Full system prompt override |
| `appendSystemPrompt` | string | Text appended to the default system prompt |
| `model` | string | Model pattern or ID (e.g. `aperture/glm-5.2`, `aperture/gpt-5.6-luna`) |
| `thinking` | string | Thinking level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `tools` | string[] | Allowlist of tool names to enable |
| `excludeTools` | string[] | Tools to exclude from the inherited set |
| `cwd` | string | Working directory for the agent process |

## Subagent Environment

The spawned process gets `PI_SUBAGENT=1` in its environment. Extensions can check this to adjust behavior:

```typescript
if (process.env.PI_SUBAGENT === "1") {
  return; // Skip registration — we're inside a subagent
}
```

This is used by `status-tracker` to avoid conflicts with the parent's `STATUS.md`.

## Herdr Integration

When running inside herdr (`HERDR_ENV=1`), the tool keeps the same API and result UI, but launches each child `pi` process in a temporary new tab in the current workspace. Focus stays on the parent pane. The child runs in normal interactive pi mode, so the tab shows the native readable TUI instead of raw JSON. The parent reconstructs the structured agent result from the child session JSONL file. After pi emits `agent_settled`—meaning model retries, compaction retries, and queued follow-ups are complete—the parent sends `/quit` to the tab, captures the result, and closes the tab after successful completion. If the agent exits non-zero or reports an LLM error, the tab is renamed with a `failed` suffix and left open for inspection along with the temporary session files. Aborting the tool closes the tab.

Outside herdr, behavior is unchanged: the agent runs as a normal hidden subprocess.

## Error Handling

- **Exit code != 0**: Tool returns error with stderr/output
- **stopReason "error"**: LLM error propagated with error message
- **stopReason "aborted"**: User abort (Ctrl+C) kills subprocess, throws error
