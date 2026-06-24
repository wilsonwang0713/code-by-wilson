import type { WorkflowRun } from "@shared/types";
import { cx } from "../../ui/atoms";
import { RunStats } from "./RunStats";

/** The workflow run's header row: name, status badge, args, and the headline stats. */
export function WorkflowHeader({ run }: { run: WorkflowRun }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="text-[13px] font-semibold text-fg">
        {run.workflowName}
      </span>
      <span
        className={cx(
          "rounded border px-1.5 py-0.5 text-[10px]",
          run.status === "running"
            ? "animate-pulse-soft border-working text-working-bright"
            : run.status === "completed"
              ? "border-ok text-ok"
              : run.status === "failed"
                ? "border-danger text-danger"
                : "border-ink-700 text-fg-muted",
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
      <RunStats run={run} />
    </div>
  );
}
