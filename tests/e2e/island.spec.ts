import {
  mkdtempSync,
  writeFileSync,
  cpSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright";

/**
 * Island (notch overlay) E2E — derived from the BD spec's P0 acceptance criteria (US-1/2/3/5)
 * as adjusted by the RD review. Launches the BUILT app (run `pnpm build` first) against:
 *  - an isolated userData dir (FLIGHTDECK_USER_DATA_DIR test seam), so settings/db never touch
 *    the real profile, and
 *  - a throwaway COPY of the fixture claude-home (CLAUDE_CONFIG_DIR) — a copy because the app
 *    writes into its config dir (the statusline wrapper), and the repo fixtures must stay clean.
 *
 * Manual-only ACs (see RD review §5): non-activating focus behavior, Mission Control/cmd-tab
 * exclusion, cross-Space focus.
 */

// The island is macOS-only (controller.enable() no-ops off darwin), so every spec here would
// time out waiting for a window that can never appear on other platforms.
test.skip(process.platform !== "darwin", "the island overlay is macOS-only");

const MAIN_ENTRY = join(__dirname, "..", "..", "out", "main", "index.js");
const FIXTURE_CLAUDE_HOME = join(__dirname, "..", "fixtures", "claude-home");

/** Every mkdtemp'd dir this run created, removed in afterAll so runs don't leak into tmpdir. */
const tempDirs: string[] = [];

test.afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

interface Launched {
  app: ElectronApplication;
  userData: string;
}

async function launchApp(opts: { islandEnabled?: boolean }): Promise<Launched> {
  const userData = mkdtempSync(join(tmpdir(), "flightdeck-e2e-data-"));
  tempDirs.push(userData);
  if (opts.islandEnabled !== undefined) {
    writeFileSync(
      join(userData, "settings.json"),
      JSON.stringify({ islandEnabled: opts.islandEnabled }, null, 2),
    );
  }
  const claudeDir = mkdtempSync(join(tmpdir(), "flightdeck-e2e-claude-"));
  tempDirs.push(claudeDir);
  cpSync(FIXTURE_CLAUDE_HOME, claudeDir, { recursive: true });
  const app = await electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      FLIGHTDECK_USER_DATA_DIR: userData,
      CLAUDE_CONFIG_DIR: claudeDir,
    },
  });
  return { app, userData };
}

function findIslandPage(app: ElectronApplication): Page | undefined {
  return app.windows().find((w) => w.url().includes("island.html"));
}

async function waitForIslandPage(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    const page = findIslandPage(app);
    if (page) return page;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("island window did not appear");
}

async function waitForIslandGone(app: ElectronApplication): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (!findIslandPage(app)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("island window did not close");
}

test("US-5 AC4: the island is opt-in — absent setting means no overlay window", async () => {
  const { app } = await launchApp({});
  try {
    await app.firstWindow();
    // Give a would-be island window ample time to appear before asserting absence.
    await new Promise((r) => setTimeout(r, 1500));
    expect(findIslandPage(app)).toBeUndefined();
  } finally {
    await app.close();
  }
});

test("US-1/US-2/US-3: enabled island opens top-centered, glances, and expands", async () => {
  const { app } = await launchApp({ islandEnabled: true });
  try {
    const island = await waitForIslandPage(app);

    // US-1 AC1: top-center of the primary display's work area, pinned under the menu bar.
    const geom = await app.evaluate(({ BrowserWindow, screen }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("island.html"),
      );
      if (!win) throw new Error("island BrowserWindow not found");
      return {
        bounds: win.getBounds(),
        workArea: screen.getPrimaryDisplay().workArea,
        alwaysOnTop: win.isAlwaysOnTop(),
      };
    });
    const boundsCenter = geom.bounds.x + geom.bounds.width / 2;
    const workAreaCenter = geom.workArea.x + geom.workArea.width / 2;
    expect(Math.abs(boundsCenter - workAreaCenter)).toBeLessThanOrEqual(2);
    expect(geom.bounds.y).toBe(geom.workArea.y);
    // US-1 AC2 (the automatable half): the window is always-on-top. Non-activating focus
    // behavior is asserted manually per the RD review.
    expect(geom.alwaysOnTop).toBe(true);

    // US-2 AC1/AC3: the pill renders the glance format (or the empty state), and never vanishes.
    const pill = island.locator('[data-testid="island-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toHaveText(
      /^(No sessions|\d+ sessions? · \d+ waiting)$/,
    );

    // US-3 (click-to-expand per RD cut of hover): the panel opens with both sections' anatomy.
    await pill.click();
    const panel = island.locator('[data-testid="island-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Needs you");
    // Attention section renders rows or the explicit all-clear — never an empty void.
    const rows = island.locator('[data-testid="island-row"]');
    const allClear = island.locator('[data-testid="island-all-clear"]');
    expect((await rows.count()) > 0 || (await allClear.count()) === 1).toBe(
      true,
    );

    // US-1 AC3: the island survives the main window minimizing and keeps rendering.
    await app.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().includes("island.html"),
      );
      main?.minimize();
    });
    await expect(pill).toBeVisible();
  } finally {
    await app.close();
  }
});

test("US-5 AC1/AC2/AC3: the toggle creates/destroys the overlay live and persists", async () => {
  const { app, userData } = await launchApp({ islandEnabled: false });
  try {
    const main = await app.firstWindow();

    // Enable from the main window (what the Settings card calls): window appears, no restart.
    await main.evaluate("window.api.setIslandEnabled(true)");
    await waitForIslandPage(app);

    // Persisted (US-5 AC3): the durable settings file carries the flip.
    const persisted = JSON.parse(
      readFileSync(join(userData, "settings.json"), "utf8"),
    ) as { islandEnabled?: boolean };
    expect(persisted.islandEnabled).toBe(true);

    // Disable: the window is destroyed (US-5 AC2), not hidden.
    await main.evaluate("window.api.setIslandEnabled(false)");
    await waitForIslandGone(app);
    const persistedOff = JSON.parse(
      readFileSync(join(userData, "settings.json"), "utf8"),
    ) as { islandEnabled?: boolean };
    expect(persistedOff.islandEnabled).toBe(false);
  } finally {
    await app.close();
  }
});
