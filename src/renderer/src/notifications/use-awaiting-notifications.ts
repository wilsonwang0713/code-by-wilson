import { useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import type { Session } from "@shared/types";
import { decideNotifications, decideFinishedNotifications } from "./decide";
import {
  $notifyOnAwaiting,
  $notifyOnFinished,
  initNotifyOnAwaiting,
  initNotifyOnFinished,
} from "./store";

/**
 * The renderer half of session notifications, hung off App's poll: every new session list runs the
 * pure decisions (notifications/decide.ts) against the previous poll's flags, fires one `notify:show`
 * per false→true transition — awaiting (into `waiting`) and finished (into `ended`) each with their
 * own preference gate and baseline — and advances both baselines. Living here — not in main — keeps
 * main request/response-only: the 3s poll that already exists is the only clock.
 *
 * Also owns the round trip back: a click on a notification makes main focus the window and push the
 * session id (notify:activate); the subscription below selects it.
 */
export function useAwaitingNotifications({
  sessions,
  selectedId,
  onActivate,
}: {
  /** The overlaid session list App renders (drafts/adopting/ending applied) — the user's view of
   *  each session's state is the one transitions are judged against. */
  sessions: readonly Session[];
  selectedId: string | null;
  /** Select the clicked notification's session (App's setSelectedId). */
  onActivate: (sessionId: string) => void;
}): void {
  const awaitingEnabled = useStore($notifyOnAwaiting);
  const finishedEnabled = useStore($notifyOnFinished);
  // The previous poll's flags, one baseline per decision; null until the first list lands (the
  // no-baseline case the decision treats as "seed only, never notify"). Refs, not state: advancing
  // them must not re-render.
  const awaitingBaselineRef = useRef<Map<string, boolean> | null>(null);
  const finishedBaselineRef = useRef<Map<string, boolean> | null>(null);

  // Seed the preference atoms from the persisted settings once per app run.
  useEffect(() => {
    void initNotifyOnAwaiting();
    void initNotifyOnFinished();
  }, []);

  // The detector. Keyed on the list identity: every poll applies a fresh array, so this runs once
  // per poll. Both decisions run off the same list and the same focus read; each carries its own
  // enabled flag and its own baseline. Re-runs from the other deps (selection, toggles) are harmless
  // no-ops — each baseline already matches the current list, so no transition can be found.
  useEffect(() => {
    const windowFocused = document.hasFocus();
    const awaiting = decideNotifications({
      prev: awaitingBaselineRef.current,
      sessions,
      enabled: awaitingEnabled,
      windowFocused,
      selectedId,
    });
    awaitingBaselineRef.current = awaiting.baseline;
    const finished = decideFinishedNotifications({
      prev: finishedBaselineRef.current,
      sessions,
      enabled: finishedEnabled,
      windowFocused,
      selectedId,
    });
    finishedBaselineRef.current = finished.baseline;
    // .catch: if main's show ever rejects, an un-caught fire-and-forget invoke would surface as
    // an unhandled rejection; a lost notification is the acceptable outcome.
    for (const req of [...awaiting.notify, ...finished.notify])
      void window.api.showNotification(req).catch(() => {});
  }, [sessions, awaitingEnabled, finishedEnabled, selectedId]);

  // Notification click → select that session. The push arrives only after main focused the window.
  useEffect(() => {
    return window.api.onNotifyActivate(onActivate);
  }, [onActivate]);
}
