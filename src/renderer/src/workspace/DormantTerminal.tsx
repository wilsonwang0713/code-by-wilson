import type { Session } from "@shared/types";
import { Icon } from "../ui/icons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useResumeAction } from "./resume-action";

/**
 * The Terminal tab for an Ended session: a fully dark, dormant canvas with the two ways to bring it back
 * — Adopt (resume under its own id, primary) and Fork (branch into a new id, secondary). Transcript stays
 * the default tab; this is what the Terminal tab shows once the pty is gone. Both buttons reuse the
 * header's resume state machine (busy / inline error / no-model confirm).
 */
export function DormantTerminal({
  session: s,
  canSpawn,
  onAdopt,
  onFork,
}: {
  session: Session;
  canSpawn: boolean;
  onAdopt: (id: string) => Promise<void>;
  onFork: (session: Session) => Promise<void>;
}) {
  const modelUnknown = s.modelId == null && s.modelRaw == null;
  const adopt = useResumeAction({
    run: () => onAdopt(s.id),
    modelUnknown,
    armed: true,
  });
  const fork = useResumeAction({
    run: () => onFork(s),
    modelUnknown,
    armed: true,
  });
  const cliTitle = canSpawn
    ? undefined
    : "Claude Code CLI isn't usable — see Sys status in the title bar.";

  return (
    <div className="relative flex h-full items-center justify-center bg-ink-950">
      <span className="absolute left-4 top-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-600" />
        Ended
      </span>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[13px] text-fg-faint">
          This session has ended. Bring it back to life.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={adopt.request}
            disabled={adopt.busy || !canSpawn}
            title={cliTitle}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-ink-950 ring-1 ring-primary/40 transition-colors enabled:hover:bg-primary-bright disabled:opacity-40"
          >
            <Icon name="git-pull-request-arrow" size={15} />
            {adopt.busy ? "Adopting…" : "Adopt"}
          </button>
          <button
            type="button"
            onClick={fork.request}
            disabled={fork.busy || !canSpawn}
            title={cliTitle}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-4 py-2 text-[13px] font-semibold text-fg-muted transition-colors enabled:hover:border-ink-600 enabled:hover:text-fg disabled:opacity-40"
          >
            <Icon name="git-branch" size={15} />
            {fork.busy ? "Forking…" : "Fork"}
          </button>
        </div>
        {(adopt.error || fork.error) && (
          <span className="text-[11px] text-danger">
            {adopt.error ?? fork.error}
          </span>
        )}
        <span className="text-[11px] text-fg-faint">
          Adopt = take the wheel · Fork = explore a new branch
        </span>
      </div>
      {adopt.confirmOpen && (
        <ConfirmDialog
          title="Resume a session with no recorded model?"
          body="This session never recorded a model — it likely errored before its first turn — so resuming it may fail with a model error. Continue anyway?"
          confirmLabel="Resume anyway"
          onCancel={adopt.confirmNo}
          onConfirm={adopt.confirmYes}
        />
      )}
      {fork.confirmOpen && (
        <ConfirmDialog
          title="Fork a session with no recorded model?"
          body="This session never recorded a model — it likely errored before its first turn — so forking it may fail with a model error. Continue anyway?"
          confirmLabel="Fork anyway"
          onCancel={fork.confirmNo}
          onConfirm={fork.confirmYes}
        />
      )}
    </div>
  );
}
