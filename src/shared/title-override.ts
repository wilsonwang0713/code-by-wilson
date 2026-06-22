import type { Session } from "./types";

/** Max length of a user-set session title override. Enforced in the store (the trust boundary) and as
 *  the input's maxLength, so a hand-edited file or a direct IPC call can't push an unbounded string into
 *  the header and rail. */
export const MAX_SESSION_TITLE_LEN = 200;

/**
 * Overlay user-chosen display names onto sessions, by id. A cbw rename is the top authority: call this
 * AFTER the statusLine overlay so an override wins over both the derived title and Claude's live
 * session_name. A session with no override is returned untouched (same reference, so a no-op pass is
 * cheap).
 */
export function applyTitleOverrides(
  sessions: Session[],
  titles: Record<string, string>,
): Session[] {
  return sessions.map((s) =>
    titles[s.id] ? { ...s, title: titles[s.id] } : s,
  );
}
