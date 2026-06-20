# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.8] - 2026-06-20

### Added

- A Settings view, reached from a title-bar gear, with System, Account,
  Appearance, and About sections. System is the new home for the Claude Code CLI
  status: its detail, version requirement, binary-path override, and per-install
  remedy commands. A title-bar Sys lamp and a master-caution banner both
  deep-link into it. Account carries the subscription identity and rate-limit
  gauges.

### Changed

- Rethemed the whole UI to an "Instrument" glass-cockpit direction: neutral
  graphite surfaces, a type stack of Saira Semi Condensed for placards, Inter for
  the UI, and JetBrains Mono for telemetry, with color reserved for live state.
  Dropped the Space Grotesk and Hanken Grotesk fonts.
- Flattened the rail's session list and moved the CLI status off it onto a
  title-bar Sys master-caution lamp.
- Reworked the session cockpit around an annunciator header (state, link, model
  and effort, git, and a clock) above a three-panel sidebar: a Context fuel
  gauge, a merged Tokens panel, and a token-speed sparkline.
- Ported the Overview to the Instrument palette with selective color. A fixed
  identity color per known model (Fable, Opus, Sonnet, Haiku) carries across the
  By-model breakdown, the daily stack, and the session log; input and output are
  tinted in the kind breakdowns; and the contributions calendar picks up an
  engaged-blue heat. The by-project breakdown flattened to a monochrome list,
  dropping the per-branch view.

### Removed

- The standalone CLI status modal, now folded into Settings → System.

### Fixed

- The daily usage by-kind chart now honors the page's "Include cache" toggle,
  folding cache out to leave input and output when the toggle is off instead of
  always rendering the full token composition.

## [0.1.7] - 2026-06-20

### Added

- Windows (x64) support: a downloadable NSIS installer, plus parity for spawning,
  adopting, live telemetry, and CLI detection.

### Changed

- Validate a session's working directory before spawn, surfacing the reason
  ("Starting directory does not exist") instead of a bare "[process exited]".

## [0.1.6] - 2026-06-18

### Added

- A Shells tab in the dock that lists each session's background shells,
  reconstructed from the transcript, and lets you drill into any shell's full
  log on the main surface with a live tail and ANSI colors.
- A reset control in the Overall Stats view that drops and rebuilds the
  analytics index from scratch, behind a danger-tone confirmation.
- An email reveal toggle in the account rail that masks the subscription email
  by default, so you can demo the app without exposing it.

### Changed

- Rebuilt the left sidebar as a single rail panel: the account card opens the
  Overview, sessions render as cards with a state-icon tile where the icon shape
  encodes session state and its tone encodes management, and the CLI status sits
  in a band below the account card with its version. The CLI status modal moved
  onto the shared modal shell around one dynamic banner.
- Split the session list into Active and Ended zones by creation time — a
  headerless Active list above a collapsible Ended section — and froze each
  session's creation time to its earliest transcript timestamp so the order
  holds across reparses.
- Reworked the dock tabs: underline and lozenge tab styles, Tasks folded into
  the dock as a tabbed section, and the idle dock defaulting to Tasks when a
  session has any.
- Restyled subagent lanes into single-row, description-first bands.
- Gave the session list, workspace, stats, and dock a VSCode-style overlay
  scrollbar that reveals on hover without taking layout space.

### Fixed

- Spawned sessions now inherit the resolved `CLAUDE_CONFIG_DIR`, so a relocated
  Claude config directory carries into sessions the app starts.

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

[Unreleased]: https://github.com/luojiahai/code-by-wire/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/luojiahai/code-by-wire/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/luojiahai/code-by-wire/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/luojiahai/code-by-wire/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/luojiahai/code-by-wire/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/luojiahai/code-by-wire/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/luojiahai/code-by-wire/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/luojiahai/code-by-wire/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/luojiahai/code-by-wire/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/luojiahai/code-by-wire/releases/tag/v0.1.0
