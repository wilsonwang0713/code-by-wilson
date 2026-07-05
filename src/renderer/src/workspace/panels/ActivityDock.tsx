import { useMemo, useState } from "react";
import type { Subagent, Task, BackgroundShell } from "@shared/types";
import { Icon } from "../../ui/icons";
import { Tabs } from "../../ui/Tabs";
import { SidebarPanelLabel } from "../../shell/SidebarPanelLabel";
import type { DocState } from "../use-transcript";
import { DockTasks } from "./DockTasks";
import { SubagentsTab } from "./SubagentsTab";
import { ShellsTab } from "./ShellsTab";
import { OverlayScroll } from "../../ui/OverlayScroll";
import {
  type DockTab,
  type DockCollapseOverride,
  type SubagentStats,
  defaultDockTab,
  dockHasActivity,
  resolveDockCollapsed,
  subagentStats,
} from "./dock-tabs";

/**
 * The Session workspace's bottom Activity dock: a single tabbed section (Tasks / Subagents / Shells)
 * spanning the center column below the live view. Collapses to a thin tally bar so the Transcript
 * can take the full height, and width-gates with the rail (hidden below `lg`) so a narrow window degrades
 * cleanly to just the live view.
 */
export function ActivityDock({
  tasks,
  doc,
  shells,
  now,
  activeAgentId,
  activeShellId,
  onDrill,
  onDrillShell,
}: {
  tasks: Task[];
  doc: DocState;
  shells: BackgroundShell[];
  now: number;
  activeAgentId?: string;
  activeShellId?: string;
  onDrill: (agent: Subagent) => void;
  onDrillShell: (shell: BackgroundShell) => void;
}) {
  const [collapseOverride, setCollapseOverride] =
    useState<DockCollapseOverride | null>(null);
  const subagents = doc?.subagents ?? [];
  // One forest walk feeds the count badge, the live tally, and the default tab. Memoized against the
  // subagents identity (stable between polls) so the 3s render clock doesn't re-walk the forest.
  const stats = useMemo(() => subagentStats(subagents), [subagents]);
  const alive = stats.working > 0;
  // The dock hides itself when idle and reveals itself while any tab has a live entry (a working
  // subagent, an in-progress task, or a running shell). A manual collapse/expand overrides that, but
  // only for the current activity phase — the override lapses when activity starts or stops, so the
  // dock re-follows (same lapsing-override shape as the tab-follow `pick` above).
  const active = dockHasActivity(tasks, stats, shells);
  const collapsed = resolveDockCollapsed(active, collapseOverride);
  // The right tab auto-follows the live fan-out (Subagents while alive, Tasks otherwise). A manual pick
  // overrides that, but only for the current fan-out phase: `pick` records the phase (`alive`) it was
  // chosen under, so when the fan-out starts or ends the pick lapses and the tab re-follows. That way a
  // click during a fan-out never strands the user on a now-empty Subagents tab once it finishes.
  const [pick, setPick] = useState<{ tab: DockTab; alive: boolean } | null>(
    null,
  );
  // While a lane is drilled, hold the Subagents tab so the originating lane (and its active ring) stays
  // visible above the drill surface — otherwise the fan-out finishing would auto-flip to Tasks and orphan
  // the open drill. An in-phase manual pick still wins, so the user can deliberately flip to Tasks.
  const tab =
    pick && pick.alive === alive
      ? pick.tab
      : activeShellId
        ? "shells"
        : activeAgentId
          ? "subagents"
          : defaultDockTab(stats);

  if (collapsed)
    return (
      <DockTally
        tasks={tasks}
        stats={stats}
        shellCount={shells.length}
        onExpand={() => setCollapseOverride({ collapsed: false, active })}
      />
    );

  return (
    <div className="hidden h-64 shrink-0 flex-col border-t border-(--ui-stroke-tertiary) bg-(--ui-surface-background) lg:flex">
      <DockTabBar
        tab={tab}
        onChange={(t) => setPick({ tab: t, alive })}
        taskCount={tasks.length}
        subagentCount={stats.total}
        shellCount={shells.length}
        onCollapse={() => setCollapseOverride({ collapsed: true, active })}
      />
      <OverlayScroll className="min-h-0 flex-1">
        {tab === "tasks" ? (
          <DockTasks tasks={tasks} />
        ) : tab === "subagents" ? (
          <SubagentsTab
            subagents={subagents}
            now={now}
            activeAgentId={activeAgentId}
            onDrill={onDrill}
          />
        ) : (
          <ShellsTab
            shells={shells}
            now={now}
            activeShellId={activeShellId}
            onDrill={onDrillShell}
          />
        )}
      </OverlayScroll>
    </div>
  );
}

/** The dock's header bar: an ACTIVITY overline label, the underline Tabs of Tasks / Subagents / Shells
 *  (each with a count), and a collapse chevron pinned to the right edge. */
function DockTabBar({
  tab,
  onChange,
  taskCount,
  subagentCount,
  shellCount,
  onCollapse,
}: {
  tab: DockTab;
  onChange: (t: DockTab) => void;
  taskCount: number;
  subagentCount: number;
  shellCount: number;
  onCollapse: () => void;
}) {
  return (
    <div className="flex h-8 shrink-0 items-stretch gap-3 border-b border-(--ui-stroke-tertiary) pl-3 pr-2">
      <span className="flex items-center">
        <SidebarPanelLabel>Activity</SidebarPanelLabel>
      </span>
      <Tabs<DockTab>
        tabs={[
          { id: "tasks", label: "Tasks", count: taskCount },
          { id: "subagents", label: "Subagents", count: subagentCount },
          { id: "shells", label: "Shells", count: shellCount },
        ]}
        value={tab}
        onChange={onChange}
        variant="underline"
      />
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse activity dock"
        title="Collapse"
        className="my-auto ml-auto inline-flex size-6 items-center justify-center rounded-sm text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-(--ui-text-primary)"
      >
        <Icon name="chevron-down" size={14} />
      </button>
    </div>
  );
}

/** The collapsed dock: a thin, full-width button that mirrors the expanded bar — the ACTIVITY overline
 *  on the left, a three-count summary where the tabs sit, and the expand chevron pinned right (the same
 *  slot as the collapse chevron; only the glyph direction flips). Clickable to expand. Carries the same
 *  `lg` width gate as the expanded dock. */
function DockTally({
  tasks,
  stats,
  shellCount,
  onExpand,
}: {
  tasks: Task[];
  stats: SubagentStats;
  shellCount: number;
  onExpand: () => void;
}) {
  const tasksDone = tasks.filter((t) => t.status === "completed").length;
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Expand activity dock"
      title="Expand"
      className="hidden h-8 w-full shrink-0 items-center gap-3 border-t border-(--ui-stroke-tertiary) bg-(--ui-surface-background) pl-3 pr-2 text-left transition-colors hover:bg-(--ui-row-hover-background) lg:flex"
    >
      <SidebarPanelLabel>Activity</SidebarPanelLabel>
      <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem] tabular-nums text-(--ui-text-quaternary)">
        {tasksDone}/{tasks.length} tasks · {stats.total} subagents ·{" "}
        {shellCount} shells
      </span>
      <Icon
        name="chevron-up"
        size={14}
        className="shrink-0 text-(--ui-text-tertiary)"
      />
    </button>
  );
}
