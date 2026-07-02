// SPEED_WINDOW_MS lives in the main process (src/main/provider/claude/transcript-speed.ts); the renderer
// only needs the human label. Keep them in sync if the window changes (60s). Just the duration — the
// heading's info popover explains it's a rolling window, and the long form crowded the heading at 237px.
export const SPEED_WINDOW_LABEL = "60s";
