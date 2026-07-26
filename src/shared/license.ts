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
