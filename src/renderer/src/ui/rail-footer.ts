import type { CliStatus, CliStatusKind } from "@shared/cli-status";

export interface FooterView {
  dot: "ok" | "warn" | "error" | "idle";
  statusLabel: string;
  version: string | null;
  path: string | null;
  /** The actionable one-liner (e.g. "needs ≥ 2.0.0", "not on PATH"). Null when ready/checking, where it
   *  would only restate the status label. */
  detail: string | null;
  showTroubleshoot: boolean;
}

const DOT: Record<CliStatusKind, FooterView["dot"]> = {
  ready: "ok",
  outdated: "warn",
  loggedOut: "warn",
  unknown: "warn",
  notFound: "error",
};
const LABEL: Record<CliStatusKind, string> = {
  ready: "ready",
  outdated: "too old",
  loggedOut: "logged out",
  unknown: "can't determine",
  notFound: "not found",
};

/** Pure view model for the footer. null status ⇒ the pre-first-check "checking…" placeholder. */
export function footerView(status: CliStatus | null): FooterView {
  if (!status) {
    return {
      dot: "idle",
      statusLabel: "checking…",
      version: null,
      path: null,
      detail: null,
      showTroubleshoot: false,
    };
  }
  return {
    dot: DOT[status.kind],
    statusLabel: LABEL[status.kind],
    version: status.version,
    path: status.path,
    // ready's detail just restates the label, so suppress it; non-ready details carry the remedy hint.
    detail: status.kind === "ready" ? null : (status.detail ?? null),
    showTroubleshoot: status.kind !== "ready",
  };
}
