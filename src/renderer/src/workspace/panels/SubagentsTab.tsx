import type { Subagent } from "@shared/types";
import { formatDuration, formatTokens } from "@shared/format";
import { cx } from "../../ui/atoms";
import { FAMILY_LABEL } from "../../ui/meta";
import { EmptyState } from "./chrome";
import {
  type SubagentStats,
  flattenSubagents,
  subagentStats,
} from "./dock-tabs";

/** A just-spawned or near-instant lane still shows this sliver, so it never vanishes at the floor. */
const MIN_BAR = 0.03;

const GLYPH: Record<Subagent["status"], string> = {
  working: "◐",
  done: "✓",
  failed: "✕",
};

/** Per-status lane treatment: the duration fill, its left cap, and the glyph tone. Working pulses; done
 *  stays calm so working (teal) and failed (red) pop as the states worth acting on. */
const LANE_META: Record<
  Subagent["status"],
  { fill: string; cap: string; glyph: string }
> = {
  working: {
    fill: "bg-working/20",
    cap: "border-working",
    glyph: "text-working-bright",
  },
  done: { fill: "bg-ok/10", cap: "border-ok", glyph: "text-fg-muted" },
  failed: { fill: "bg-danger/20", cap: "border-danger", glyph: "text-danger" },
};

/** One Subagent as a lane: a duration-sized fill behind a metadata row (type, model, tokens, duration).
 *  Bar width is the agent's duration relative to the longest lane, floored so a sliver always shows. */
function SubagentLane({
  agent,
  maxDurationMs,
}: {
  agent: Subagent;
  maxDurationMs: number;
}) {
  const frac =
    maxDurationMs > 0
      ? Math.max(MIN_BAR, agent.durationMs / maxDurationMs)
      : MIN_BAR;
  const meta = LANE_META[agent.status];
  return (
    <li className="relative h-[26px] overflow-hidden rounded-sm bg-ink-900">
      <div
        className={cx(
          "absolute inset-y-0 left-0 border-l-2 transition-[width] duration-700 ease-out",
          meta.fill,
          meta.cap,
          agent.status === "working" && "animate-pulse-soft",
        )}
        style={{ width: `${(frac * 100).toFixed(1)}%` }}
      />
      <div className="relative flex h-full items-center gap-2 px-2">
        <span className={cx("shrink-0 font-mono text-[11px]", meta.glyph)}>
          {GLYPH[agent.status]}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[12px] text-fg"
          title={agent.type}
        >
          {agent.type}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-fg-faint">
          {agent.model ? FAMILY_LABEL[agent.model] : "—"}
        </span>
        <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg-muted">
          {formatTokens(agent.tokens)}
        </span>
        <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg-faint">
          {formatDuration(agent.durationMs)}
        </span>
      </div>
    </li>
  );
}

/** One term of the tally, dimmed to faint when its count is zero so an all-done fan-out reads calm. */
function TallyTerm({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: string;
}) {
  return (
    <span className={n > 0 ? tone : "text-fg-faint"}>
      {n} {label}
    </span>
  );
}

/** The running / done / failed tally, pinned above the lanes so the fan-out's state reads at a glance. */
function SubagentTally({ stats }: { stats: SubagentStats }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-800 bg-ink-925 px-4 py-2 font-mono text-[10px] font-semibold tabular-nums">
      <TallyTerm n={stats.working} label="running" tone="text-working-bright" />
      <span className="text-ink-800">·</span>
      <TallyTerm n={stats.done} label="done" tone="text-ok" />
      <span className="text-ink-800">·</span>
      <TallyTerm n={stats.failed} label="failed" tone="text-danger" />
    </div>
  );
}

/**
 * The Structure dock's Subagents tab: a live lane timeline of the fan-out. Each Subagent is a lane whose
 * bar is sized by duration and coloured by status, with a running / done / failed tally above. Working
 * lanes pulse and their bars grow as the poll advances the agent's transcript. Flat (the forest is
 * flattened); sorting and drill-in are later slices. Shows an empty state until the session spawns one.
 */
export function SubagentsTab({ subagents }: { subagents: Subagent[] }) {
  if (subagents.length === 0) return <EmptyState>No subagents yet.</EmptyState>;
  const lanes = flattenSubagents(subagents);
  const stats = subagentStats(subagents);
  const maxDurationMs = lanes.reduce((m, l) => Math.max(m, l.durationMs), 0);
  return (
    <div>
      <SubagentTally stats={stats} />
      <ul className="space-y-1 px-4 py-3">
        {lanes.map((a) => (
          <SubagentLane key={a.id} agent={a} maxDurationMs={maxDurationMs} />
        ))}
      </ul>
    </div>
  );
}
