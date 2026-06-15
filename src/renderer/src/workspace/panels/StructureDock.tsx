import { useState } from "react";
import type { Task, Subagent } from "@shared/types";
import { cx } from "../../ui/atoms";
import { Icon } from "../../ui/icons";
import type { DocState } from "../use-transcript";
import { DockTasks } from "./DockTasks";
import { TurnsTab } from "./TurnsTab";
import { SubagentsTab } from "./SubagentsTab";
import {
  type DockTab,
  countSubagents,
  countWorkingSubagents,
  defaultDockTab,
} from "./dock-tabs";

/**
 * The Session workspace's bottom Structure dock: a fixed left Tasks segment plus a tabbed right area
 * (Turns / Subagents), spanning the center column below the live view. Replaces the old standalone
 * Timeline strip. Collapses to a thin tally bar so the Transcript can take the full height, and
 * width-gates with the rail (hidden below `lg`) so a narrow window degrades cleanly to just the live view.
 */
export function StructureDock({
  tasks,
  doc,
  now,
}: {
  tasks: Task[];
  doc: DocState;
  now: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const subagents = doc?.subagents ?? [];
  const turns = doc?.turns ?? [];
  // The right tab follows the live fan-out (Subagents while one is alive, Turns otherwise) until the
  // user picks a tab, after which their choice sticks. `null` = no explicit pick yet.
  const [userTab, setUserTab] = useState<DockTab | null>(null);
  const tab = userTab ?? defaultDockTab(subagents);

  if (collapsed)
    return (
      <DockTally
        tasks={tasks}
        turnCount={turns.length}
        subagents={subagents}
        onExpand={() => setCollapsed(false)}
      />
    );

  return (
    <div className="hidden h-64 shrink-0 border-t border-ink-800 bg-ink-925 lg:flex">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-ink-800 p-3">
        <DockTasks tasks={tasks} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <DockTabBar
          tab={tab}
          onChange={setUserTab}
          turnCount={turns.length}
          subagentCount={countSubagents(subagents)}
          onCollapse={() => setCollapsed(true)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "turns" ? (
            <TurnsTab turns={turns} now={now} />
          ) : (
            <SubagentsTab subagents={subagents} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The dock's tab bar: a well-track pill of Turns / Subagents (each with a count) plus a collapse glyph,
 *  matching the center column's Terminal/Transcript ViewTabs styling. */
function DockTabBar({
  tab,
  onChange,
  turnCount,
  subagentCount,
  onCollapse,
}: {
  tab: DockTab;
  onChange: (t: DockTab) => void;
  turnCount: number;
  subagentCount: number;
  onCollapse: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-ink-800 px-3 py-2">
      <div className="inline-flex items-center gap-0.5 rounded-md border border-ink-800 bg-well p-0.5">
        <DockTabButton
          active={tab === "turns"}
          onClick={() => onChange("turns")}
          label="Turns"
          count={turnCount}
        />
        <DockTabButton
          active={tab === "subagents"}
          onClick={() => onChange("subagents")}
          label="Subagents"
          count={subagentCount}
        />
      </div>
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse structure dock"
        title="Collapse"
        className="ml-auto inline-flex items-center justify-center rounded p-1 text-fg-faint transition-colors hover:text-fg"
      >
        <Icon name="chevron-down" size={14} />
      </button>
    </div>
  );
}

function DockTabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "bg-ink-900 font-semibold text-fg"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
      <span className="font-mono text-[10px] tabular-nums text-fg-faint">
        {count}
      </span>
    </button>
  );
}

/** The collapsed dock: a thin, full-width button summarizing tasks, turns, and subagents, clickable to
 *  expand. Carries the same `lg` width gate as the expanded dock. */
function DockTally({
  tasks,
  turnCount,
  subagents,
  onExpand,
}: {
  tasks: Task[];
  turnCount: number;
  subagents: Subagent[];
  onExpand: () => void;
}) {
  const tasksDone = tasks.filter((t) => t.status === "completed").length;
  const subCount = countSubagents(subagents);
  const working = countWorkingSubagents(subagents);
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Expand structure dock"
      title="Expand"
      className="hidden w-full shrink-0 items-center gap-3 border-t border-ink-800 bg-ink-925 px-4 py-2 text-left text-fg-muted transition-colors hover:text-fg lg:flex"
    >
      <Icon name="chevron-up" size={14} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        Structure
      </span>
      <span className="ml-auto flex items-center gap-3 font-mono text-[10px] tabular-nums text-fg-faint">
        <span>
          {tasksDone}/{tasks.length} tasks
        </span>
        <span>{turnCount} turns</span>
        <span>
          {subCount} subagents{working > 0 ? ` · ${working} working` : ""}
        </span>
      </span>
    </button>
  );
}
