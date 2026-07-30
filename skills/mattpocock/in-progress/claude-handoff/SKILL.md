---
name: claude-handoff
description: Prepare a truthful handoff for a fresh pi agent that can pick up the work immediately.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a concise handoff summary of the current conversation so a fresh pi agent can continue the work. Then use pi's `agent` tool, passing that summary as the `prompt`, to start a fresh agent in the current working directory. The tool returns the agent's result when it finishes; there is no Claude-specific background-job or session-picker UI to assume.

Include a "suggested skills" section in the summary, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information — the summary becomes the agent's prompt.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the summary accordingly.
