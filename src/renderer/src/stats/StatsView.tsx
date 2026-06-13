import { useEffect, useState, type ReactNode } from "react";
import {
  type StatsSnapshot,
  type ScanProgress,
  type StatsTotals,
  emptySnapshot,
} from "@shared/stats";
import { formatTokensShort, formatUsd } from "@shared/format";
import { Icon } from "../ui/icons";

/** Poll cadences: brisk while the first cold backfill fills in, gentle once caught up so a turn landing
 *  in another Session still shows up without a manual refresh. */
const BACKFILL_POLL_MS = 40;
const WARM_POLL_MS = 1500;

/**
 * The Overall Stats view: the all-time Totals panel, plus a "building history" progress banner on a first
 * cold run. Polls stats:read while mounted — each poll runs one bounded scan step in the main process —
 * fast until the backfill is done, then at the warm cadence so turns from other Sessions appear on their
 * own. The effect's cleanup stops the poll on unmount, so selecting any Session ends all scan work; the
 * main process does nothing unprompted. (The range filter, calendar, time-series, and breakdowns are
 * later slices; this is still the prototype "Insights grid"'s top-left panel.)
 */
export function StatsView() {
  const [snap, setSnap] = useState<StatsSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = (): void => {
      void window.api
        .readStats()
        .then((s) => {
          if (!alive) return;
          setSnap(s);
          timer = setTimeout(
            tick,
            s.progress.done ? WARM_POLL_MS : BACKFILL_POLL_MS,
          );
        })
        .catch(() => {
          // The handler is built never to reject; reaching here means the IPC bridge itself failed.
          // Keep the last good snapshot rather than blanking populated totals to zero (fall back to an
          // empty, done snapshot only on the very first poll), and retry at the warm cadence so a
          // transient bridge hiccup recovers on its own instead of freezing the view forever.
          if (!alive) return;
          setSnap((prev) => prev ?? emptySnapshot());
          timer = setTimeout(tick, WARM_POLL_MS);
        });
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const totals = snap?.totals;
  const progress = snap?.progress;
  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-ink-950 text-fg">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-6">
        {/* null = first poll in flight: blank, no spinner (matches EmptyDetail's loading). */}
        {snap && totals && progress && (
          <>
            <h1 className="font-display text-lg text-fg">Overall stats</h1>
            {!progress.done && <BuildingHistory progress={progress} />}
            {totals.turns === 0 && progress.done ? (
              <EmptyStats />
            ) : (
              <Totals totals={totals} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The first-cold-run progress state (#107 user story 26): a thin determinate bar while the scan ingests
 *  history. Gone once progress.done — the warm polls that follow refresh the totals silently. */
function BuildingHistory({ progress }: { progress: ScanProgress }) {
  const pct = progress.filesTotal
    ? Math.round((progress.filesDone / progress.filesTotal) * 100)
    : 0;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-ink-800 bg-ink-900/40 px-3 py-2.5">
      <div className="flex items-center justify-between text-[11px] text-fg-muted">
        <span>Building history…</span>
        <span className="tabular-nums">
          {progress.filesDone.toLocaleString("en-US")}/
          {progress.filesTotal.toLocaleString("en-US")}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
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
