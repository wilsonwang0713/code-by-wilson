import {
  beginOrReadTrial,
  createLicenseStore,
  deriveLicenseState,
  type LicenseState,
} from "./trial";
import { verifyCachedLicense, type LicenseBackend } from "./lemon-squeezy";
import type { ActivateOutcome } from "@shared/license";

export type { ActivateOutcome } from "@shared/license";

/**
 * The licensing coordinator the app wires in: owns license.json (single writer), stamps the trial
 * clock at construction (first launch = trial start — waiting to open Settings must not defer the
 * clock), answers the synchronous state() the overview poll ships to the renderer, and runs the
 * IPC-triggered activate/deactivate plus the opportunistic renewal refresh. All time is injected
 * so tests own the clock.
 */
export interface LicenseControllerDeps {
  /** Where license.json lives — Electron userData in production, a temp dir in tests. */
  dir: string;
  backend: LicenseBackend;
  /** This machine's human-readable name, shown in the buyer's activation list ("Wilson's MBP"). */
  deviceName: string;
  now?: () => number;
}

export interface LicenseController {
  state(): LicenseState;
  activate(key: string): Promise<ActivateOutcome>;
  deactivate(): Promise<void>;
  /** Refresh the cached period end once the subscription's current period has lapsed (a renewal
   *  should have happened backend-side). No-op inside the period; never throws; a network failure
   *  keeps the cache (the 14-day grace absorbs it); a definitive revocation clears the license. */
  maybeRevalidate(): Promise<void>;
}

export function createLicenseController({
  dir,
  backend,
  deviceName,
  now = Date.now,
}: LicenseControllerDeps): LicenseController {
  const store = createLicenseStore(dir);
  // First launch stamps the trial immediately — the clock starts when the app first runs.
  {
    const initial = store.read();
    const { file: stamped } = beginOrReadTrial(initial, now());
    if (stamped !== initial) store.write(stamped);
  }
  // Collapses concurrent poll-driven revalidations into one in-flight request.
  let revalidating = false;

  return {
    state(): LicenseState {
      const nowMs = now();
      const file = store.read();
      // Re-stamp defensively (covers a wiped file mid-run and the future-stamp clock clamp).
      const { file: stamped } = beginOrReadTrial(file, nowMs);
      if (stamped !== file) store.write(stamped);
      return deriveLicenseState(stamped, nowMs, (l) =>
        verifyCachedLicense(l, nowMs),
      );
    },

    async activate(rawKey: string): Promise<ActivateOutcome> {
      const res = await backend.activate(rawKey.trim(), deviceName, now());
      if (!res.ok)
        return { ok: false, reason: res.reason, message: res.message };
      store.write({ ...store.read(), license: res.license });
      return { ok: true };
    },

    async deactivate(): Promise<void> {
      const file = store.read();
      if (!file.license) return;
      // Best-effort seat release; the local removal is what the user asked for either way.
      await backend.deactivate(file.license);
      const { license: _dropped, ...rest } = file;
      store.write(rest);
    },

    async maybeRevalidate(): Promise<void> {
      if (revalidating) return;
      const nowMs = now();
      const lic = store.read().license;
      if (!lic) return;
      if (lic.periodEndMs === null || nowMs < lic.periodEndMs) return;
      revalidating = true;
      try {
        const res = await backend.validate(lic, nowMs);
        if (res.ok) {
          store.write({ ...store.read(), license: res.license });
        } else if (res.reason === "revoked") {
          const { license: _dropped, ...rest } = store.read();
          store.write(rest);
        }
        // "network": keep the cache; the grace window carries us to the next attempt.
      } finally {
        revalidating = false;
      }
    },
  };
}
