import type { Account, Session } from "@shared/types";
import { useTranscript } from "../workspace/use-transcript";
import type { MetricsState } from "../workspace/use-metrics";
import { PressurePanel } from "../workspace/panels/PressurePanel";
import { SpendPanel } from "../workspace/panels/SpendPanel";
import { TokenSpeedPanel } from "../workspace/panels/TokenSpeedPanel";
import { DutyPanel } from "../workspace/panels/DutyPanel";
import { IdentityPanel } from "./IdentityPanel";

/**
 * The right sidebar's content (design spec §6): an empty draggable top strip — the fixed right
 * toggle cluster floats over it — then the telemetry panel stack: Identity, Pressure, Spend,
 * Throughput, Duty. Renders as plain content — the caller slots it inside a `Pane` (Task 11), so
 * this owns no width/position of its own beyond filling its parent.
 *
 * Polls its own transcript: this pane is now a sibling of `Workspace` at the App level rather than a
 * child of it, so it can't share `WorkspaceBody`'s `useTranscript` poll — a second independent poll of the
 * same session is the accepted minor cost (mirrors `metrics` needing its own App-level call per Task 11).
 */
export function RightSidebar({
  session,
  metrics,
  account,
}: {
  session: Session;
  metrics: MetricsState;
  account: Account | null;
}) {
  const doc = useTranscript(session.id);
  return (
    <div className="flex h-full flex-col border-l border-(--ui-stroke-secondary) bg-(--ui-sidebar-surface-background) text-(--ui-text-tertiary) shadow-[inset_0.0625rem_0_0_color-mix(in_srgb,white_12%,transparent)]">
      <div
        className="drag-region shrink-0 select-none"
        style={{ height: "var(--titlebar-height)" }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col pb-2">
          <IdentityPanel
            session={session}
            git={metrics?.git}
            pr={metrics?.pr}
          />
          <PressurePanel
            live={session.liveContext ?? null}
            context={doc?.context ?? null}
            contextPct={session.contextPct}
            contextWindow={session.contextWindow}
            account={account}
          />
          <SpendPanel
            usageByModel={session.usageByModel ?? []}
            costUsd={session.costUsd ?? null}
          />
          <TokenSpeedPanel speed={metrics ? metrics.tokenSpeed : null} />
          <DutyPanel
            apiDurationMs={session.apiDurationMs ?? null}
            sessionClockMs={session.sessionClockMs ?? null}
          />
        </div>
      </div>
    </div>
  );
}
