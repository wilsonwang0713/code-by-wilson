import type { Session } from "@shared/types";
import { Icon } from "../ui/icons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useResumeAction } from "./resume-action";

/**
 * The Terminal tab for a session cbw has no live in-app pty for — an Observed session (running in another
 * terminal) or any Ended one (including a just-exited Managed session that re-derives Observed). A dark
 * canvas offering the ways to take it in-app: Fork (branch the conversation into a new id) is always
 * available; Adopt (resume this exact id) shows only for an Observed session that has Ended — matching the
 * header's gate, since you can't take the wheel of a process that's still running, and a just-exited
 * Managed session still reads Managed until the next sync re-derives it Observed. Transcript stays the
 * default tab. Both buttons reuse the header's resume state machine (busy / inline error / no-model confirm).
 */
export function ObservedTerminal({
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
  const ended = s.state === "ended";
  // Adopt resumes this exact id, so it's offered only for an Observed session that has Ended — the same
  // gate the header uses. A still-Managed session that has merely exited re-derives Observed on the next
  // sync; until then Fork is the only resume offered here, exactly as in the header.
  const canAdopt = s.management === "observed" && ended;
  const modelUnknown = s.modelId == null && s.modelRaw == null;
  // `armed` stays true for both: this panel is keyed by session id (Workspace remounts on a session
  // switch), so the hooks' transient state resets on remount and never needs the in-place re-arm cleanup
  // the header relies on (where Adopt can disappear and reappear within one mounted HeaderActions).
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
  // Both Adopt (`claude --resume`) and Fork (`--fork-session`) read this session's transcript. A session
  // that never wrote one — a spawn/fork that died before its first turn — has nothing to resume, so the
  // CLI would die on "No conversation found". Block both until it has a saved conversation.
  const resumeTitle = (verb: string): string | undefined =>
    !canSpawn
      ? cliTitle
      : s.resumable
        ? undefined
        : `Nothing to ${verb} — this session never saved a conversation.`;

  return (
    <div className="relative flex h-full items-center justify-center bg-ink-950">
      <span className="absolute left-4 top-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-600" />
        {ended ? "Ended" : "Observed"}
      </span>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[13px] text-fg-faint">
          {ended
            ? "This session has ended. Bring it back to life."
            : "This session is running in another terminal — read-only here."}
        </p>
        <div className="flex items-center gap-3">
          {canAdopt && (
            <button
              type="button"
              onClick={adopt.request}
              disabled={adopt.busy || !canSpawn || !s.resumable}
              title={resumeTitle("adopt")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-ink-950 ring-1 ring-primary/40 transition-colors enabled:hover:bg-primary-bright disabled:opacity-40"
            >
              <Icon name="git-pull-request-arrow" size={15} />
              {adopt.busy ? "Adopting…" : "Adopt"}
            </button>
          )}
          <button
            type="button"
            onClick={fork.request}
            disabled={fork.busy || !canSpawn || !s.resumable}
            title={resumeTitle("fork")}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-4 py-2 text-[13px] font-semibold text-fg-muted transition-colors enabled:hover:border-ink-600 enabled:hover:text-fg disabled:opacity-40"
          >
            <Icon name="git-branch" size={15} />
            {fork.busy ? "Forking…" : "Fork"}
          </button>
        </div>
        {/* Each action owns its own error line, so a stale Adopt failure never masks a fresh Fork one
            (and vice versa) when both buttons are present on an Ended session. */}
        {adopt.error && (
          <span className="text-[11px] text-danger">{adopt.error}</span>
        )}
        {fork.error && (
          <span className="text-[11px] text-danger">{fork.error}</span>
        )}
        <span className="text-[11px] text-fg-faint">
          {canAdopt
            ? "Adopt = take the wheel · Fork = explore a new branch"
            : "Fork it to branch off into your own session."}
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
