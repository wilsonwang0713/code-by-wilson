import type { ReactNode } from "react";
import { useSubagentTranscript } from "./use-subagent-transcript";
import { TranscriptFeed } from "./TranscriptView";

/** One level of the drill path: which subagent, and the label shown in the breadcrumb (its type). */
export type SubagentCrumb = { agentId: string; label: string };

/**
 * The drilled-in Subagent surface: a breadcrumb (Session › … › <type>, read-only marked) above the
 * shared event feed, fed by the subagent transcript poll. Always read-only — a Subagent is never
 * drivable, even drilled from a Managed Session. The feed is keyed on the current agent id so
 * re-drilling remounts to a fresh tail while same-agent polls preserve scroll.
 */
export function SubagentDrill({
  sessionId,
  crumbs,
  onNavigate,
}: {
  sessionId: string;
  crumbs: SubagentCrumb[];
  onNavigate: (depth: number) => void;
}) {
  const current = crumbs[crumbs.length - 1];
  const doc = useSubagentTranscript(sessionId, current.agentId);
  return (
    <div className="flex h-full flex-col">
      <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} />
      <div className="min-h-0 flex-1 overflow-auto">
        {doc === null ? (
          <Centered>No transcript on disk for this subagent yet.</Centered>
        ) : (
          <TranscriptFeed key={current.agentId} events={doc?.events ?? []} />
        )}
      </div>
    </div>
  );
}

/** The drill path: a clickable "Session" root that pops back to the Session transcript, then each
 *  subagent crumb (intermediate crumbs clickable, the current one not), with a read-only marker. */
function Breadcrumb({
  crumbs,
  onNavigate,
}: {
  crumbs: SubagentCrumb[];
  onNavigate: (depth: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-925 px-4 py-2 text-[11px]">
      <button
        type="button"
        onClick={() => onNavigate(0)}
        className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg"
      >
        <span aria-hidden>←</span> Session
      </button>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.agentId} className="flex items-center gap-2">
            <span className="text-ink-700">›</span>
            {last ? (
              <span className="font-semibold text-fg">{c.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(i + 1)}
                className="text-fg-muted transition-colors hover:text-fg"
              >
                {c.label}
              </button>
            )}
          </span>
        );
      })}
      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent-bright">
        ● Read-only subagent
      </span>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-fg-faint">
      {children}
    </div>
  );
}
