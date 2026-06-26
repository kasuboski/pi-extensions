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

## Usage

### Basic (inherits defaults)
```
Use the agent tool to implement input validation on the /api/users endpoint.
```

### With overrides
```
Use the agent tool with model "glm-5.2", thinking "low", and tools
["read", "grep", "find", "ls"] to explore the authentication code.
```

## Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string (required) | The task or instruction for the agent |
| `systemPrompt` | string | Full system prompt override |
| `appendSystemPrompt` | string | Text appended to the default system prompt |
| `model` | string | Model pattern or ID (e.g. `glm-5.2`, `github-copilot/claude-haiku-4.5`) |
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

## Error Handling

- **Exit code != 0**: Tool returns error with stderr/output
- **stopReason "error"**: LLM error propagated with error message
- **stopReason "aborted"**: User abort (Ctrl+C) kills subprocess, throws error
