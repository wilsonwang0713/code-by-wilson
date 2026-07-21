# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
