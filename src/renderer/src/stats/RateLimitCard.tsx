import type { Account, CodexRateLimits, RateLimit } from "@shared/types";
import { CODEX_LIMITS_FRESH_MS } from "@shared/types";
import { formatResetCountdown, formatAgoShort } from "@shared/format";
import { ctxColor } from "../ui/meta";
import { StatsCard, CardRegion } from "./shared";
import { Gauge } from "../ui/bklit/charts/gauge";
import type { ReactNode } from "react";

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
        // ctxColor: neutral steel while roomy (telemetry reads as data, not a black hero),
        // warming on the same 70/85 breakpoints as every other pressure readout.
        activeFill={ctxColor(pct)}
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

/** One provider's block when the card is sectioned: the provider name with its OWN honest as-of
 *  stamp (Claude's numbers refresh on their own; Codex's only move while Codex runs — one shared
 *  stamp would let the fresher source vouch for the staler one), then its gauge row. */
function ProviderSection({
  label,
  asOfMs,
  now,
  children,
}: {
  label: string;
  asOfMs: number | undefined;
  now: number;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-micro tracking-wider text-fg-faint uppercase">
          {label}
        </span>
        {asOfMs != null && asOfMs > 0 && (
          <span className="text-micro text-fg-faint">
            as of {formatAgoShort(asOfMs, now)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-start justify-around gap-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Card: rate-limit windows as arc gauges. The Claude side is the account's 5h/7d utilization from
 * the usage API / statusLine (subscription accounts only — API billing carries no windows). The
 * Codex side is the freshest rollout sample (see CodexRateLimits), shown ONLY while younger than
 * CODEX_LIMITS_FRESH_MS: those numbers move only while Codex runs, so a stale sample is history and
 * the section drops rather than posing as live. With no Codex section the Claude-only layout is
 * exactly the pre-section one; the card hides entirely when neither side has data.
 */
export function RateLimitCard({
  account,
  codex = null,
}: {
  account: Account | null;
  codex?: CodexRateLimits | null;
}) {
  const now = Date.now();
  const codexFresh =
    codex && now - codex.asOfMs < CODEX_LIMITS_FRESH_MS ? codex : null;
  const hasClaude = !!account && !!(account.fiveHour || account.sevenDay);
  if (!hasClaude && !codexFresh) return null;

  // Every window the Claude source carried, aggregates first, then the per-model weekly buckets —
  // the same set (and order) the CLI's /usage screen lists.
  const windows: { label: string; w: RateLimit | undefined }[] =
    account && hasClaude
      ? [
          { label: "5-hour window", w: account.fiveHour },
          { label: "7-day window", w: account.sevenDay },
          { label: "7-day · Sonnet", w: account.sevenDaySonnet },
          { label: "7-day · Opus", w: account.sevenDayOpus },
          // The modern limits[] weekly_scoped windows, labeled by the API ("Fable" today). The
          // legacy flat buckets above are served as null alongside, so rows never double up.
          ...(account.sevenDayScoped ?? []).map((s) => ({
            label: `7-day · ${s.label}`,
            w: s,
          })),
        ]
      : [];
  const claudeGauges = windows.map(
    ({ label, w }) =>
      w && <WindowGauge key={label} label={label} window={w} now={now} />,
  );

  return (
    <StatsCard>
      <CardRegion title="Rate limits">
        {codexFresh ? (
          <div className="flex flex-col gap-5">
            {account && hasClaude && (
              <ProviderSection label="Claude" asOfMs={account.asOfMs} now={now}>
                {claudeGauges}
              </ProviderSection>
            )}
            <ProviderSection label="Codex" asOfMs={codexFresh.asOfMs} now={now}>
              {codexFresh.windows.map((w) => (
                <WindowGauge
                  key={w.label}
                  label={`${w.label} window`}
                  window={w}
                  now={now}
                />
              ))}
            </ProviderSection>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-around gap-4">
              {claudeGauges}
            </div>
            {account?.asOfMs != null && account.asOfMs > 0 && (
              <div className="mt-2 text-right text-micro text-fg-faint">
                as of {formatAgoShort(account.asOfMs, now)}
              </div>
            )}
          </>
        )}
      </CardRegion>
    </StatsCard>
  );
}
