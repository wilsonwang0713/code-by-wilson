/**
 * The selection id for the pinned Overview entry. Not a real session id — App branches on it before the
 * per-session lookup to render the Stats view in the Workspace pane. A constant so the rail (which sets
 * it) and App (which reads it) can never disagree on the magic string.
 */
export const OVERVIEW_ID = "overview";
