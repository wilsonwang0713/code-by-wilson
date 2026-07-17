import type { Account, RateLimit } from "@shared/types";
import { formatResetCountdown } from "@shared/format";
import { StatsCard, CardRegion } from "./shared";
import { Gauge } from "../ui/bklit/charts/gauge";

/** The gauge arc warms on the same 70/85 breakpoints as ctxTone/barFill, so "how full" reads the
 *  same color language everywhere in the app. */
function gaugeFill(pct: number): string {
  if (pct >= 85) return "var(--color-accent-bright)";
  if (pct >= 70) return "var(--color-accent)";
  return "var(--color-primary)";
}

function WindowGauge({
  label,
  window: w,
  now,
}: {
  label: string;
  window: RateLimit;
  now: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(w.usedPct)));
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <Gauge
        value={pct}
        centerValue={pct}
        suffix="%"
        defaultLabel={label}
        activeFill={gaugeFill(pct)}
        inactiveFill="var(--color-ink-800)"
        minWidth={180}
        className="w-full max-w-56"
      />
      <div className="text-meta text-fg-faint">
        resets in{" "}
        <span className="font-mono tabular-nums text-fg-muted">
          {formatResetCountdown(w.resetsAt, now)}
        </span>
      </div>
    </div>
  );
}

/**
 * Card: the account's rate-limit windows as arc gauges — the same 5h/7d utilization the pressure
 * bars show, but glanceable. Subscription accounts only (API billing carries no windows); hidden
 * entirely when there is no live statusLine account data.
 */
export function RateLimitCard({ account }: { account: Account | null }) {
  if (!account || (!account.fiveHour && !account.sevenDay)) return null;
  const now = Date.now();
  return (
    <StatsCard>
      <CardRegion title="Rate limits">
        <div className="flex flex-wrap items-start justify-around gap-4">
          {account.fiveHour && (
            <WindowGauge
              label="5-hour window"
              window={account.fiveHour}
              now={now}
            />
          )}
          {account.sevenDay && (
            <WindowGauge
              label="7-day window"
              window={account.sevenDay}
              now={now}
            />
          )}
        </div>
      </CardRegion>
    </StatsCard>
  );
}
