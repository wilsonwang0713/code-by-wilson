import type { Session } from "@shared/types";
import { Icon } from "../ui/icons";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { OpenInMenu } from "./OpenInMenu";
import { ResumeButton } from "./ResumeButton";
import { useSessionActions } from "./session-actions";

/** The header's right-side action cluster: Adopt + Fork + End session, then Open in last. Fork shows on
 *  every session; Adopt joins it (and leads) on every Ended session — disabled while a just-exited Managed
 *  one still reads Managed, then enabling once the next sync re-derives it Observed. End session shows only on
 *  a live Managed session (the one whose pty we own); a turn in flight routes its click through a confirm.
 *  Status chips live on the header's second line, not here. */
export function HeaderActions({
  session: s,
  canSpawn,
  onAdopt,
  onFork,
  onEnd,
}: {
  session: Session;
  /** Whether the Claude Code CLI is usable. Adopt and Fork both resume by spawning the CLI, so they're
   *  disabled (like the rail's New-session button) when the CLI is notFound/unknown. */
  canSpawn: boolean;
  onAdopt: (id: string) => Promise<void>;
  onFork: (session: Session) => Promise<void>;
  /** End the running Managed session (kills the pty we own). */
  onEnd: (id: string) => void;
}) {
  const { ended, live, canAdopt, adopt, fork, end } = useSessionActions(s, {
    onAdopt,
    onFork,
    onEnd,
  });

  // The gate + tooltip + no-model confirm live in ResumeButton, single-sourced so the two surfaces can't
  // disagree. This row owns only layout: each action's inline error sits before its button (the cluster
  // reads left-to-right), and the chip styling differs from the hero's.
  return (
    <div className="flex shrink-0 items-center gap-2">
      {ended && (
        <>
          {adopt.error && (
            <span className="text-meta text-danger">{adopt.error}</span>
          )}
          <ResumeButton
            kind="adopt"
            action={adopt}
            canSpawn={canSpawn}
            resumable={s.resumable}
            available={canAdopt}
            iconSize={13}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-aux font-medium text-ink-950 ring-1 ring-primary/40 transition-colors enabled:hover:bg-primary-bright disabled:opacity-40"
          />
        </>
      )}

      {fork.error && (
        <span className="text-meta text-danger">{fork.error}</span>
      )}
      <ResumeButton
        kind="fork"
        action={fork}
        canSpawn={canSpawn}
        resumable={s.resumable}
        iconSize={13}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900 px-2.5 py-1 text-aux text-fg-muted transition-colors enabled:hover:border-ink-700 enabled:hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-40"
      />

      {live && (
        <>
          <button
            type="button"
            onClick={end.request}
            title="End this session"
            className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1 text-aux text-danger transition-colors hover:border-danger/50 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/40"
          >
            <Icon name="square" size={13} />
            End session
          </button>
          {end.confirmOpen && (
            <ConfirmDialog
              title="End this session?"
              body="A turn is in progress and will be interrupted. The conversation is saved and can be resumed later with Adopt."
              confirmLabel="End session"
              tone="danger"
              onConfirm={end.confirmYes}
              onCancel={end.confirmNo}
            />
          )}
        </>
      )}

      <Divider />

      <OpenInMenu sessionId={s.id} />
    </div>
  );
}

/** A thin vertical rule between action groups. */
function Divider() {
  return <span className="h-4 w-px bg-ink-800" />;
}
