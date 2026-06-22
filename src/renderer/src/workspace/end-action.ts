import { useState } from "react";

export interface EndAction {
  confirmOpen: boolean;
  /** Click handler: opens the mid-turn confirm when needed, else ends straight away. */
  request: () => void;
  /** Run after the confirm is accepted. */
  confirmYes: () => void;
  /** Dismiss the confirm without ending. */
  confirmNo: () => void;
}

/**
 * The End-session button's tiny state machine: a mid-turn confirm gate. `run` performs the end (a
 * fire-and-forget kill); `midTurn` routes the first click through a confirm because a turn is in flight and
 * would be cut. No busy flag or re-entrancy guard: kill is idempotent on a dead/missing pty (unlike Fork,
 * which mints a new id and needs the guard), and the optimistic overlay flips the button away on the next
 * render.
 */
export function useEndAction(opts: {
  run: () => void;
  midTurn: boolean;
}): EndAction {
  const { run, midTurn } = opts;
  const [confirmOpen, setConfirmOpen] = useState(false);
  return {
    confirmOpen,
    request: () => {
      if (midTurn) setConfirmOpen(true);
      else run();
    },
    confirmYes: () => {
      setConfirmOpen(false);
      run();
    },
    confirmNo: () => setConfirmOpen(false),
  };
}
