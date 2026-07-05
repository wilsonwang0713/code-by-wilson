import { atom } from "nanostores";

const TAKEOVER_KEY = "cbw.terminalTakeover";

// Window-guarded storage: this module is imported by node-run tests, where localStorage is absent.
function storedBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function persistBoolean(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage failures are nonfatal (same policy as panes.ts).
  }
}

/** Whether the terminal pane is shown. Separate from the pane's own open-state (which stays true —
 *  the Pane is gated via `disabled`), so persisted resize overrides survive toggling. Hermes'
 *  $terminalTakeover, persisted the same way. */
export const $terminalTakeover = atom(storedBoolean(TAKEOVER_KEY, false));
$terminalTakeover.subscribe((active) => persistBoolean(TAKEOVER_KEY, active));

export const setTerminalTakeover = (active: boolean): void =>
  $terminalTakeover.set(active);

/** The selected session's cwd, fed by an App.tsx effect — the cbw analog of hermes' $currentCwd.
 *  createTerminal snapshots it once at creation; undefined/empty means main resolves home. */
export const $activeSessionCwd = atom<string | undefined>(undefined);
