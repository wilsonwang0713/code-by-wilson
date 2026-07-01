import type { Session } from "@shared/types";
import { formatRelativeTime } from "@shared/format";
import { cx, Dot, focusRingInset } from "../ui/atoms";
import { ctxTone, isContextHigh } from "../ui/meta";

/**
 * The compact 2-line sidebar row (design spec §4): state LED + title + relative time on line 1;
 * `project · branch` + a context-% chip (only once it's high) on line 2. Observed sessions carry
 * a hollow ring on the `Dot`, with no separate text tag. Selection is a raised
 * background plus a semibold title — deliberately no left accent bar.
 */
export function SessionRow({
  session,
  selected,
  now,
  onSelect,
}: {
  session: Session;
  selected: boolean;
  /** One timestamp shared across the visible rows for the relative-time labels; the caller
   *  re-renders every few seconds to keep it fresh. */
  now: number;
  onSelect: () => void;
}) {
  const projectLine = session.branch
    ? `${session.project} · ${session.branch}`
    : session.project;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Open ${session.title}`}
      className={cx(
        "block w-full rounded px-2 py-1.5 text-left transition-colors",
        focusRingInset,
        selected ? "bg-ink-850" : "hover:bg-ink-900",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Dot state={session.state} management={session.management} />
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-body text-fg",
            selected ? "font-semibold" : "font-medium",
          )}
          title={session.title}
        >
          {session.title}
        </span>
        <span className="shrink-0 font-mono text-label tabular-nums text-fg-faint">
          {formatRelativeTime(session.lastActivityMs, now)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 pl-3.5">
        <span
          className="min-w-0 flex-1 truncate font-mono text-label text-fg-faint"
          title={projectLine}
        >
          {projectLine}
        </span>
        {isContextHigh(session.contextPct) && (
          <span
            className={cx(
              "shrink-0 font-mono text-label tabular-nums",
              ctxTone(session.contextPct),
            )}
          >
            {session.contextPct}%
          </span>
        )}
      </div>
    </button>
  );
}
