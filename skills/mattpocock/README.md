# Matt Pocock's Skills (pi port)

Copied from [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock's agent skills for real engineering, described as "small, easy to adapt, and composable."

This copy is synced to upstream commit [`8b78b531ab965735c5dc74f6f7a219e1e37326df`](https://github.com/mattpocock/skills/commit/8b78b531ab965735c5dc74f6f7a219e1e37326df) (2026-08-13). It syncs the **engineering**, **productivity**, **in-progress**, and **personal** buckets. The upstream `personal/` bucket is empty at this revision; the in-progress bucket is intentionally available in pi even though upstream excludes it from its released plugin.

## What's here

| Bucket | Purpose |
|---|---|
| `engineering/` | Code work — planning, wayfinding, research, domain modeling, TDD, triage, specs, tickets, review, debugging, and prototyping |
| `productivity/` | General workflows — grilling, handoff, teaching, questionnaires, clarification, and writing for agents |
| `in-progress/` | Upstream drafts and experiments, including writing workflows, handoff, looping, and deep-module setup |
| `personal/` | Reserved for the upstream personal bucket; no files are present at this revision |

See each populated bucket's `README.md` for the skill list, and [`docs/invocation.md`](./docs/invocation.md) for the user-invoked vs. model-invoked axis.

## Pi-specific changes from upstream

The vendored content stays as close to upstream as practical. Harness-specific instructions are adapted as follows:

1. **Invocation syntax.** Upstream cross-references such as `/grilling` and `/domain-modeling` become pi commands such as `/skill:grilling` and `/skill:domain-modeling`.
2. **Agent delegation.** Claude Code `Agent`/sub-agent types and background jobs become pi `agent` tool calls. Pi has no named `worker` or `scout` parameter, so agents are specialized through their prompt, system prompt, and tool allowlist. Independent calls may be submitted in parallel, but the caller waits for their results.
3. **Agent instructions.** Setup workflows prefer `AGENTS.md` when both `AGENTS.md` and `CLAUDE.md` are present.
4. **Claude handoff.** The upstream in-progress `claude-handoff` name is retained for path parity, but its `claude --bg` workflow is replaced by a synchronous isolated pi agent call.
5. **Vendoring boundary cleanup.** References to omitted deprecated skills are removed, and bucket summaries are kept consistent with the current skill bodies.

Everything else follows upstream, including its stateful Markdown artifacts, issue-tracker abstraction, and engineering vocabulary.

## What is not ported

- `agents/` directories — Codex-specific invocation metadata; pi reads skill frontmatter directly.
- `misc/` — mostly Claude Code-specific hooks and utilities outside this port's scope.
- `deprecated/` — superseded upstream content.
- `.claude-plugin/plugin.json` — Claude Code plugin registration; this package declares `./skills` through `package.json` and pi discovers `SKILL.md` files recursively.
- Upstream repository-management files such as the top-level `README.md`, `CHANGELOG.md`, `.changeset/`, `scripts/`, and `.github/`.

## Frontmatter compatibility

- `disable-model-invocation: true` is supported by pi and keeps a skill out of the model prompt while preserving `/skill:<name>` access.
- `argument-hint:` is currently ignored as unknown frontmatter, which pi permits.
- `/compact` is a pi built-in.
- Skill-internal relative links and helper scripts keep their upstream layout.

## Syncing upstream

1. Check out the desired upstream revision in a temporary directory and record its full commit hash above.
2. Sync `skills/{engineering,productivity,in-progress,personal}` into this directory, including upstream additions, renames, and deletions, while excluding every `agents/` directory.
3. Reapply the five port adaptations above. Do not preserve unrelated local wording drift.
4. Compare file lists and diff local content against the pinned upstream checkout.
5. Validate frontmatter, duplicate names, relative links, executable scripts, and pi launch via `./dev.sh --help`.

The first port was based on upstream commit `8370e760d0251a3738e006aeacec6d1cb31dd208` (inferred from exact content and timestamps; the original commit did not record the source SHA).
