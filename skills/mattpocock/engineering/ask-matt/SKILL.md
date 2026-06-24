---
name: ask-matt
description: Ask which skill or flow fits your situation. A router over the user-invoked skills in this repo.
disable-model-invocation: true
---

# Ask Matt

You don't remember every skill, so ask.

A **flow** is a path through the skills. Most paths run along one **main flow**, and two **on-ramps** merge onto it. Everything else is standalone.

## The main flow: idea → ship

The route most work travels. You have an idea and want it built.

1. **`/skill:grill-with-docs`** — sharpen the idea by interview. Start here when you **have a codebase**: it's stateful, retaining what it learns in `CONTEXT.md` and ADRs. (No codebase? Use `/skill:grill-me` — see Standalone.)
2. **Branch — can you settle every question in conversation?** If a question needs a runnable answer (state, business logic, a UI you have to see), detour through a prototype, bridged by **`/skill:handoff`** in both directions (see Crossing sessions):
   - **`/skill:handoff`** out, then open a fresh session against that file,
   - **`/skill:prototype`** to answer the question with throwaway code,
   - **`/skill:handoff`** back what you learned, and reference it from the original idea thread.
3. **Branch — is this a multi-session build?**
   - **Yes** → **`/skill:to-prd`** (turn the thread into a PRD) → **`/skill:to-issues`** (split the PRD into independently-grabbable issues). Because the issues are independent, **clear context between each one**: start a fresh session per issue and kick off **`/skill:implement`** by passing it the PRD and the single issue to work on.
   - **No** → **`/skill:implement`** right here, in the same context window.

### Context hygiene

Keep steps 1–3 in **one unbroken context window** — don't compact or clear until after `/skill:to-issues` — so the grilling, PRD, and issues all build on the same thinking. Each `/skill:implement` then starts fresh, working from the issue.

The limit on this is the **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**: the window (~120k tokens on state-of-the-art models) within which the model still reasons sharply. If a session approaches it before `/skill:to-issues`, don't push on degraded — `/skill:handoff` and continue in a fresh thread.

## On-ramps

A starting situation that generates work, then merges onto the main flow.

- **Bugs and requests piling up** → **`/skill:triage`**. It moves issues through triage roles and produces agent-ready issues, which **`/skill:implement`** later picks up.

  Triage is only for issues **you didn't create** — bug reports, incoming feature requests, anything that arrives raw. Issues that `/skill:to-issues` produced are already agent-ready, so **don't triage them**.

## Codebase health

Not feature work — upkeep.

- **`/skill:improve-codebase-architecture`** — run whenever you have a spare moment to keep the codebase good for agents to operate in. It surfaces deepening opportunities; picking one _generates an idea_ you can take into the main flow at `/skill:grill-with-docs`.

## Crossing sessions

- **`/skill:handoff`** — when a thread is full or you need to branch off (e.g. into a `/skill:prototype` session), this compacts the conversation into a markdown file. You don't continue in place — you **open a new session and reference that file** to carry the context across. It's the bridge between context windows, in either direction. Use it when you want a **fresh session** but need the **current conversation preserved**.
- **`/compact`** (built-in) — stay in the **same conversation**, letting the earlier turns be summarized. Use it at **intentional breaks between phases**, when you don't mind losing the verbatim history. Don't compact mid-phase — the agent can lose its way. `/skill:handoff` forks; `/compact` continues.

## Standalone

Off the main flow entirely.

- **`/skill:grill-me`** — the same relentless interview as `/skill:grill-with-docs`, but for when you have **no codebase**. Stateless: it saves nothing locally, builds no `CONTEXT.md`. Reach for it to sharpen any plan or design that doesn't live in a repo.
- **`/skill:teach`** — learn a concept over multiple sessions, using the current directory as a stateful workspace.
- **`/skill:writing-great-skills`** — reference for writing and editing skills well.

## Precondition

**`/skill:setup-matt-pocock-skills`** — run before your first engineering flow to configure the issue tracker, triage labels, and doc layout the other skills assume. Custom issue trackers also work.
