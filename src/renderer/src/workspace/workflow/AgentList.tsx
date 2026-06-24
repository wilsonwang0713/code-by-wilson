import type { WorkflowRun, WorkflowAgent } from "@shared/types";
import { cx, focusRingInset } from "../../ui/atoms";

/** The run's time bounds for the shared micro-timeline axis: earliest start to latest end among agents. */
function runBounds(agents: WorkflowAgent[]): { start: number; end: number } {
  let start = Infinity;
  let end = -Infinity;
  for (const a of agents) {
    const s = a.startMs ?? a.queuedMs;
    if (s !== undefined) {
      if (s < start) start = s;
      const e = s + a.durationMs;
      if (e > end) end = e;
    }
  }
  if (!Number.isFinite(start)) return { start: 0, end: 1 };
  return { start, end: end > start ? end : start + 1 };
}

/** A single agent row: state dot, label, a micro-timeline bar positioned on the shared axis, and tokens. */
function AgentRow({
  agent,
  bounds,
  selected,
  onSelect,
}: {
  agent: WorkflowAgent;
  bounds: { start: number; end: number };
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const span = bounds.end - bounds.start;
  const s = agent.startMs ?? agent.queuedMs;
  const leftPct =
    s !== undefined ? Math.max(0, ((s - bounds.start) / span) * 100) : 0;
  const widthPct =
    s !== undefined
      ? Math.min(100 - leftPct, Math.max(2, (agent.durationMs / span) * 100))
      : 0;
  const running = agent.state === "running";
  const dotTone = running
    ? "bg-primary animate-pulse-soft"
    : agent.state === "done"
      ? "bg-primary-deep"
      : agent.state === "queued"
        ? "bg-ink-600"
        : "bg-fg-muted";
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      aria-label={`Open transcript for ${agent.label}`}
      className={cx(
        "flex w-full items-center gap-2 px-3 py-1 text-left transition-colors",
        focusRingInset,
        selected
          ? "bg-ink-850 shadow-[inset_2px_0_0] shadow-fg-muted"
          : "hover:bg-ink-900",
      )}
    >
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dotTone)} />
      <span
        className="w-28 shrink-0 truncate text-[11px] text-fg-muted"
        title={agent.label}
      >
        {agent.label}
      </span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900">
        {s !== undefined && (
          <span
            className={cx(
              "absolute inset-y-0 rounded-full",
              running
                ? "bg-primary animate-pulse-soft"
                : agent.state === "done"
                  ? "bg-primary-deep"
                  : "bg-fg-muted",
            )}
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />
        )}
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg-faint">
        {Math.round(agent.tokens / 1000)}k
      </span>
    </button>
  );
}

/** A group header with its agent tally, over the group's agent rows. The phase title labels a declared
 *  phase; live runs (no agent→phase map on disk) fall back to a plain "Agents" group. */
function AgentGroup({
  title,
  total,
  agents,
  bounds,
  selectedAgentId,
  onSelectAgent,
}: {
  title: string;
  total: number;
  agents: WorkflowAgent[];
  bounds: { start: number; end: number };
  selectedAgentId?: string;
  onSelectAgent: (id: string | undefined) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 border-t border-ink-850 px-3 py-1">
        <span className="text-[11px] font-semibold text-fg">{title}</span>
        <span className="font-mono text-[10px] tabular-nums text-fg-faint">
          {total}
        </span>
      </div>
      {agents.map((a) => (
        <AgentRow
          key={a.id}
          agent={a}
          bounds={bounds}
          selected={a.id === selectedAgentId}
          onSelect={onSelectAgent}
        />
      ))}
    </div>
  );
}

/** The master pane: a Result entry plus agents grouped by phase, each row carrying a micro-timeline bar on
 *  a shared axis so the streaming overlap survives in the list. Selecting Result (or clicking it to clear
 *  the agent) swaps the detail pane back to the run result; selecting an agent shows its transcript. */
export function AgentList({
  run,
  selectedAgentId,
  onSelectAgent,
}: {
  run: WorkflowRun;
  selectedAgentId?: string;
  onSelectAgent: (id: string | undefined) => void;
}) {
  const bounds = runBounds(run.agents);
  const phaseIndexes = new Set(run.phases.map((p) => p.index));
  // Agents whose phaseIndex matches no declared phase — every agent on a live run, where the phase map
  // isn't on disk yet. Rendered in a trailing "Agents" group so they never silently drop from the list.
  const ungrouped = run.agents.filter((a) => !phaseIndexes.has(a.phaseIndex));
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => onSelectAgent(undefined)}
        className={cx(
          "flex w-full items-center px-3 py-1.5 text-left text-[11px] font-semibold text-fg transition-colors",
          focusRingInset,
          selectedAgentId === undefined
            ? "bg-ink-850 shadow-[inset_2px_0_0] shadow-fg-muted"
            : "hover:bg-ink-900",
        )}
      >
        Result
      </button>
      {run.phases.map((p) => {
        const agents = run.agents.filter((a) => a.phaseIndex === p.index);
        if (agents.length === 0) return null;
        return (
          <AgentGroup
            key={p.index}
            title={p.title}
            total={p.agentsTotal}
            agents={agents}
            bounds={bounds}
            selectedAgentId={selectedAgentId}
            onSelectAgent={onSelectAgent}
          />
        );
      })}
      {ungrouped.length > 0 && (
        <AgentGroup
          title="Agents"
          total={ungrouped.length}
          agents={ungrouped}
          bounds={bounds}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
        />
      )}
    </div>
  );
}
