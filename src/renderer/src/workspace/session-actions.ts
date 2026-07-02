import type { Session } from "@shared/types";
import {
  useResumeAction,
  canAdoptSession,
  isModelUnknown,
  type ResumeAction,
} from "./resume-action";
import { useEndAction, type EndAction } from "./end-action";

export interface SessionActions {
  /** The session has finished — the pty it ran under (if any) has exited. */
  ended: boolean;
  /** The session we own and is still running (Managed, not yet Ended) — the one End can kill. */
  live: boolean;
  /** A turn is in flight; End routes through a confirm rather than killing immediately. */
  midTurn: boolean;
  /** Whether Adopt is available right now — see `canAdoptSession`'s doc for the re-derivation window. */
  canAdopt: boolean;
  /** Whether the session never recorded a model, so Adopt/Fork's first click warns before resuming. */
  modelUnknown: boolean;
  adopt: ResumeAction;
  fork: ResumeAction;
  end: EndAction;
}

/**
 * The Adopt/Fork/End state machine for one session, shared by every surface that offers those actions —
 * today the header's `HeaderActions` cluster, and (from here on) the session-name dropdown `SessionMenu`.
 * Extracted from `HeaderActions` so a future gate/condition change can't drift between the two surfaces
 * (the exact kind of divergence `ResumeButton`'s own docstring already warns happened once before,
 * between the header and the Ended-terminal hero). Callers still own layout and markup entirely; this
 * hook only owns the derived booleans and the three action state machines.
 */
export function useSessionActions(
  session: Session,
  callbacks: {
    onAdopt: (id: string) => Promise<void>;
    onFork: (session: Session) => Promise<void>;
    /** End the running Managed session (kills the pty we own). */
    onEnd: (id: string) => void;
  },
): SessionActions {
  const { onAdopt, onFork, onEnd } = callbacks;

  const ended = session.state === "ended";
  // End is for the live session we own: Managed and not yet Ended. Adopt takes the slot once it ends; an
  // Observed-alive session (running elsewhere) shows neither — we don't own that pty.
  const live = session.management === "managed" && session.state !== "ended";
  const midTurn = session.state === "working";
  const canAdopt = canAdoptSession(session);
  const modelUnknown = isModelUnknown(session);

  const adopt = useResumeAction({
    run: () => onAdopt(session.id),
    modelUnknown,
    armed: ended, // re-arm cleanup when Adopt unmounts — i.e. when the session leaves Ended (a resume took)
  });
  const fork = useResumeAction({
    run: () => onFork(session),
    modelUnknown,
    armed: true, // Fork shows on every session; Workspace is keyed by id, so a switch remounts and resets
  });
  // Confirm only mid-turn: ending an idle/waiting session is immediate, but a turn in flight gets a confirm
  // since the kill cuts it. The conversation is durable, so it's recoverable via Adopt either way. `armed`
  // (live and still mid-turn) resets a stale open confirm if the row leaves that state under it — a sync
  // ending it, or its turn finishing — so the dialog can't outlive its premise or reappear after a re-adopt.
  const end = useEndAction({
    run: () => onEnd(session.id),
    midTurn,
    armed: live && midTurn,
  });

  return { ended, live, midTurn, canAdopt, modelUnknown, adopt, fork, end };
}
