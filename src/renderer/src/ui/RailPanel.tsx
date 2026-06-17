import type { Account } from "@shared/types";
import { Bar, cx } from "./atoms";
import { barFill } from "./meta";
import { Icon } from "./icons";
import { railAccountModel } from "./rail-account";
import { OVERVIEW_ID } from "../stats/sentinel";

/**
 * The rail's pinned identity panel: an account card that opens Overview (subscription email + plan +
 * 5h/Weekly gauges, an api endpoint host, or — with no account — a bare Overview label). Replaces the old
 * RailAccount block and the separate pinned Overview button. CLI status lives in the rail footer.
 */
export function RailPanel({
  account,
  now,
  selectedId,
  onSelect,
}: {
  account: Account | null;
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const view = railAccountModel(account, now);
  const active = selectedId === OVERVIEW_ID;

  return (
    <div className="shrink-0 p-3">
      <button
        type="button"
        onClick={() => onSelect(OVERVIEW_ID)}
        aria-pressed={active}
        aria-label="Open overview"
        className={cx(
          "group relative block w-full rounded-lg border p-3 text-left transition-colors",
          active
            ? "border-primary/50 bg-primary/[0.06]"
            : "border-ink-800 bg-ink-900 hover:border-ink-700 hover:bg-ink-850",
        )}
      >
        <Icon
          name="arrow-up-right"
          size={13}
          className={cx(
            "absolute right-2.5 top-2.5 shrink-0 transition-opacity",
            active
              ? "text-primary opacity-100"
              : "text-fg-faint opacity-0 group-hover:opacity-100",
          )}
        />
        {view === null ? (
          <div className="flex items-center gap-2 pr-5">
            <Icon
              name="chart-column"
              size={14}
              className={cx(
                "shrink-0",
                active ? "text-primary" : "text-fg-faint",
              )}
            />
            <span className="text-[13px] font-medium text-fg-muted">
              Overview
            </span>
          </div>
        ) : view.mode === "api" ? (
          <>
            <div className="truncate pr-5 font-mono text-[12.5px] font-medium text-fg">
              {view.baseUrl}
            </div>
            <div className="mt-0.5 text-[11px] text-fg-faint">{view.plan}</div>
          </>
        ) : (
          <>
            {view.email && (
              <div className="truncate pr-5 text-[12.5px] font-medium text-fg">
                {view.email}
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-fg-faint">{view.plan}</div>
            {view.gauges.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-2">
                {view.gauges.map((g) => (
                  <div key={g.label} className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-fg-faint">
                      {g.label}
                    </span>
                    <Bar
                      pct={g.pct}
                      fill={barFill(g.pct, 90)}
                      className="flex-1"
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-fg-muted">
                      {g.pct}%
                    </span>
                    <span className="w-12 shrink-0 text-right font-mono text-[9.5px] tabular-nums text-fg-faint">
                      {g.reset}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </button>
    </div>
  );
}
