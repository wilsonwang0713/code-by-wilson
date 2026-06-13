import { useEffect, useState, type ReactNode } from "react";
import { type StatsTotals, emptyTotals } from "@shared/stats";
import { formatTokensShort, formatUsd } from "@shared/format";
import { Icon } from "../ui/icons";

/**
 * The Overall Stats view (slice 1): the all-time Totals panel from one stats:read aggregate. Reads on
 * mount — that read triggers the on-open scan in the main process. The page-global range filter, the
 * contributions calendar, the daily time-series, and the per-model/project/branch/session breakdowns land
 * in later slices (the layout follows the prototype's chosen "Insights grid"; this is its top-left panel).
 */
export function StatsView() {
  const [totals, setTotals] = useState<StatsTotals | null>(null);

  useEffect(() => {
    let alive = true;
    void window.api
      .readStats()
      .then((t) => {
        if (alive) setTotals(t);
      })
      .catch(() => {
        // The main handler is built never to reject; if the IPC bridge itself fails, fall back to zeros
        // (which renders the empty state) rather than stranding the view on the blank loading state.
        if (alive) setTotals(emptyTotals());
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-ink-950 text-fg">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-6">
        {/* null = first read in flight: blank, no spinner (matches EmptyDetail's loading). */}
        {totals && (
          <>
            <h1 className="font-display text-lg text-fg">Overall stats</h1>
            {totals.turns === 0 ? <EmptyStats /> : <Totals totals={totals} />}
          </>
        )}
      </div>
    </div>
  );
}

function Totals({ totals }: { totals: StatsTotals }) {
  return (
    <StatsPanel title="Totals">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="Sessions"
          value={totals.sessions.toLocaleString("en-US")}
        />
        <StatCard label="Turns" value={totals.turns.toLocaleString("en-US")} />
        <StatCard label="Input" value={formatTokensShort(totals.inputTokens)} />
        <StatCard
          label="Output"
          value={formatTokensShort(totals.outputTokens)}
        />
        <StatCard
          label="Cache read"
          value={formatTokensShort(totals.cacheReadTokens)}
        />
        <StatCard
          label="Equiv API value"
          value={formatUsd(totals.equivApiValueUsd)}
          title="Equivalent API value — a reference figure, not money owed"
        />
      </div>
    </StatsPanel>
  );
}

function EmptyStats() {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-fg-faint">
      <Icon name="chart-column" size={28} />
      <p className="text-[13px]">No usage yet.</p>
    </div>
  );
}

/** A bordered, titled section box for the stats page — the shell later slices hang the calendar,
 *  time-series, and breakdown panels off. `right` is an optional header slot (a per-panel toggle). */
function StatsPanel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink-800 bg-ink-925 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-fg-muted">
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  );
}

/** One stat: an uppercase eyebrow label over a display-type figure. */
function StatCard({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col justify-center rounded-md border border-ink-800 bg-ink-900/40 px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wide text-fg-faint">
        {label}
      </div>
      <div
        className="mt-0.5 truncate font-display text-base text-fg"
        title={title}
      >
        {value}
      </div>
    </div>
  );
}
