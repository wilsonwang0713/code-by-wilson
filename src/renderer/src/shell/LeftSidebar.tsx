import { useState } from "react";
import type { Session } from "@shared/types";
import { headerLeftPaddingPx } from "@shared/chrome";
import { isMacPlatform } from "@shared/platform";
import { cx, focusRing } from "../ui/atoms";
import { OverlayScroll } from "../ui/OverlayScroll";
import { Icon } from "../ui/icons";
import { useFullscreen } from "../ui/use-fullscreen";
import { filterSessions, sortSessions } from "./session-list-model";
import { SessionRow } from "./SessionRow";
import { OVERVIEW_ID } from "../stats/sentinel";
import { SETTINGS_ID } from "../settings/sentinel";

/**
 * The left sidebar's content (design spec §4): a draggable top bar with the collapse toggle, a
 * 3-row menu (New session / Stats / Settings), a search box, and the compact session list.
 * Renders as plain content — the caller slots it inside a `Pane`
 * (Task 11), so this owns no width/position of its own beyond filling its parent.
 */
export function LeftSidebar({
  sessions,
  selectedId,
  onSelect,
  onNew,
  canSpawn,
  route,
  onRoute,
  onCollapse,
}: {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  canSpawn: boolean;
  route: string;
  onRoute: (id: string) => void;
  onCollapse: () => void;
}) {
  const isMac = isMacPlatform(window.api.platform);
  const isFullscreen = useFullscreen();
  const [query, setQuery] = useState("");
  // One timestamp per render for the relative-time labels; the 3s background re-sync (App.tsx's
  // polling loop) re-renders this list, so the clock stays close enough without its own timer.
  const now = Date.now();
  const rows = filterSessions(sortSessions(sessions), query);

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
      <div
        className="drag-region flex shrink-0 select-none items-center justify-end"
        style={{
          height: "var(--titlebar-height)",
          paddingLeft: headerLeftPaddingPx(isMac, isFullscreen),
        }}
      >
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className={cx(
            "no-drag mr-2 inline-flex items-center justify-center rounded p-1.5 text-fg-faint transition-colors hover:text-fg-muted",
            focusRing,
          )}
        >
          <Icon name="panel-left-close" size={15} />
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 px-2 pb-2">
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
            "flex items-center gap-2 rounded px-2 py-1.5 text-left text-meta transition-colors",
            focusRing,
            canSpawn
              ? "text-fg hover:bg-ink-900"
              : "cursor-not-allowed text-fg-faint",
          )}
        >
          <Icon name="plus" size={14} />
          New session
        </button>
        <button
          type="button"
          onClick={() => onRoute(OVERVIEW_ID)}
          aria-pressed={route === OVERVIEW_ID}
          className={cx(
            "flex items-center gap-2 rounded px-2 py-1.5 text-left text-meta transition-colors",
            focusRing,
            route === OVERVIEW_ID
              ? "bg-ink-850 text-fg"
              : "text-fg-muted hover:bg-ink-900",
          )}
        >
          <Icon name="chart-column" size={14} />
          Stats
        </button>
        <button
          type="button"
          onClick={() => onRoute(SETTINGS_ID)}
          aria-pressed={route === SETTINGS_ID}
          className={cx(
            "flex items-center gap-2 rounded px-2 py-1.5 text-left text-meta transition-colors",
            focusRing,
            route === SETTINGS_ID
              ? "bg-ink-850 text-fg"
              : "text-fg-muted hover:bg-ink-900",
          )}
        >
          <Icon name="settings" size={14} />
          Settings
        </button>
      </div>

      <div className="shrink-0 px-2 pb-2">
        <div className="relative">
          <Icon
            name="search"
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search sessions"
            className={cx(
              "w-full rounded border border-ink-800 bg-ink-950 py-1.5 pl-7 pr-2 text-meta text-fg placeholder:text-fg-faint",
              focusRing,
            )}
          />
        </div>
      </div>

      <div className="px-4 pb-1 font-display text-micro font-semibold uppercase tracking-[0.1em] text-fg-faint">
        Sessions
      </div>
      <OverlayScroll className="min-h-0 flex-1" contentClassName="px-2 pb-2">
        {rows.length === 0 ? (
          <p className="px-1.5 py-2 text-label text-fg-faint">
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
      </OverlayScroll>
    </div>
  );
}
