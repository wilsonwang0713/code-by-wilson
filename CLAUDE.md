# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

- Package manager is **pnpm** (pinned), Node 24. Use `pnpm`, never `npm`.
- After `pnpm install` or any Electron upgrade, run `pnpm rebuild:native` — `better-sqlite3` and `node-pty` are native modules and must be rebuilt against Electron's ABI, or the app crashes on launch.
- `pnpm typecheck` runs two passes: `tsconfig.node.json` (main/preload/shared/tests) and `tsconfig.web.json` (React renderer, JSX). Test-reachable types must live in JSX-free `.ts` so they pass under the node config.
- Before pushing, run `pnpm format` and `pnpm lint` — CI's lint job runs `format:check` then `lint` and fails on either.

## Code style

- `no-unsafe-*` lint rules are intentionally downgraded to warn for `src/main/provider/claude/` — those readers consume `any` from external transcript JSON. Don't "fix" the warnings.

## Commits & PRs

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `build`, `test`), optional scope.
- No `Co-Authored-By` trailer in commits and no footer in PR bodies — match the clean existing history.

## Releasing

The maintainer drives releases in two phases; full mechanics are in `docs/RELEASING.md`.

1. **"Bump version" (before release).** On a branch, do all the doc prep and open the PR — do **not** tag:
   - Set `version` in `package.json`.
   - Update `CHANGELOG.md`: open a dated `## [X.Y.Z] - YYYY-MM-DD` section, fill it from the `vLAST..HEAD` commit range (group as Added/Changed/Removed/Fixed), repoint `[Unreleased]`, and add the `[X.Y.Z]` compare link. If a prior version shipped without notes, backfill it too.
   - Bump + changelog go in one `build(release): vX.Y.Z` commit; keep unrelated changelog backfills as separate `docs(changelog):` commits.
   - Run `pnpm format` and `pnpm lint`, push, and open the PR. Don't push a tag.
2. **"Release it" (after the PR merges).** Follow `docs/RELEASING.md`: tag the merged commit on `main` as `vX.Y.Z`, push the tag (CI builds the draft), then remind the maintainer to publish the draft.
   - **Tag push is the maintainer's job from a local clone.** Claude Code on the web runs behind a git proxy scoped to the session's feature branch; pushing any other ref — tags included — returns HTTP 403, and the GitHub tools here can't create a tag/ref either. So in a web session, prepare and verify everything, then hand the maintainer the exact commands (`git switch main && git pull`, `git tag vX.Y.Z`, `git push origin vX.Y.Z`) to run themselves.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each mapped to its default label string. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
