import { ActivationForm, SubscribeLinks } from "./ActivationForm";

/**
 * The full-window lock once the 7-day trial ends with no license (spec
 * 2026-07-26-licensing-design): trial semantics were "try everything, then subscribe", so the whole
 * cockpit gates at once rather than degrading feature by feature. Rendered by App over everything
 * whenever the polled licenseState reads expired; activation (or a subscription bought in the
 * browser + the emailed key pasted here) dissolves it via onChanged's overview refresh.
 */
export function LicenseGate({ onChanged }: { onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95">
      <div className="w-[26rem] max-w-[90vw] rounded-xl border border-ink-800 bg-ink-900 p-6 shadow-2xl">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold text-fg">
              Your 7-day trial has ended
            </h1>
            <p className="mt-1 text-body leading-relaxed text-fg-muted">
              Subscribe to keep flying — or paste a license key if you already
              have one.
            </p>
          </div>
          <SubscribeLinks />
          <div className="h-px bg-ink-800" />
          <ActivationForm onActivated={onChanged} />
          <p className="text-meta leading-relaxed text-fg-faint">
            One license covers 3 Macs · Cancel anytime · Your key arrives by
            email right after checkout
          </p>
        </div>
      </div>
    </div>
  );
}
