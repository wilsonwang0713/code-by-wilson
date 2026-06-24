import type { WorkflowRun } from "@shared/types";
import { formatDuration } from "@shared/format";
import { cx } from "../../ui/atoms";

/** One stat cell in the run header. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="font-mono text-[11px] tabular-nums text-fg-faint">
      <span className="text-fg-muted">{value}</span>
      {label ? ` ${label}` : ""}
    </span>
  );
}

/** The workflow run's header row: name, status badge, args, and the headline tallies. */
export function WorkflowHeader({ run }: { run: WorkflowRun }) {
  const running = run.status === "running";
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="text-[13px] font-semibold text-fg">
        {run.workflowName}
      </span>
      <span
        className={cx(
          "rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-fg-muted",
          running && "animate-pulse-soft text-fg",
        )}
      >
        {run.status}
      </span>
      {run.args ? (
        <span className="rounded border border-ink-800 px-1.5 py-0.5 text-[10px] text-fg-faint">
          {run.args}
        </span>
      ) : null}
      <span className="flex-1" />
      <Stat value={String(run.agentCount)} label="agents" />
      <Stat value={`${Math.round(run.totalTokens / 1000)}k`} label="tok" />
      <Stat value={formatDuration(run.durationMs)} label="" />
      <Stat value={String(run.totalToolCalls)} label="tools" />
    </div>
  );
}
