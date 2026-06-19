// Renders build/icon.svg to transparent 1024x1024 PNGs using the already-installed
// Electron/Chromium. No external image tooling required. electron-builder converts the
// PNGs to platform icons at build time. Run: pnpm run icon
//
// Two outputs from the one source:
//   build/icon.png      — macOS/Linux. Keeps the artwork's ~10% grid margin (the rounded tile
//                         fills 824/1024), which is the Apple icon convention.
//   build/icon-win.png  — Windows. Same artwork re-cropped to the tile's exact bounds so the rounded
//                         tile runs edge-to-edge (full bleed). Windows draws icons with no rounded-rect
//                         frame, so the macOS grid margin would make the icon look small on the taskbar.
//
// Forces a 2x device scale and downscales, so the result is crisp regardless of the
// host's display (a 1x monitor would otherwise rasterize 1:1 with no supersampling),
// and waits for a real composited frame instead of a fixed timer.
import { app, BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "build", "icon.svg"), "utf8");
// Re-crop the camera (not the artwork) to the tile's exact bounds (x/y 100, 824x824) so the rounded
// tile runs edge-to-edge on Windows instead of sitting in the macOS grid margin.
const svgWin = svg.replace(
  'viewBox="0 0 1024 1024"',
  'viewBox="100 100 824 824"',
);

const htmlFor = (src) =>
  '<!doctype html><meta charset="utf-8">' +
  "<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>" +
  src;

app.disableHardwareAcceleration();
// Render at 2x everywhere, not just on Retina, so the downscale below always supersamples.
app.commandLine.appendSwitch("force-device-scale-factor", "2");

app.whenReady().then(async () => {
  // One reused window for both captures: creating a second transparent frameless window after destroying
  // the first fails to load on Windows (ERR_FAILED), so navigate the same window instead.
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    // Keep rAF/timers running even though the window is never shown, so the paint
    // signal below actually fires.
    webPreferences: { offscreen: false, backgroundThrottling: false },
  });

  async function capture(svgSrc) {
    await win.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(htmlFor(svgSrc)),
    );
    // Wait for two composited frames (a real paint), with a timeout so a missed signal
    // degrades to "capture anyway" rather than hanging the script.
    const painted = win.webContents.executeJavaScript(
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))",
    );
    await Promise.race([painted, new Promise((r) => setTimeout(r, 5000))]);

    let image = await win.webContents.capturePage();
    if (image.getSize().width !== SIZE) {
      image = image.resize({ width: SIZE, height: SIZE, quality: "best" });
    }
    return image.toPNG();
  }

  writeFileSync(join(root, "build", "icon.png"), await capture(svg));
  console.log("wrote build/icon.png");
  writeFileSync(join(root, "build", "icon-win.png"), await capture(svgWin));
  console.log("wrote build/icon-win.png");
  win.destroy();
  app.quit();
});
