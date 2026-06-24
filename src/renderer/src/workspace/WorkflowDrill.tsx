import type { WorkflowRun } from "@shared/types";
import { cx, focusRing } from "../ui/atoms";
import { OverlayScroll } from "../ui/OverlayScroll";
import { AgentList } from "./workflow/AgentList";
import { PhaseStrip } from "./workflow/PhaseStrip";
import { WorkflowHeader } from "./workflow/WorkflowHeader";
import { RunResult } from "./workflow/RunResult";
import { AgentDetail } from "./workflow/AgentDetail";
import type { DocState } from "./use-transcript";

/** Tri-state run, from useWorkflowRun: undefined = loading, null = absent, a run once read. */
type RunState = WorkflowRun | null | undefined;

/** The breadcrumb back to the session transcript. */
function WorkflowCrumb({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-ink-800 px-3 py-1.5 text-[11px]">
      <button
        type="button"
        onClick={onBack}
        className={cx(
          "rounded text-fg-faint transition-colors hover:text-fg",
          focusRing,
        )}
      >
        Session
      </button>
      <span className="text-fg-faint">›</span>
      <span className="truncate text-fg-muted">{name}</span>
    </div>
  );
}

/**
 * The dedicated workflow-run surface, drilled into the center pane. Renders the run header, phase strip,
 * and a master/detail split: the agent list on the left, and either the selected agent's transcript or
 * the run result on the right. When no agents exist yet, renders the run result full-width.
 */
export function WorkflowDrill({
  run,
  name,
  onBack,
  selectedAgentId,
  onSelectAgent,
  agentDoc,
}: {
  run: RunState;
  name: string;
  onBack: () => void;
  selectedAgentId?: string;
  onSelectAgent: (id: string) => void;
  agentDoc: DocState;
}) {
  return (
    <div className="flex h-full flex-col">
      <WorkflowCrumb name={name} onBack={onBack} />
      {run === null ? (
        <div className="p-3 text-[12px] text-fg-faint">
          No record on disk for this run yet.
        </div>
      ) : run === undefined ? (
        <div className="p-3 text-[12px] text-fg-faint">Loading run…</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <WorkflowHeader run={run} />
          <PhaseStrip phases={run.phases} />
          {run.agents.length === 0 ? (
            <OverlayScroll className="min-h-0 flex-1 border-t border-ink-850">
              <RunResult run={run} />
            </OverlayScroll>
          ) : (
            <div className="flex min-h-0 flex-1 border-t border-ink-850">
              <OverlayScroll className="min-h-0 w-80 shrink-0 border-r border-ink-850">
                <AgentList
                  run={run}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={onSelectAgent}
                />
              </OverlayScroll>
              <div className="min-h-0 flex-1">
                {(() => {
                  const selected =
                    selectedAgentId !== undefined
                      ? run.agents.find((a) => a.id === selectedAgentId)
                      : undefined;
                  return selected ? (
                    <AgentDetail agent={selected} doc={agentDoc} />
                  ) : (
                    <OverlayScroll className="h-full">
                      <RunResult run={run} />
                    </OverlayScroll>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
