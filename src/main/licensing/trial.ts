import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The 7-day full-featured trial (spec 2026-07-26-licensing-design). Local-only and honest-majority:
 *  the stamp lives in userData, no network is touched during the trial, and wiping the file resets
 *  it — the audience can rebuild from source anyway; hostile piracy is not the customer. */
export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The activated license as stored on disk. `token` is the backend's opaque credential (the Lemon
 *  Squeezy activation instance id today; whatever a future backend issues tomorrow) — the trial
 *  engine never interprets it, only the backend adapter does. */
export interface StoredLicense {
  key: string;
  token: string;
  /** When the backend last confirmed this license, epoch ms — the offline-grace anchor. */
  lastValidatedMs: number;
}

/** license.json under Electron userData (the app-settings.ts pattern). */
export interface LicenseFile {
  trialStartedAtMs?: number;
  license?: StoredLicense;
}

/** What a backend adapter vouches for when a stored license verifies. */
export interface VerifiedLicense {
  plan: string;
  periodEndMs: number;
}

export type LicenseState =
  | { kind: "trial"; daysLeft: number; endsAtMs: number }
  | { kind: "expired" }
  | { kind: "licensed"; plan: string; periodEndMs: number };

/**
 * The trial stamp, creating it when absent. A FUTURE stamp re-clamps to now: a rolled-back clock
 * would otherwise keep the trial alive forever (the stamp would sit "in the future" until real time
 * catches up). Pure — the caller persists `file` when it changed; an unchanged input comes back
 * identical (same reference) so callers can skip the write.
 */
export function beginOrReadTrial(
  file: LicenseFile,
  nowMs: number,
): { file: LicenseFile; startedAtMs: number } {
  const stamp = file.trialStartedAtMs;
  if (typeof stamp === "number" && stamp <= nowMs)
    return { file, startedAtMs: stamp };
  return { file: { ...file, trialStartedAtMs: nowMs }, startedAtMs: nowMs };
}

/**
 * The app's licensing state, derived pure: a license the injected verifier vouches for wins
 * outright; otherwise the trial clock decides. `verify` is the backend adapter's offline check
 * (cached validation + grace) — injected so this stays testable and backend-agnostic.
 */
export function deriveLicenseState(
  file: LicenseFile,
  nowMs: number,
  verify: (license: StoredLicense) => VerifiedLicense | null,
): LicenseState {
  if (file.license) {
    const v = verify(file.license);
    if (v) return { kind: "licensed", plan: v.plan, periodEndMs: v.periodEndMs };
  }
  const { startedAtMs } = beginOrReadTrial(file, nowMs);
  const endsAtMs = startedAtMs + TRIAL_MS;
  if (nowMs >= endsAtMs) return { kind: "expired" };
  return {
    kind: "trial",
    daysLeft: Math.ceil((endsAtMs - nowMs) / DAY_MS),
    endsAtMs,
  };
}

export interface LicenseStore {
  read(): LicenseFile;
  write(file: LicenseFile): void;
}

/** license.json persistence under `dir` (Electron userData in production, a temp dir in tests).
 *  A missing or corrupt file reads as empty — equivalent to a wiped trial, per the
 *  honest-majority posture above. */
export function createLicenseStore(dir: string): LicenseStore {
  const path = join(dir, "license.json");
  return {
    read(): LicenseFile {
      try {
        return JSON.parse(readFileSync(path, "utf8")) as LicenseFile;
      } catch {
        return {};
      }
    },
    write(file: LicenseFile): void {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, JSON.stringify(file, null, 2));
    },
  };
}
