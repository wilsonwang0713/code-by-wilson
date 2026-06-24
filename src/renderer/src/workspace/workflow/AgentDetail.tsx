import type { WorkflowAgent } from "@shared/types";
import { TranscriptFeed } from "../TranscriptView";
import type { DocState } from "../use-transcript";
import { cx } from "../../ui/atoms";
import { OverlayScroll } from "../../ui/OverlayScroll";

/** One pill in the agent detail header. */
function Pill({ children, tone }: { children: string; tone?: string }) {
  return (
    <span
      className={cx(
        "rounded border border-ink-800 px-1.5 py-0.5 text-[10px]",
        tone ?? "text-fg-faint",
      )}
    >
      {children}
    </span>
  );
}

/** The detail pane for a selected workflow agent: an identity header plus its live transcript feed.
 *  Tool rows render inline; the full-output modal is omitted in v1 (getToolResult can't resolve the
 *  workflow-nested agent path). */
export function AgentDetail({
  agent,
  doc,
}: {
  agent: WorkflowAgent;
  doc: DocState;
}) {
  const running = agent.state === "running";
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-ink-850 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12px] font-semibold text-fg">
            {agent.label}
          </span>
          <span className="flex-1" />
          <span
            className={cx(
              "font-mono text-[10px] tabular-nums",
              running ? "text-fg" : "text-fg-faint",
            )}
          >
            {agent.state}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill>{agent.phaseTitle}</Pill>
          {agent.model ? <Pill>{agent.model}</Pill> : null}
          <Pill>{`${Math.round(agent.tokens / 1000)}k tok`}</Pill>
          <Pill>{`${agent.toolCalls} tools`}</Pill>
          {running && agent.lastToolName ? (
            <Pill tone="text-fg animate-pulse-soft">{agent.lastToolName}</Pill>
          ) : null}
        </div>
      </div>
      <OverlayScroll className="min-h-0 flex-1">
        {doc === null ? (
          <div className="p-3 text-[12px] text-fg-faint">
            No transcript on disk for this agent yet.
          </div>
        ) : (
          <TranscriptFeed key={agent.id} events={doc?.events ?? []} />
        )}
      </OverlayScroll>
    </div>
  );
}
