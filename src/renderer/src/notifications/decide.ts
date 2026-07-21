import type { SessionState } from "@shared/types";
import type { NotifyShowRequest } from "@shared/ipc";

/** The slice of Session the decision reads — narrow so tests build rows without the full type. */
export interface AwaitingCandidate {
  id: string;
  title: string;
  project: string;
  state: SessionState;
}

/** The one reason the transcript-tail derivation can currently signal. When the parser learns to
 *  distinguish prompt kinds (permission vs question), this becomes per-session. */
export const AWAITING_BODY = "Waiting for your input";

/** The body for the "session finished" ping — a session that just transitioned into `ended`. */
export const FINISHED_BODY = "Finished";

export interface DecideInput {
  /** Per-session awaiting flags from the LAST poll, or null before any poll has landed. Null is the
   *  no-baseline case: sessions already waiting at app start describe the past, not a transition,
   *  so the first poll only seeds the baseline and never notifies. */
  prev: ReadonlyMap<string, boolean> | null;
  /** This poll's sessions (the overlaid list the user sees, so optimistic Ended/adopting rows count). */
  sessions: readonly AwaitingCandidate[];
  /** The user's "Notify when a session needs input" setting. Off still advances the baseline, so
   *  re-enabling never fires a backlog of transitions that happened while it was off. */
  enabled: boolean;
  /** Whether the app window has OS focus (document.hasFocus() at poll time). */
  windowFocused: boolean;
  /** The current selection: a real session id, or a pinned-route sentinel (Overview/Settings/
   *  New-session). Sentinels never equal a session id, so they never suppress — only having the
   *  awaiting session itself open does. */
  selectedId: string | null;
}

export interface DecideResult {
  /** The next baseline: this poll's awaiting flag per session id. Always derived from `sessions`
   *  alone — suppressed or disabled transitions still land as true, so they can never fire later
   *  (only a fresh false→true after re-arming can). */
  baseline: Map<string, boolean>;
  /** The notifications to fire this poll, in session order. */
  notify: NotifyShowRequest[];
}

/** A session "needs the user" exactly when its derived state is `waiting` — the transcript parser's
 *  awaitingUser (or the registry's own 'waiting' status) surfaces to the renderer as this state. */
function isAwaiting(s: AwaitingCandidate): boolean {
  return s.state === "waiting";
}

/** A session "just finished" when its derived state is `ended`. There is no `errored` state in the
 *  model, so a finished ping is scoped to this transition alone. */
function isEnded(s: AwaitingCandidate): boolean {
  return s.state === "ended";
}

/**
 * The shared decision core, pure and poll-shaped: compare the previous poll's per-session flag (as
 * computed by `isActive`) against this poll's and name the sessions that just transitioned false→true.
 * `decideNotifications` (awaiting) and `decideFinishedNotifications` (ended) are the two bindings. Rules:
 *
 * - Only a false→true transition notifies. A session that stays active across polls already fired;
 *   it re-arms only by leaving the active state first.
 * - A session with no baseline entry (first poll overall, or a session that just appeared) never
 *   notifies: with no prior observation there is no transition, only unknown history.
 * - Focused window + that session selected suppresses: the user is already looking at that session.
 *   Focused-but-elsewhere still notifies — an OS notification is how the other session waves.
 * - `enabled` off suppresses everything but the baseline still advances (see DecideInput.enabled).
 */
function decide(
  { prev, sessions, enabled, windowFocused, selectedId }: DecideInput,
  isActive: (s: AwaitingCandidate) => boolean,
  body: string,
): DecideResult {
  const baseline = new Map(sessions.map((s) => [s.id, isActive(s)]));
  if (prev === null || !enabled) return { baseline, notify: [] };
  const notify = sessions
    .filter((s) => isActive(s) && prev.get(s.id) === false)
    .filter((s) => !(windowFocused && s.id === selectedId))
    .map((s) => ({
      sessionId: s.id,
      // A session always carries a derived title, but an empty one would render a blank
      // notification header — the project (directory basename) is the honest fallback.
      title: s.title || s.project,
      body,
    }));
  return { baseline, notify };
}

/** The awaiting-input decision: fires when a session transitions into `waiting`. */
export function decideNotifications(input: DecideInput): DecideResult {
  return decide(input, isAwaiting, AWAITING_BODY);
}

/** The session-finished decision, parallel to decideNotifications: fires when a session transitions
 *  into `ended`. Its own baseline and `enabled` flag flow through DecideInput, so the caller runs it
 *  off the same session list with an independent gate. */
export function decideFinishedNotifications(input: DecideInput): DecideResult {
  return decide(input, isEnded, FINISHED_BODY);
}
