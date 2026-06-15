# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-06-15

### Added

- Subagent lanes in the dock: each session's subagents render as a live gantt
  timeline, grouped into collapsible per-batch bands ordered by start time, with
  the task description and tool count on each lane and a status tally.

## [0.1.3] - 2026-06-15

### Added

- Overall Stats view, pinned as an Overview entry at the top of the rail and
  served from the SQLite analytics index: a headline KPI strip, a GitHub-style
  contributions calendar with a metric toggle and year switcher, a daily usage
  chart, per-model, per-project, and per-branch breakdowns, a sortable session
  table, a date-range filter, and a single cache-token toggle.
- App version next to the header wordmark.

### Changed

- Moved Tasks, Turns, and Subagents into a collapsible Structure dock.
- Reworked the model picker: it resolves its default from the configured
  override, offers model aliases (including Fable), shows each session's resolved
  id, and labels a session with no recorded model "Unknown".
- Capitalized the app display name to "Code-by-wire".

## [0.1.2] - 2026-06-12

### Changed

- Releases are now signed with a Developer ID certificate and notarized by
  Apple, so the downloaded `.dmg` opens without a Gatekeeper warning.

## [0.1.1] - 2026-06-12

### Added

- API billing mode in the account rail. It shows host and plan for API-billed
  accounts and tells them apart from Pro/Max subscriptions.
- macOS editing keys in the terminal (Ctrl-A/E, Esc-b/f, Ctrl-W/U/K), so the
  Claude Code prompt answers the usual readline shortcuts.

### Changed

- Moved the New session button into the sidebar.
- Simplified the account rail to host and plan, dropping Auth and Via.
- Made the terminal borderless with an edge scrollbar so it fills its panel.
- Trimmed the global header to 40px.
- Anchored the wordmark top-left, sliding into the corner in fullscreen once the
  traffic lights clear.
- Tightened the Session and Git panel row spacing to match the rail.

### Removed

- Intel (`x64`) builds. Releases are Apple Silicon (`arm64`) only.

### Fixed

- Self-heal a wrapped `settings.json` when its `state.json` goes missing.
- Drop the subscription label once every rate-limit window has expired.
- Force the sRGB color profile so packaged colors match dev.

## [0.1.0] - 2026-06-11

### Added

- First public release. A dark macOS desktop app that monitors and controls
  local Claude Code sessions: one row per session, live state (Working,
  Waiting, Idle, Ended), and transcript, tasks, tokens, cost, and git panels,
  served from an embedded SQLite index.
- Unsigned `.dmg` published to GitHub Releases.

[Unreleased]: https://github.com/luojiahai/code-by-wire/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/luojiahai/code-by-wire/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/luojiahai/code-by-wire/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/luojiahai/code-by-wire/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/luojiahai/code-by-wire/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/luojiahai/code-by-wire/releases/tag/v0.1.0
