import type { FooterView } from "./rail-footer";
import type { UpdatePhase } from "@shared/update";

/** The single badge the title-bar gear shows, chosen by precedence. `null` = bare gear. */
export type GearBadge =
  | { kind: "cli-error" }
  | { kind: "cli-warn" }
  | { kind: "update-ready" }
  | { kind: "update-available" }
  | null;

/**
 * One gear, one badge. A broken engine outranks an optional update: CLI error › CLI warn › update ready
 * › update available › nothing. The dot-vs-arrow shape (rendered in GlobalHeader) keeps CLI health and
 * update state legible even when both are amber.
 */
export function gearBadge(
  cliDot: FooterView["dot"],
  updatePhase: UpdatePhase["kind"],
): GearBadge {
  if (cliDot === "error") return { kind: "cli-error" };
  if (cliDot === "warn") return { kind: "cli-warn" };
  if (updatePhase === "downloaded") return { kind: "update-ready" };
  if (updatePhase === "available" || updatePhase === "downloading")
    return { kind: "update-available" };
  return null;
}
