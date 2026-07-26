import { useState } from "react";
import {
  CHECKOUT_URL_MONTHLY,
  CHECKOUT_URL_YEARLY,
  PRICE_MONTHLY,
  PRICE_YEARLY,
} from "@shared/license";
import { RailButton } from "../settings/system-primitives";

/** The two hosted-checkout buttons. Lemon Squeezy runs the whole purchase flow in the browser —
 *  payment, receipt, and the license-key email — so these just open the store. Monthly leads (the
 *  low-commitment default); yearly rides beside it with its two-months-free hook. */
export function SubscribeLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void window.api.openExternal(CHECKOUT_URL_MONTHLY)}
        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-aux font-medium text-ink-950 transition-opacity hover:opacity-90"
      >
        Subscribe · {PRICE_MONTHLY}
      </button>
      <button
        type="button"
        onClick={() => void window.api.openExternal(CHECKOUT_URL_YEARLY)}
        className="inline-flex items-center justify-center rounded-md border border-ink-700 px-3 py-1.5 text-aux text-fg-muted transition-colors hover:border-ink-600 hover:text-fg"
      >
        {PRICE_YEARLY} · 2 months free
      </button>
    </div>
  );
}

/**
 * The license-key entry: paste, activate, read the outcome. Failures render the main process's
 * reason message verbatim (it's already user-facing: wrong key, device limit, expired, offline);
 * success hands off to `onActivated` so the owner refreshes the overview snapshot and the
 * trial/expired chrome dissolves on the spot instead of waiting for the next poll.
 */
export function ActivationForm({ onActivated }: { onActivated: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(): Promise<void> {
    if (busy || !key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.activateLicense(key);
      if (res.ok) {
        setKey("");
        onActivated();
      } else {
        setError(res.message);
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void activate();
          }}
          placeholder="Paste your license key"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-ink-700 bg-field px-2.5 py-1.5 font-mono text-aux text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        <RailButton
          onClick={() => void activate()}
          disabled={busy || !key.trim()}
        >
          {busy ? "Activating…" : "Activate"}
        </RailButton>
      </div>
      {error && <p className="text-meta text-accent">{error}</p>}
    </div>
  );
}
