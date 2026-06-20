/**
 * The selection id for the pinned Settings entry. Like OVERVIEW_ID it is not a real session id: App
 * branches on it before the per-session lookup to render the Settings view in the Workspace pane, and the
 * selection guards treat it as a valid non-session selection so the auto-select effect never yanks it back
 * to a session. A constant so the title-bar gear (which sets it) and App (which reads it) can't disagree.
 */
export const SETTINGS_ID = "settings";
