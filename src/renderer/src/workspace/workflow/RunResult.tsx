import type { WorkflowRun } from "@shared/types";

/** Render the run's result generically: a string as text, anything else as pretty JSON. The result's
 *  shape is workflow-defined, so this never assumes a schema (e.g. code-review's findings). */
function ResultBody({ result }: { result: unknown }) {
  if (result === undefined || result === null) return null;
  const text =
    typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-ink-800 bg-ink-900 p-2 font-mono text-[11px] leading-relaxed text-fg-muted">
      {text}
    </pre>
  );
}

/** The default detail pane for a run: its one-line summary, the generic result, and the log trail. */
export function RunResult({ run }: { run: WorkflowRun }) {
  return (
    <div className="p-3">
      <div className="text-[12px] font-semibold text-fg">Result</div>
      {run.summary ? (
        <p className="mt-1.5 border-l-2 border-ink-700 pl-2 text-[12px] leading-relaxed text-fg-muted">
          {run.summary}
        </p>
      ) : null}
      {(() => {
        const pending =
          run.status === "running" &&
          (run.result === undefined || run.result === null);
        return pending ? (
          <p className="mt-2 flex items-center gap-2 text-[11px] text-fg-muted">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-fg-muted" />
            Run in progress — result pending.
          </p>
        ) : (
          <ResultBody result={run.result} />
        );
      })()}
      {run.logs.length > 0 && (
        <div className="mt-3 border-t border-ink-850 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-fg-faint">
            Trail
          </div>
          <ul className="mt-1 space-y-0.5">
            {run.logs.map((line, i) => (
              <li
                key={i}
                className="font-mono text-[11px] leading-relaxed text-fg-faint"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
