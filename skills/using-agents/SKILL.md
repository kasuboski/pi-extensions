---
name: using-agents
description: >
  Use when using the agent tool or delegating to subagents. Use it for tasks that benefit from isolated context: codebase exploration,
  planning, focused implementation, or code review.
---

# Using the Agent Tool

The `agent` tool spawns a new pi instance with an isolated context window.
The subagent works autonomously, then returns a single text result. You do
not see its intermediate tool calls or outputs — only the final result.

Use it for tasks that benefit from isolated context: codebase exploration,
planning, focused implementation, or code review.

## Patterns

### explore — fast read-only recon

For quickly scanning a codebase and returning structured findings. Uses a
small model with low thinking and read-only tools.

```
agent(
  prompt: "Find all authentication-related code. Return file paths with line
          ranges, key types/interfaces, and architecture notes.",
  model: "zai/glm-4.7",
  thinking: "low",
  tools: ["read", "grep", "find", "ls", "bash"]
)
```

### planner — read-only analysis

For creating implementation plans from context. Thoughtful model, read-only.

```
agent(
  prompt: "Create an implementation plan for adding Redis caching to the
          session store. Focus on concrete steps.",
  systemPrompt: "You are a planning specialist. Produce a numbered plan with
                 specific files and functions to modify. Do NOT make changes.",
  model: "zai/glm-5.2",
  tools: ["read", "grep", "find", "ls"]
)
```

### worker — full capabilities

For focused implementation tasks. Inherits all tools and the default prompt.

```
agent(
  prompt: "Implement input validation on the /api/users endpoint. Add Zod
          schemas for the request body and return 400 on validation failure."
  thinking: "medium"
)
```

### reviewer — read-only code review

For analyzing code quality, security, and maintainability.

```
agent(
  prompt: "Review the recent git changes for bugs and security issues.",
  systemPrompt: "You are a senior code reviewer. Report critical issues,
                 warnings, and suggestions with file paths and line numbers.
                 Bash is read-only only (git diff, git log).",
  model: "zai/glm-5.2",
  tools: ["read", "grep", "find", "ls", "bash"]
)
```

## Tips

- Pass context the agent needs in the prompt — it starts fresh.
- Use cheap/fast models for simple tasks (exploration, grep-and-summarize).
- Return multiple agent tool calls to work in parallel.
- For multi-step workflows, call the tool multiple times, passing the previous
  result into the next prompt.
