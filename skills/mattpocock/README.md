# Matt Pocock's Skills (pi port)

Copied from [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock's agent skills for real engineering, described as "small, easy to adapt, and composable." This is a port of all four shipped buckets (**engineering**, **productivity**, **in-progress**, **personal**); the `misc/` and `deprecated/` buckets from the upstream repo are not included.

## What's here

| Bucket | Purpose |
|---|---|
| `engineering/` | Daily code work — grilling, domain modeling, TDD, triage, PRDs, issue breakdown, architecture review, debugging, prototyping |
| `productivity/` | Daily non-code workflow tools — grilling, handoff, teaching, skill-writing reference |
| `in-progress/` | Matt's drafts not yet shipped upstream (writing skills, review, decision-mapping, loop-me) |
| `personal/` | Matt's own setup skills (article editing, Obsidian vault) |

See each bucket's `README.md` for the skill list, and [`docs/invocation.md`](./docs/invocation.md) for the user-invoked vs. model-invoked axis (pi supports the same `disable-model-invocation` flag as the original, so the axis ports mechanically).

## pi-specific changes from the upstream

These are the only modifications. Everything else — the markdown state layer (`CONTEXT.md`, `docs/adr/`, `.out-of-scope/`), the issue-tracker CLI abstraction, the grilling/domain-modeling/codebase-design engines — is verbatim from upstream.

1. **Invocation syntax.** Matt's skills cross-reference each other as `/skill:grilling`, `/skill:domain-modeling`, etc. pi registers skills as `/skill:<name>`, so those references have been rewritten to the ported skill names (`/skill:grilling` → `/skill:grill-with-docs` or `/skill:grill-me` depending on context). Scoped to actual skill names in backticks; file paths (`docs/adr/`, `.out-of-scope/`) are untouched.
2. **Subagent types.** Three files referenced Claude Code's built-in subagent types — `Explore` and `general-purpose` — which don't exist in pi. Swapped to pi's equivalents: `Explore` → `scout` (codebase recon), `general-purpose` → `worker` (general-purpose with full capabilities). Affected: `engineering/improve-codebase-architecture`, `engineering/codebase-design/DESIGN-IT-TWICE.md`, `in-progress/review`.

## What was NOT ported

- `misc/` — Claude Code–specific (`git-guardrails` uses Claude's `PreToolUse` hooks + `.claude/settings.json`; the rest is rarely-used tooling).
- `deprecated/` — superseded upstream.
- `.claude-plugin/plugin.json` — Claude Code plugin registration (pi-extensions declares skills via `package.json` `pi.skills`, which already points at `./skills` and recurses).
- Top-level `README.md`, `CHANGELOG.md`, `.changeset/`, `scripts/`, `.github/` — repo management / marketing, not skill content.

## Unchanged fields that work in pi

- `disable-model-invocation: true` — pi supports this natively (hidden from system prompt, reachable only via `/skill:<name>`). The whole user-invoked/model-invoked discipline ports.
- `argument-hint:` — pi ignores unknown frontmatter silently; harmless.
- `/compact` (referenced in `ask-matt`) — pi has the same command.
- All skill-internal relative links (`[AGENT-BRIEF.md](AGENT-BRIEF.md)`, `[tests.md](tests.md)`) survive the move unchanged.

## Syncing upstream

Bucket structure under `mattpocock/` mirrors the upstream so future changes can be diffed against `skills/<bucket>/<skill>/` and merged in, then the two pi-specific substitutions re-applied. Run `git log` here to see the exact set of edits applied at port time.
