import type { Session } from "@shared/types";

/** One flat list, no visible section split: live sessions first (newest-created first), then
 *  ended sessions appended (most-recently-active first) — see design spec §4. */
export function sortSessions(sessions: Session[]): Session[] {
  const active = sessions
    .filter((s) => s.state !== "ended")
    .sort((a, b) => b.createdMs - a.createdMs);
  const ended = sessions
    .filter((s) => s.state === "ended")
    .sort((a, b) => b.lastActivityMs - a.lastActivityMs);
  return [...active, ...ended];
}

/** Case-insensitive substring match on title or project — the sidebar search box's filter. */
export function filterSessions(sessions: Session[], query: string): Session[] {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      (s.project ?? "").toLowerCase().includes(q),
  );
}
