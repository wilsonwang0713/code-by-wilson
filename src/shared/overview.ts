import type { Session, SessionState } from "./types";

/** The rail's two zones. Active is every non-ended session (waiting + working + idle merged); Ended is
 *  the archive. They sort on different keys on purpose: Active by creation time so a row never moves as
 *  it works, Ended by last activity so the most recently finished sits on top. */
export interface RailSections {
  active: Session[];
  ended: Session[];
}

const matchesQuery = (s: Session, q: string): boolean =>
  !q ||
  s.title.toLowerCase().includes(q) ||
  s.project.toLowerCase().includes(q);

/**
 * Split sessions into the rail's Active and Ended zones, filtered by a case-insensitive substring over
 * title + project. Active is newest-created first (id breaks ties for a stable order); Ended is
 * most-recently-active first. Pure; returns fresh arrays.
 */
export function railSections(sessions: Session[], query: string): RailSections {
  const q = query.trim().toLowerCase();
  const visible = sessions.filter((s) => matchesQuery(s, q));
  const active = visible
    .filter((s) => s.state !== "ended")
    .sort(
      (a, b) =>
        b.createdMs - a.createdMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const ended = visible
    .filter((s) => s.state === "ended")
    .sort((a, b) => b.lastActivityMs - a.lastActivityMs);
  return { active, ended };
}

/** The rail's full render order as one flat list: Active (newest-created first) then Ended. Used to pick
 *  the visually-top row for auto-selection. */
export function orderedSessions(sessions: Session[], query: string): Session[] {
  const { active, ended } = railSections(sessions, query);
  return [...active, ...ended];
}

/** Default-sort precedence + display order: Waiting loudest, then Working, Idle, Ended. */
export const STATE_ORDER: Record<SessionState, number> = {
  waiting: 0,
  working: 1,
  idle: 2,
  ended: 3,
};

/** SessionStates in display order, derived from STATE_ORDER — the one source of state ordering the
 *  rail's groups read from, so adding a state is a single STATE_ORDER edit. */
export const ORDERED_STATES = (Object.keys(STATE_ORDER) as SessionState[]).sort(
  (a, b) => STATE_ORDER[a] - STATE_ORDER[b],
);

export interface SessionGroup {
  state: SessionState;
  items: Session[];
}

/**
 * Group sessions for the master rail: by state in display order (Waiting → Working → Idle → Ended),
 * filtered by a case-insensitive substring over title + project, each group's items most-recent first,
 * empty groups dropped. Pure; returns fresh arrays.
 */
export function groupSessions(
  sessions: Session[],
  query: string,
): SessionGroup[] {
  const q = query.trim().toLowerCase();
  const match = (s: Session): boolean =>
    !q ||
    s.title.toLowerCase().includes(q) ||
    s.project.toLowerCase().includes(q);
  return ORDERED_STATES.map((state) => ({
    state,
    items: sessions
      .filter((s) => s.state === state && match(s))
      .sort((a, b) => b.lastActivityMs - a.lastActivityMs),
  })).filter((g) => g.items.length > 0);
}
