# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.5] - 2026-06-17

### Added

- A live CLI status block at the bottom of the rail that probes the local Claude
  Code CLI on startup and classifies it as ready, not found, outdated, logged
  out, or unknown. It resolves the binary across a saved override, your
  login-shell PATH, and a fallback, recovers a relocated `CLAUDE_CONFIG_DIR`,
  flags multiple installs, and enforces a minimum version (2.1.177). A spinner
  and Re-check button rerun the probe on demand, and a Troubleshoot modal
  explains the failure with per-install-method (native, Homebrew, npm) upgrade
  commands and a binary-path override. New session and Adopt are disabled while
  the CLI is unusable.

### Changed

- Hide Claude Code background (`--bg`) sessions from the session list, including
  ones that have already ended — read from the transcript's recorded session
  kind, since the registry entry is reaped the moment the session exits.

### Fixed

- Keep the terminal prompt reachable at the bottom after a relayout or
  re-attach, not just a session switch, by rebuilding the xterm viewport
  geometry the way VSCode does.

## [0.1.4] - 2026-06-16

### Added

- Subagent lanes in the dock: each session's subagents render as a live gantt
  timeline, grouped into collapsible per-batch bands ordered by start time, with
  the task description and tool count on each lane and a status tally. Drill into
  any lane to open that subagent's transcript on the main surface, with a
  breadcrumb back to the session.
- Shift+Enter in the terminal inserts a newline in the Claude Code prompt instead
  of submitting, matching what `/terminal-setup` wires for a native terminal.

### Changed

- Recolored charts and telemetry with a token-kind palette: wire-blue is reserved
  for interaction and brand, with steel for Input, violet for Output, and teal as
  the analytics hue across the cost donut, token bars, KPI strip, contributions
  heatmap, model-mix donut, and right rail.
- Neutralized the text scale to graphite and lifted tertiary contrast.

### Fixed

- Keep the terminal scrollback pinned to the bottom after switching sessions.

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

### Fixed

- Hold a new session's picked model in the rail until its first turn lands,
  instead of briefly flickering to a default.

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

[Unreleased]: https://github.com/luojiahai/code-by-wire/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/luojiahai/code-by-wire/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/luojiahai/code-by-wire/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/luojiahai/code-by-wire/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/luojiahai/code-by-wire/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/luojiahai/code-by-wire/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/luojiahai/code-by-wire/releases/tag/v0.1.0
