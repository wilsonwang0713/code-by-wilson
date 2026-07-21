import { ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import { IPC } from "@shared/ipc";
import type { AppSettingsStore } from "../app-settings";
import { focusMainOnSession, type MainWindowAccess } from "../focus-main";
import { createIslandWindow } from "./window";

export interface IslandControllerDeps extends MainWindowAccess {
  appSettings: AppSettingsStore;
}

export interface IslandController {
  /** Create the overlay window (no-op off macOS, or when it already exists). */
  enable(): void;
  /** Destroy the overlay window (US-5 AC2: destroyed, not hidden — zero residue). */
  disable(): void;
}

/**
 * The island's lifecycle + its four IPC channels. All handlers are GLOBAL (one per channel,
 * registered once here at composition time) — unlike the per-window terminal IPC — because both
 * the island renderer and the main window's Settings card talk to them, and the island window
 * itself comes and goes with the toggle.
 */
export function createIslandController(
  deps: IslandControllerDeps,
): IslandController {
  let island: BrowserWindow | null = null;

  const enable = (): void => {
    // macOS-only by spec (US-5 AC1); the Windows floating widget is P2.
    if (process.platform !== "darwin") return;
    if (island && !island.isDestroyed()) return;
    const win = createIslandWindow();
    win.on("closed", () => {
      if (island === win) island = null;
    });
    island = win;
  };

  const disable = (): void => {
    if (island && !island.isDestroyed()) island.close();
    island = null;
  };

  ipcMain.handle(
    IPC.islandGetEnabled,
    () => deps.appSettings.read().islandEnabled ?? false,
  );
  ipcMain.handle(IPC.islandSetEnabled, (_e, enabled: boolean) => {
    deps.appSettings.setIslandEnabled(enabled);
    if (enabled) enable();
    else disable();
    return deps.appSettings.read().islandEnabled ?? false;
  });
  ipcMain.handle(IPC.islandFocusSession, (_e, sessionId: string) => {
    focusMainOnSession(deps, sessionId);
  });
  ipcMain.handle(IPC.islandSetInteractive, (_e, interactive: boolean) => {
    if (island && !island.isDestroyed())
      island.setIgnoreMouseEvents(!interactive, { forward: true });
  });

  return { enable, disable };
}
