import type { CliStatus } from "@shared/cli-status";
import { Wordmark, cx } from "./atoms";
import { Icon } from "./icons";
import { footerView } from "./rail-footer";
import { useZoomFactor } from "./use-zoom-factor";
import { useFullscreen } from "./use-fullscreen";
import { HEADER_HEIGHT_PX, headerLeftPaddingPx } from "@shared/chrome";
import { isMacPlatform } from "@shared/platform";
import { gearBadge, type GearBadge } from "./gear-badge";
import type { UpdatePhase } from "@shared/update";

/**
 * The frameless app's title bar: a draggable strip carrying the wordmark (anchored top-left) and the
 * Settings gear (anchored top-right). On macOS the wordmark sits past the native traffic lights when
 * windowed; in fullscreen the lights are gone, so its left inset drops and it slides into the corner
 * (see `headerLeftPaddingPx`). The `title-bar` class counter-zooms so the bar holds a fixed physical
 * size while the rest of the window zooms. The empty remainder stays draggable; the gear opts back out
 * (`no-drag`) so it stays clickable.
 *
 * One gear, one badge by precedence: CLI error › CLI warn › update ready › update available › nothing.
 * A pulsing dot for CLI caution; a download-arrow for an available update. Clicking opens Settings.
 */
export function GlobalHeader({
  cliStatus,
  onOpenSettings,
  settingsActive,
  updatePhase,
}: {
  cliStatus: CliStatus | null;
  onOpenSettings: () => void;
  settingsActive: boolean;
  updatePhase?: UpdatePhase["kind"];
}) {
  const isMac = isMacPlatform(window.api.platform);
  const isFullscreen = useFullscreen();
  useZoomFactor(isMac);
  const v = footerView(cliStatus);
  const badge = gearBadge(v.dot, updatePhase ?? "idle");
  const title =
    badge?.kind === "cli-error" || badge?.kind === "cli-warn"
      ? `Settings · ${v.statusLabel}`
      : badge?.kind === "update-ready"
        ? "Settings · update ready"
        : badge?.kind === "update-available"
          ? "Settings · update available"
          : "Settings";
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
          onClick={onOpenSettings}
          aria-label="Settings"
          title={title}
          className={cx(
            "relative inline-flex items-center justify-center rounded-md border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            settingsActive
              ? "border-ink-700 bg-ink-900 text-fg"
              : "border-ink-800 text-fg-faint hover:border-ink-700 hover:text-fg-muted",
          )}
        >
          <Icon name="settings" size={15} />
          {badge && <GearBadgeMark badge={badge} />}
        </button>
      </div>
    </header>
  );
}

/** The gear's single badge: a pulsing dot for CLI caution (existing behavior), a download-arrow for an
 *  update. Arrow stroke is dark (`text-ink-950`) for contrast on amber. */
function GearBadgeMark({ badge }: { badge: NonNullable<GearBadge> }) {
  if (badge.kind === "cli-error" || badge.kind === "cli-warn") {
    return (
      <span
        className={cx(
          "absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-ink-925 animate-pulse-soft",
          badge.kind === "cli-error" ? "bg-danger" : "bg-accent",
        )}
      />
    );
  }
  const ready = badge.kind === "update-ready";
  return (
    <span
      className={cx(
        "absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-ink-950 ring-2 ring-ink-925",
        ready ? "bg-accent-bright animate-pulse-soft" : "bg-accent",
      )}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M5 1.5 V7 M2.6 4.6 L5 7.2 L7.4 4.6"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
