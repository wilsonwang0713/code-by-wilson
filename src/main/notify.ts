import { Notification } from "electron";
import type { NotifyShowRequest } from "@shared/ipc";
import { focusMainOnSession, type MainWindowAccess } from "./focus-main";

/** The main-side half of session notifications. Show is invoked request/response from the
 *  renderer's poll (the transition decision lives there — see notifications/decide.ts), so no
 *  timer or watcher runs here; the only main→renderer traffic is the click push. */
export interface Notifier {
  show(req: NotifyShowRequest): void;
}

/**
 * Native OS notifications for sessions that started awaiting input. Clicking one focuses the main
 * window and pushes the session id back to the renderer (notifyActivate), which selects it. The
 * window is resolved at click time — not at show time — via the composition root's tracked
 * reference (never getAllWindows()[0]: with the island overlay open that index can be the island).
 * On macOS the app stays alive with zero windows (window-all-closed no-ops on darwin), so a click
 * must also be able to RECREATE the window — focusMainOnSession handles that via openWindow.
 */
export function createNotifier(access: MainWindowAccess): Notifier {
  return {
    show(req) {
      // Unsupported platform (some Linux setups): silently no-op — the renderer fires and forgets,
      // and there is nothing actionable to surface.
      if (!Notification.isSupported()) return;
      const n = new Notification({ title: req.title, body: req.body });
      n.on("click", () => focusMainOnSession(access, req.sessionId));
      n.show();
    },
  };
}
