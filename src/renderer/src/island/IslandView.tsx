import { useEffect, useRef, useState } from "react";
import type { InboxCandidate } from "./inbox";
import { partitionInbox } from "./inbox";
import { deriveGlance } from "./glance";
import { useIslandPoll } from "./use-island-poll";
import { cx } from "../ui/atoms";

/** How long the pointer may leave the island before it collapses and goes click-through again
 *  (US-3 AC1, Esc removed per RD review — a non-focusable panel receives no key events). */
const COLLAPSE_DELAY_MS = 500;

/**
 * The island window's whole UI: a collapsed glance pill that expands into the attention inbox.
 * The BrowserWindow is fixed at the expanded size and starts click-through; the pointer entering
 * the visible content flips hit-testing on via island:setInteractive, leaving flips it back off,
 * so the transparent remainder never swallows clicks meant for the app underneath.
 */
export function IslandView() {
  const sessions = useIslandPoll();
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  // The window is transparent; the app-wide opaque body background would paint a rectangle over
  // the desktop, so the island page opts out (index.css body.island).
  useEffect(() => {
    document.body.classList.add("island");
    return () => document.body.classList.remove("island");
  }, []);

  const glance = deriveGlance(sessions);
  const { attention, running } = partitionInbox(sessions, Date.now());

  const setInteractive = (on: boolean): void => {
    void window.api.islandSetInteractive(on).catch(() => {});
  };
  const cancelCollapse = (): void => {
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };
  useEffect(() => cancelCollapse, []);

  const onEnter = (): void => {
    cancelCollapse();
    setInteractive(true);
  };
  const onLeave = (): void => {
    cancelCollapse();
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setInteractive(false);
    }, COLLAPSE_DELAY_MS);
  };
  const focusRow = (id: string): void => {
    void window.api.islandFocusSession(id).catch(() => {});
    setExpanded(false);
    setInteractive(false);
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center pt-1 select-none">
      <div
        className="flex max-h-full flex-col items-center"
        onMouseEnter={onEnter}
        // Also re-arm on move: focusRow drops interactivity while the pointer may still be over
        // the pill, and without this the pill would stay click-through until a full leave+enter.
        onMouseMove={onEnter}
        onMouseLeave={onLeave}
      >
        <button
          type="button"
          data-testid="island-pill"
          onClick={() => setExpanded((e) => !e)}
          className="flex h-7 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/85 px-4 text-[11px] font-medium text-white shadow-lg backdrop-blur"
        >
          {glance.hasAttention && (
            <span
              data-testid="island-attention-dot"
              className="h-2 w-2 rounded-full bg-[#F97316]"
            />
          )}
          <span>{glance.label}</span>
        </button>

        {expanded && (
          <div
            data-testid="island-panel"
            className="mt-2 w-90 min-w-0 overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-2 text-[11px] text-white shadow-2xl backdrop-blur"
          >
            <div className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
              Needs you
            </div>
            {attention.length === 0 ? (
              <div
                data-testid="island-all-clear"
                className="px-2 pb-1 text-white/60"
              >
                All clear
              </div>
            ) : (
              attention.map((row) => (
                <IslandRow
                  key={row.id}
                  row={row}
                  detail={row.reason}
                  accent
                  onClick={focusRow}
                />
              ))
            )}
            {running.length > 0 && (
              <>
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
                  Running
                </div>
                {running.map((row) => (
                  <IslandRow
                    key={row.id}
                    row={row}
                    detail={row.state}
                    onClick={focusRow}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IslandRow({
  row,
  detail,
  accent,
  onClick,
}: {
  row: InboxCandidate;
  detail: string;
  accent?: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid="island-row"
      onClick={() => onClick(row.id)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="text-white/90">{row.title || row.project}</span>
        <span className="ml-1.5 text-white/40">{row.project}</span>
      </span>
      <span
        className={cx(
          "shrink-0 text-[10px]",
          accent ? "text-[#F97316]" : "text-white/50",
        )}
      >
        {detail}
      </span>
    </button>
  );
}
