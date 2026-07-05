import { useStore } from "@nanostores/react";
import { cx } from "../ui/atoms";
import { TerminalSlot } from "./persistent";
import { TerminalRail } from "./rail";
import { $terminals } from "./terminals";

/** Pane-side terminal chrome: the body slot (which the persistent overlay chases) plus the
 *  always-on tab rail. Lives in the real pane DOM — not the z-4 overlay — so the rail keeps its
 *  own stacking. The rail shows whenever a terminal exists (even one), so every tab keeps its
 *  close affordance; closing the last one hides the pane.
 *
 *  `asRow` (the terminal docked as a row beneath the metrics sidebar): the seam against the metrics
 *  is drawn here, as a top border on BOTH the body column and the rail — siblings at the same y, so
 *  the line stays continuous and aligned across the full width. It can't live on an ancestor: the
 *  rail's opaque z-40 background paints over any ancestor border in the rail's column. */
export function TerminalPaneChrome({ asRow }: { asRow: boolean }) {
  const terminals = useStore($terminals);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div
        className={cx(
          "relative flex min-h-0 min-w-0 flex-1 flex-col",
          asRow && "border-t border-(--ui-stroke-secondary)",
        )}
      >
        <TerminalSlot />
      </div>
      {terminals.length > 0 && <TerminalRail asRow={asRow} />}
    </div>
  );
}
