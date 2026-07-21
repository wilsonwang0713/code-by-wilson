import type { BrowserWindow } from "electron";
import { IPC } from "@shared/ipc";

/** How the composition root hands out the main window: an explicit tracked reference, never
 *  `BrowserWindow.getAllWindows()[0]` — with the island overlay open that index can resolve to
 *  the wrong window. `openWindow` recreates the main window in the macOS zero-window state. */
export interface MainWindowAccess {
  resolveMainWindow: () => BrowserWindow | null;
  openWindow: () => void;
}

/**
 * Bring the main window up and tell its renderer to select `sessionId` via the notifyActivate
 * push. Shared by the notification click (notify.ts) and the island's click-to-focus
 * (island/controller.ts), so the two entry points can't drift. When no main window exists
 * (macOS dock-only state) it recreates one and defers the select push to the fresh renderer's
 * first load; if React's listener isn't mounted by then the push is dropped — the app is still
 * open and focused, which is the part that must not die.
 */
export function focusMainOnSession(
  access: MainWindowAccess,
  sessionId: string,
): void {
  const existing = access.resolveMainWindow();
  if (!existing) {
    access.openWindow();
    const fresh = access.resolveMainWindow();
    if (!fresh) return;
    fresh.webContents.once("did-finish-load", () => {
      if (!fresh.isDestroyed())
        fresh.webContents.send(IPC.notifyActivate, sessionId);
    });
    return;
  }
  // Restore before focus: a minimized window ignores focus() on some platforms.
  if (existing.isMinimized()) existing.restore();
  existing.show();
  existing.focus();
  existing.webContents.send(IPC.notifyActivate, sessionId);
}
