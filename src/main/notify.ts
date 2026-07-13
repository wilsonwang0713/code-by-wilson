import { BrowserWindow, Notification } from "electron";
import { IPC, type NotifyShowRequest } from "@shared/ipc";

/** The main-side half of session notifications. Show is invoked request/response from the
 *  renderer's poll (the transition decision lives there — see notifications/decide.ts), so no
 *  timer or watcher runs here; the only main→renderer traffic is the click push. */
export interface Notifier {
  show(req: NotifyShowRequest): void;
}

/**
 * Native OS notifications for sessions that started awaiting input. Clicking one focuses the app
 * window and pushes the session id back to the renderer (notifyActivate), which selects it. The
 * window is resolved at click time — not at show time — the same late binding the update push uses,
 * so a notification outliving its window still lands on whatever window exists then. On macOS the
 * app stays alive with zero windows (window-all-closed no-ops on darwin), so a click must also be
 * able to RECREATE the window — that's what openWindow is for; it's the same closure the dock's
 * activate handler uses.
 */
export function createNotifier(openWindow: () => void): Notifier {
  return {
    show(req) {
      // Unsupported platform (some Linux setups): silently no-op — the renderer fires and forgets,
      // and there is nothing actionable to surface.
      if (!Notification.isSupported()) return;
      const n = new Notification({ title: req.title, body: req.body });
      n.on("click", () => {
        const existing = BrowserWindow.getAllWindows()[0];
        if (!existing || existing.isDestroyed()) {
          // No window (macOS, all closed): recreate one like activate does. The fresh renderer
          // hasn't loaded yet, so defer the select push to its first load instead of firing into
          // a blank webContents. If React's listener isn't mounted by then the push is dropped —
          // the app is still open and focused, which is the part of the click that must not die.
          openWindow();
          const fresh = BrowserWindow.getAllWindows()[0];
          if (!fresh || fresh.isDestroyed()) return;
          fresh.webContents.once("did-finish-load", () => {
            if (!fresh.isDestroyed())
              fresh.webContents.send(IPC.notifyActivate, req.sessionId);
          });
          return;
        }
        // Restore before focus: a minimized window ignores focus() on some platforms.
        if (existing.isMinimized()) existing.restore();
        existing.show();
        existing.focus();
        existing.webContents.send(IPC.notifyActivate, req.sessionId);
      });
      n.show();
    },
  };
}
