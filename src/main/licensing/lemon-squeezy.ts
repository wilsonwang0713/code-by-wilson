import type { StoredLicense, VerifiedLicense } from "./trial";

/**
 * The Lemon Squeezy implementation of the license backend (spec 2026-07-26-licensing-design).
 * LS's license endpoints are PUBLIC (no API secret ships in the app); what keeps a foreign key out
 * is the store/product pin below. The stored `token` is the LS activation instance id. Consumes
 * `any` from external JSON by design (the repo-wide no-unsafe-* downgrade exists for exactly this).
 *
 * Offline posture: LS issues no signed tokens, so verification is CACHED-VALIDATION + GRACE — a
 * successful activate/validate stamps the subscription's current period end, and the license holds
 * offline until that plus LICENSE_GRACE_MS. The backend is deliberately a thin adapter behind
 * LicenseBackend: if the Stripe-Managed-Payments migration ever walls off this store, the swap
 * (Paddle + a self-built worker) touches this file alone.
 */

/** How long past the subscription period end the app keeps working without reaching the backend —
 *  covers offline stretches and failed-then-retried renewals before the lock screen drops. */
export const LICENSE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

const API = "https://api.lemonsqueezy.com/v1/licenses";

export interface LemonSqueezyConfig {
  /** The store/product this app accepts keys from — the pin that rejects other stores' keys. */
  storeId: number;
  productId: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

export type ActivateResult =
  | { ok: true; license: StoredLicense }
  | {
      ok: false;
      reason:
        | "invalid-key"
        | "limit-reached"
        | "expired"
        | "wrong-product"
        | "network";
      message: string;
    };

export type ValidateResult =
  | { ok: true; license: StoredLicense }
  | { ok: false; reason: "revoked" | "network"; message: string };

/** The backend contract the app codes against; Lemon Squeezy is merely the first implementation. */
export interface LicenseBackend {
  activate(
    key: string,
    deviceName: string,
    nowMs: number,
  ): Promise<ActivateResult>;
  validate(license: StoredLicense, nowMs: number): Promise<ValidateResult>;
  deactivate(license: StoredLicense): Promise<boolean>;
}

/**
 * The OFFLINE check deriveLicenseState injects: the cached license holds until its period end plus
 * the grace window; a null period end (a non-expiring key) always holds. Pure — network refresh is
 * the client's separate, opportunistic job.
 */
export function verifyCachedLicense(
  license: StoredLicense,
  nowMs: number,
): VerifiedLicense | null {
  if (license.periodEndMs === null)
    return { plan: license.plan, periodEndMs: null };
  if (nowMs < license.periodEndMs + LICENSE_GRACE_MS)
    return { plan: license.plan, periodEndMs: license.periodEndMs };
  return null;
}

/** LS's activation errors, folded to the app's reasons by message content (LS carries no codes). */
function reasonFromError(
  error: string,
): "invalid-key" | "limit-reached" | "expired" {
  const e = error.toLowerCase();
  if (e.includes("activation limit")) return "limit-reached";
  if (e.includes("expired")) return "expired";
  return "invalid-key";
}

/** license_key.expires_at (ISO, the subscription's current period end) → epoch ms; null when the
 *  key never expires or the stamp is unparseable (fail open to "no deadline" — validate refreshes). */
function periodEndFrom(licenseKey: any): number | null {
  const raw = licenseKey?.expires_at;
  if (typeof raw !== "string" || !raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function createLemonSqueezyBackend(
  config: LemonSqueezyConfig,
): LicenseBackend {
  const doFetch = config.fetchFn ?? fetch;

  async function post(
    path: string,
    payload: Record<string, string>,
  ): Promise<{ status: number; body: any }> {
    const res = await doFetch(`${API}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  }

  const wrongProduct = (meta: any): boolean =>
    meta?.store_id !== config.storeId || meta?.product_id !== config.productId;

  return {
    async activate(key, deviceName, nowMs) {
      let out: { status: number; body: any };
      try {
        out = await post("activate", {
          license_key: key,
          instance_name: deviceName,
        });
      } catch (err) {
        return { ok: false, reason: "network", message: String(err) };
      }
      const body = out.body;
      if (!body?.activated) {
        const message =
          typeof body?.error === "string"
            ? body.error
            : `activation failed (HTTP ${out.status})`;
        return { ok: false, reason: reasonFromError(message), message };
      }
      if (wrongProduct(body.meta))
        return {
          ok: false,
          reason: "wrong-product",
          message: "This key belongs to a different product.",
        };
      return {
        ok: true,
        license: {
          key:
            typeof body.license_key?.key === "string"
              ? body.license_key.key
              : key,
          token: typeof body.instance?.id === "string" ? body.instance.id : "",
          plan:
            typeof body.meta?.variant_name === "string"
              ? body.meta.variant_name.toLowerCase()
              : "unknown",
          periodEndMs: periodEndFrom(body.license_key),
          lastValidatedMs: nowMs,
        },
      };
    },

    async validate(license, nowMs) {
      let out: { status: number; body: any };
      try {
        out = await post("validate", {
          license_key: license.key,
          instance_id: license.token,
        });
      } catch (err) {
        return { ok: false, reason: "network", message: String(err) };
      }
      const body = out.body;
      if (!body?.valid || wrongProduct(body.meta)) {
        const message =
          typeof body?.error === "string"
            ? body.error
            : `validation failed (HTTP ${out.status})`;
        return { ok: false, reason: "revoked", message };
      }
      return {
        ok: true,
        license: {
          ...license,
          periodEndMs: periodEndFrom(body.license_key),
          lastValidatedMs: nowMs,
        },
      };
    },

    async deactivate(license) {
      try {
        const out = await post("deactivate", {
          license_key: license.key,
          instance_id: license.token,
        });
        return out.body?.deactivated === true;
      } catch {
        return false; // the seat frees on LS's side eventually via support; never block the UI
      }
    },
  };
}
