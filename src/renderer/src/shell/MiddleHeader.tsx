import type { ReactNode } from "react";
import type { Session } from "@shared/types";
import { isMacPlatform } from "@shared/platform";
import { cx } from "../ui/atoms";
import { useFullscreen } from "../ui/use-fullscreen";
import { headerRightPaddingPx, titlebarContentInsetPx } from "./titlebar";

/**
 * The middle column's own in-column header: a draggable strip that carries the active session's
 * menu — name, chevron, and Managed/Observed badge, bundled in `SessionMenu` and passed in as
 * `menu` — or a plain title when there's no session, plus the Transcript on/off switch. The
 * sidebar toggles live in the fixed `TitlebarControls` clusters, NOT here — nothing in this header
 * mounts or unmounts when a pane toggles.
 *
 * Both paddings snap (hermes behavior — no transition): they change in the same frame as the
 * pane's grid track, so the title reflows exactly once, in sync with the sidebar. When the left
 * pane is docked, its own strip covers the traffic lights and the left cluster, so 14px suffices;
 * when it isn't, this header is the visual left edge and insets past lights + cluster. The right
 * padding mirrors that for the right cluster, which only floats over this header while a session
 * exists and the right pane isn't docked.
 */
export function MiddleHeader({
  title,
  session,
  transcriptOn,
  onToggleTranscript,
  leftEdgeExposed,
  rightEdgeExposed,
  menu,
}: {
  title: string;
  session: Session | null;
  transcriptOn: boolean;
  onToggleTranscript: () => void;
  /** True whenever the left pane isn't actually docked next to this header — closed by the user,
   *  or force-collapsed by a narrow window. Rendered state, not the stored preference. */
  leftEdgeExposed: boolean;
  /** Same, for the right pane. Only matters while a session exists (the right cluster is hidden
   *  otherwise). */
  rightEdgeExposed: boolean;
  menu: ReactNode;
}) {
  const isMac = isMacPlatform(window.api.platform);
  const isFullscreen = useFullscreen();
  const paddingLeft = leftEdgeExposed
    ? titlebarContentInsetPx(isMac, isFullscreen)
    : 12;
  const paddingRight = headerRightPaddingPx(
    Boolean(session) && rightEdgeExposed,
  );

  return (
    <>
      <header
        className={cx(
          "drag-region relative flex shrink-0 select-none items-center gap-3 overflow-hidden border-b border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background)",
          isMac && "title-bar",
        )}
        style={{ height: "var(--titlebar-height)", paddingLeft, paddingRight }}
      >
        {session ? (
          menu
        ) : (
          <span className="truncate text-[0.75rem] font-medium leading-none text-(--ui-text-secondary)">
            {title}
          </span>
        )}
        <div className="no-drag ml-auto flex items-center gap-2">
          {session && (
            <button
              type="button"
              role="switch"
              aria-checked={transcriptOn}
              onClick={onToggleTranscript}
              aria-label="Toggle transcript"
              title="Transcript"
              className={cx(
                "relative h-4 w-7 shrink-0 rounded-full border transition-colors duration-100",
                transcriptOn
                  ? "border-transparent bg-primary"
                  : "border-[color-mix(in_srgb,var(--color-fg)_18%,transparent)] bg-transparent",
              )}
            >
              <span
                className={cx(
                  "absolute top-[1px] h-3 w-3 rounded-full transition-all duration-100",
                  transcriptOn ? "right-[1px] bg-ink-950" : "left-[1px] bg-fg",
                )}
              />
            </button>
          )}
        </div>
      </header>
      <div
        aria-hidden
        className="pointer-events-none relative z-10 -mb-4 h-4 shrink-0 bg-linear-to-b from-(--ui-chat-surface-background) to-transparent"
      />
    </>
  );
}
