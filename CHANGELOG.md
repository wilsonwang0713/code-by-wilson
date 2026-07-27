# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-27

### Added

- **Codex usage in the stats.** Codex CLI rollouts now ingest into the durable
  analytics store, so every stats cut — the model-stacked daily chart, the
  model-share ring, the project and session tables, the active-hours heatmap,
  and the contributions calendar — spans both providers. GPT models carry their
  own identity color (jade in dark, an ink step in light); the share ring caps
  its rings and folds the tail into an Other bucket so the center stat never
  clips; and Codex Desktop subagent threads attribute their usage to the model
  the rollout declares instead of an Unknown bucket.
- **Codex rate limits.** The Rate Limits card gains a Codex section read from
  the freshest rollout sample — its own gauges and as-of stamp beside Claude's
  live windows, shown only while the sample is fresh (an hour), never dressed
  up as live data.
- **Licensing: 7-day trial, then a subscription.** A full-featured 7-day trial
  that runs entirely locally (no account, no card, no network), then a Lemon
  Squeezy subscription ($4.99/month or $49.90/year) with license keys:
  activation and seat release in Settings → About, a trial-over lock screen
  with hosted checkout, a 14-day offline grace window past the subscription
  period, and periodic re-checks so refunds and cancellations land.
- **Light theme, on by default.** A full light branch alongside the existing
  dark one, chosen from Settings → Appearance (System / Light / Dark). Terminals,
  code, and diffs stay dark within the light UI. Frosted-glass overlays and a
  tinted chrome.
- **macOS notch island.** An opt-in (Settings → System), non-activating overlay
  under the notch: a glance pill (`N sessions · M waiting`) that expands into an
  attention inbox of sessions needing input, with per-session spend on running
  rows and click-to-dismiss on attention rows. Clicking a row focuses the main
  window on that session.
- **Stats charts.** The Bklit chart runtime, bridged to the app theme
  (monochrome in light, jewel-toned in dark): a model-stacked daily
  tokens-plus-turns chart, a model-share ring, a cumulative-usage line with a
  one-week projection, a weekday-by-hour "active hours" heatmap, and rate-limit
  arc gauges. The cockpit's throughput sparkline becomes a live streaming trace
  and its context readout an arc gauge.
- **Per-model weekly rate limits.** The account's `weekly_scoped` windows (e.g.
  Fable) render as their own gauges/rows, labeled straight from the usage API,
  with an "as of" freshness line so a lagging figure reads as sampled, not wrong.
- **Session-finished notifications.** An opt-in native notification when a
  session finishes, alongside the existing awaiting-input one.

### Changed

- **Monochrome app icon and wordmark.** The colorful attitude indicator gives
  way to a restrained graphite-and-white line mark — ring, banked horizon,
  level wings — with the README logo and the in-app FLIGHTDECK wordmark to
  match.
- The app is **FlightDeck**, with an attitude-indicator icon and brand marks.
- The contributions calendar dims days outside the active range so it reflects
  the selected window while keeping its own twelve-month view.

### Fixed

- Active-hours heatmap: cells grade by quantile instead of collapsing to solid
  black, and the hour labels align to their true columns.
- Chart tooltips: padding, stray hover dots, and a date pill that covered the
  bars.

### Removed

- Dead chart primitives (the hand-rolled bar/sparkline/rate-bar) superseded by
  the Bklit charts.

[Unreleased]: https://github.com/wilsonwang0713/code-by-wilson/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/wilsonwang0713/code-by-wilson/compare/v0.1.30...v0.3.0
