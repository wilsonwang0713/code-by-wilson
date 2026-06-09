# code-by-wire

A dark desktop app that monitors and controls local Claude Code sessions. It surfaces the data Claude Code keeps out of sight in `~/.claude` and keeps many sessions in one place instead of scattered across terminal windows.

Electron + React + TypeScript, dark theme only. See `CONTEXT.md` for the vocabulary and `docs/adr/` for the locked architectural decisions.

## Start here (fresh session or agent)

1. Read `CONTEXT.md` (the glossary) and `docs/adr/` (the three locked decisions: statusLine over hooks, incremental SQLite index, provider-adapter model).
2. Skim `src/prototype/` for the chosen design. Overview variant B won; see `src/prototype/NOTES.md` for the verdict.
3. Grab the lowest-numbered open `ready-for-agent` issue and build it. Issue **#2** (the walking skeleton) is the entry point; everything else hangs off it.
4. The PRD and issues live as GitHub issues. This machine's `gh` defaults to a work host, so always target the repo explicitly:
   ```
   GH_HOST=github.com gh issue view <n> -R luojiahai/code-by-wire-source
   ```
   Full conventions in `docs/agents/issue-tracker.md`.

## Develop

```
pnpm install
pnpm rebuild:native   # rebuild better-sqlite3 for Electron's ABI (re-run after an Electron upgrade)
pnpm dev              # launches the Electron app
```

`pnpm dev` opens the app and shows one row per running Claude Code session, served from an
embedded SQLite index. `pnpm test` runs the ClaudeProvider read tests over the redacted
`~/.claude` fixtures in `tests/fixtures/`. `pnpm typecheck` checks the main and renderer projects.

The code under `src/prototype/` is throwaway and browser-only — now dormant (nothing imports it).
Issue #10 folds Overview variant B into the real Overview and deletes the rest.
