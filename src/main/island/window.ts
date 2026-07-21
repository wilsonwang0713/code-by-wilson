import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { islandBounds } from "./position";

/**
 * The notch overlay window: a non-activating macOS NSPanel (`type: "panel"` + `focusable: false`)
 * that floats above everything — including fullscreen Spaces — without ever stealing keyboard
 * focus from the app the user is working in (US-1 AC2). It is sized for the EXPANDED inbox from
 * birth and never resizes; collapsed vs expanded is a renderer visual state, and the transparent
 * remainder passes clicks through (`setIgnoreMouseEvents` with forward) until the pointer enters
 * the visible pill and the renderer asks for hit-testing via island:setInteractive.
 *
 * This window must NEVER register the per-window terminal IPC (registerTerminalIpc /
 * registerShellTerminalIpc) — those ipcMain.handle channels are taken by the main window and a
 * second registration throws.
 */
export function createIslandWindow(): BrowserWindow {
  const bounds = islandBounds(screen.getPrimaryDisplay());
  const win = new BrowserWindow({
    ...bounds,
    type: "panel",
    frame: false,
    transparent: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
  win.setIgnoreMouseEvents(true, { forward: true });

  // The overlay's own entry (island.html) — a separate, lighter bundle than the main window's.
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL + "/island.html");
  } else {
    void win.loadFile(join(__dirname, "../renderer/island.html"));
  }
  return win;
}
