import type { LicenseState } from "@shared/license";
import { Card } from "../shell/page-primitives";
import { ReadoutRow, RailButton } from "../settings/system-primitives";
import { ActivationForm, SubscribeLinks } from "./ActivationForm";

/** The status line's plan label. Plans come through as lowercased LS variant names ("flightdeck
 *  monthly", or "default" on a single-variant product), so normalize the two real cadences and
 *  fall back to capitalizing whatever the store named the variant. */
function planLabel(plan: string): string {
  if (plan.includes("month")) return "Monthly";
  if (plan.includes("annual") || plan.includes("year")) return "Yearly";
  return plan ? plan[0].toUpperCase() + plan.slice(1) : plan;
}

/**
 * Settings → About: the license subsystem card. Trial shows the countdown with the purchase paths
 * inline (subscribe now, or activate an existing key); licensed shows the plan, the renewal date,
 * and the seat release; expired mirrors the lock screen's form (the gate already covers the app —
 * this is the same exit for whoever navigates here). Absent state (a harness without the
 * controller) renders nothing.
 */
export function LicenseCard({
  state,
  onChanged,
}: {
  state?: LicenseState | null;
  onChanged?: () => void;
}) {
  if (!state) return null;
  const changed = onChanged ?? (() => {});

  return (
    <Card title="License">
      {state.kind === "licensed" && (
        <>
          <ReadoutRow
            label="Status"
            value={`Active · ${planLabel(state.plan)}`}
          />
          <ReadoutRow
            label="Renews"
            value={
              state.periodEndMs === null
                ? "Never expires"
                : new Date(state.periodEndMs).toLocaleDateString()
            }
          />
          <div className="px-4 py-3">
            <RailButton onClick={() => void deactivate(changed)}>
              Deactivate this Mac
            </RailButton>
          </div>
        </>
      )}
      {state.kind === "trial" && (
        <>
          <ReadoutRow
            label="Status"
            value={`Free trial · ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`}
          />
          <div className="flex flex-col gap-3 px-4 py-3">
            <SubscribeLinks />
            <ActivationForm onActivated={changed} />
          </div>
        </>
      )}
      {state.kind === "expired" && (
        <>
          <ReadoutRow label="Status" value="Trial ended" />
          <div className="flex flex-col gap-3 px-4 py-3">
            <SubscribeLinks />
            <ActivationForm onActivated={changed} />
          </div>
        </>
      )}
    </Card>
  );
}

/** Release the seat, then refresh the overview so the card flips back to the trial clock. */
async function deactivate(onChanged: () => void): Promise<void> {
  await window.api.deactivateLicense();
  onChanged();
}
