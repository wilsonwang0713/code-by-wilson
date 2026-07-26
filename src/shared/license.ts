/** Licensing types both processes share: main derives them (licensing/), the renderer renders them
 *  (Settings license section, the expired lock screen). JSX-free and dependency-free by design. */

export type LicenseState =
  | { kind: "trial"; daysLeft: number; endsAtMs: number }
  | { kind: "expired" }
  | { kind: "licensed"; plan: string; periodEndMs: number | null };

/** Why an activation failed, for the form's error line. Mirrors the backend adapter's reasons plus
 *  "not-configured" (a build whose store ids aren't wired — activation can't work yet). */
export type ActivateFailReason =
  | "invalid-key"
  | "limit-reached"
  | "expired"
  | "wrong-product"
  | "network"
  | "not-configured";

/** What the renderer's activation form gets back over IPC. */
export type ActivateOutcome =
  | { ok: true }
  | { ok: false; reason: ActivateFailReason; message: string };

/** The Lemon Squeezy hosted checkout links the Subscribe buttons open (LS hosts the whole purchase
 *  flow — payment, receipt, and the license-key email). Shared so the lock screen and the Settings
 *  card open the same pages the store actually sells. */
export const CHECKOUT_URL_MONTHLY =
  "https://wilson07131.lemonsqueezy.com/checkout/buy/9a1f99e0-3957-493a-ae19-bc54fa56676a";
export const CHECKOUT_URL_YEARLY =
  "https://wilson07131.lemonsqueezy.com/checkout/buy/5d3b50c6-b4a6-472e-af87-d580b2267964";

/** Display prices, single-sourced beside their checkout links so copy can't drift from the store. */
export const PRICE_MONTHLY = "$4.99/mo";
export const PRICE_YEARLY = "$49.90/yr";
