import type { CliStatus } from "@shared/cli-status";
import { Wordmark, cx } from "./atoms";
import { Icon } from "./icons";
import { footerView, type FooterView } from "./rail-footer";
import { useZoomFactor } from "./use-zoom-factor";
import { useFullscreen } from "./use-fullscreen";
import { HEADER_HEIGHT_PX, headerLeftPaddingPx } from "@shared/chrome";
import { isMacPlatform } from "@shared/platform";

// The Sys lamp's dot hue, from the reserved status palette: green ok, amber warn, red error, slate pre-check.
const DOT_CLASS: Record<FooterView["dot"], string> = {
  ok: "bg-working",
  warn: "bg-accent",
  error: "bg-danger",
  idle: "bg-ink-600",
};

// The lamp's border/text tone tracks CLI state: quiet when healthy, lit amber/red when it needs attention —
// a master-caution annunciator that stays dark until a system trips.
const LAMP_CLASS: Record<FooterView["dot"], string> = {
  ok: "border-ink-800 text-fg-faint hover:border-ink-700 hover:text-fg-muted",
  warn: "border-accent/50 text-accent hover:border-accent",
  error: "border-danger/50 text-danger hover:border-danger",
  idle: "border-ink-800 text-fg-faint",
};

/**
 * The frameless app's title bar: a draggable strip carrying the wordmark (anchored top-left) and the
 * Sys master-caution lamp (anchored top-right). On macOS the wordmark sits past the native traffic
 * lights when windowed; in fullscreen the lights are gone, so its left inset drops and it slides into
 * the corner (see `headerLeftPaddingPx`). The `title-bar` class counter-zooms so the bar holds a fixed
 * physical size while the rest of the window zooms — otherwise web zoom shrinks the bar under the
 * OS-drawn traffic lights, which don't zoom, and they hang off it. Off macOS there are no traffic
 * lights, so the bar zooms with everything else and never insets. The empty remainder stays draggable;
 * the lamp opts back out (`no-drag`) so it stays clickable.
 *
 * The Sys lamp is the new home for Claude Code CLI health — dim when the CLI is ready, lit amber/red
 * when it's outdated, logged out, or missing. Clicking it opens the CLI status detail.
 */
export function GlobalHeader({
  cliStatus,
  onOpenCliStatus,
  onOpenSettings,
  settingsActive,
}: {
  cliStatus: CliStatus | null;
  onOpenCliStatus: () => void;
  onOpenSettings: () => void;
  settingsActive: boolean;
}) {
  const isMac = isMacPlatform(window.api.platform);
  const isFullscreen = useFullscreen();
  useZoomFactor(isMac);
  const v = footerView(cliStatus);
  const trips = v.dot === "warn" || v.dot === "error";
  return (
    <header
      className={cx(
        "drag-region flex shrink-0 select-none items-center overflow-hidden border-b border-ink-800 bg-ink-925 pr-4",
        isMac && "title-bar",
      )}
      style={{
        height: HEADER_HEIGHT_PX,
        paddingLeft: headerLeftPaddingPx(isMac, isFullscreen),
        transition: "padding-left 200ms ease-out",
      }}
    >
      <Wordmark />
      <div className="no-drag ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCliStatus}
          disabled={cliStatus === null}
          aria-label="Claude Code status and settings"
          title={
            v.version
              ? `Claude Code v${v.version} · ${v.statusLabel}`
              : `Claude Code · ${v.statusLabel}`
          }
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            LAMP_CLASS[v.dot],
          )}
        >
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              DOT_CLASS[v.dot],
              trips && "animate-pulse-soft",
            )}
          />
          Sys
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className={cx(
            "inline-flex items-center justify-center rounded-md border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            settingsActive
              ? "border-ink-700 bg-ink-900 text-fg"
              : "border-ink-800 text-fg-faint hover:border-ink-700 hover:text-fg-muted",
          )}
        >
          <Icon name="settings" size={15} />
        </button>
      </div>
    </header>
  );
}
