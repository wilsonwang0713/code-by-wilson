import type { ToolEvent } from "@shared/transcript";

/** The glyph, label, and color tone for a transcript turn's result status. One table shared by the tool
 *  and edit rows (which show the glyph) and their detail modals (which show the label), so ok / error /
 *  pending look the same everywhere. Tool and diff events share the same status union. */
export const TURN_STATUS: Record<
  ToolEvent["status"],
  { char: string; label: string; tone: string }
> = {
  ok: { char: "✓", label: "passed", tone: "text-ok" },
  error: { char: "✕", label: "failed", tone: "text-danger" },
  pending: { char: "●", label: "running", tone: "text-working-bright" },
};
