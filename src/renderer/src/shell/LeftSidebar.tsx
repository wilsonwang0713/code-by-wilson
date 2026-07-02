import { useState } from "react";
import type { Session } from "@shared/types";
import { cx } from "../ui/atoms";
import { Icon } from "../ui/icons";
import { filterSessions, sortSessions } from "./session-list-model";
import { SessionRow } from "./SessionRow";
import { OVERVIEW_ID } from "../stats/sentinel";
import { SETTINGS_ID } from "../settings/sentinel";
import { SidebarPanelLabel } from "./SidebarPanelLabel";

/**
 * The left sidebar's content (design spec §4): an empty draggable top strip — the traffic lights
 * and the fixed left toggle cluster float over it — a 3-row menu (New session / Stats / Settings),
 * a search box, and the compact session list. Renders as plain content — the caller slots it
 * inside a `Pane` (Task 11), so this owns no width/position of its own beyond filling its parent.
 */
export function LeftSidebar({
  sessions,
  selectedId,
  onSelect,
  onNew,
  canSpawn,
  route,
  onRoute,
}: {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  canSpawn: boolean;
  route: string;
  onRoute: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  // One timestamp per render for the relative-time labels; the 3s background re-sync (App.tsx's
  // polling loop) re-renders this list, so the clock stays close enough without its own timer.
  const now = Date.now();
  const rows = filterSessions(sortSessions(sessions), query);

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-(--ui-sidebar-surface-background)">
      <div
        className="drag-region shrink-0 select-none"
        style={{ height: "var(--titlebar-height)" }}
      />

      <div className="flex shrink-0 flex-col gap-px px-2.5 pb-2 pt-1.5">
        <button
          type="button"
          onClick={onNew}
          disabled={!canSpawn}
          title={
            canSpawn
              ? undefined
              : "Claude Code CLI isn't usable — open Sys status in the title bar."
          }
          className={cx(
            "flex h-7 w-full items-center justify-start gap-2 rounded-md border border-transparent px-2 text-left text-[0.8125rem] font-medium transition-colors duration-100 ease-out hover:transition-none",
            canSpawn
              ? "text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-fg"
              : "cursor-not-allowed text-(--ui-text-quaternary)",
          )}
        >
          <Icon name="plus" size={16} className="shrink-0 opacity-70" />
          New session
        </button>
        <button
          type="button"
          onClick={() => onRoute(OVERVIEW_ID)}
          aria-pressed={route === OVERVIEW_ID}
          className={cx(
            "flex h-7 w-full items-center justify-start gap-2 rounded-md border border-transparent px-2 text-left text-[0.8125rem] font-medium transition-colors duration-100 ease-out hover:transition-none",
            route === OVERVIEW_ID
              ? "border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-fg"
              : "text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-fg",
          )}
        >
          <Icon name="chart-column" size={16} className="shrink-0 opacity-70" />
          Stats
        </button>
        <button
          type="button"
          onClick={() => onRoute(SETTINGS_ID)}
          aria-pressed={route === SETTINGS_ID}
          className={cx(
            "flex h-7 w-full items-center justify-start gap-2 rounded-md border border-transparent px-2 text-left text-[0.8125rem] font-medium transition-colors duration-100 ease-out hover:transition-none",
            route === SETTINGS_ID
              ? "border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-fg"
              : "text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background) hover:text-fg",
          )}
        >
          <Icon name="settings" size={16} className="shrink-0 opacity-70" />
          Settings
        </button>
      </div>

      <div className="shrink-0 px-2 pb-1 pt-1">
        <div className="flex max-w-full items-center gap-1.5 border-b border-transparent px-0.5 transition-colors focus-within:border-(--ui-stroke-secondary)">
          <Icon name="search" size={14} className="pointer-events-none shrink-0 text-(--ui-text-tertiary)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search sessions"
            className="h-7 w-full min-w-0 bg-transparent text-xs text-fg placeholder:text-(--ui-text-quaternary) focus:outline-none"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-1 px-2.5 pb-1 pt-1.5">
        <SidebarPanelLabel className="pl-2">Sessions</SidebarPanelLabel>
        <span className="text-[0.6875rem] font-medium leading-none text-(--ui-text-quaternary)">{rows.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {rows.length === 0 ? (
          <p className="px-2 py-2 text-xs text-(--ui-text-quaternary)">
            No sessions yet.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {rows.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                selected={s.id === selectedId}
                now={now}
                onSelect={() => onSelect(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
