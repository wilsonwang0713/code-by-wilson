import type { Management, SessionState } from "@shared/types";
import type { IconName } from "./icon-names";
import { STATE_META } from "./meta";

/** The lamp encoding (2026-07-04 sidebar spec §1): filled = live, hollow = quiet. Working is an
 *  11px spinning arc over a static 4px core; Waiting a 6px amber dot breathing a halo; Idle a 6px
 *  hollow ring; Ended a 4px ember. Literal Tailwind class strings so the scanner emits every
 *  utility (the STATE_META.ring rule), kept in this JSX-free module so the encoding stays
 *  unit-tested. Management is no longer drawn — glyphTitle's tooltip is where it survives. */
export const LAMP: Record<SessionState, { outer: string; core?: string }> = {
  working: {
    outer:
      "h-[11px] w-[11px] rounded-full border-[1.5px] border-working/25 border-t-working animate-spin motion-reduce:animate-none",
    core: "absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-working",
  },
  waiting: {
    outer:
      "h-1.5 w-1.5 rounded-full bg-accent animate-halo motion-reduce:animate-none",
  },
  idle: {
    outer: "h-1.5 w-1.5 rounded-full border-[1.5px] border-idle bg-transparent",
  },
  ended: {
    outer: "h-1 w-1 rounded-full bg-ink-700",
  },
};

/** The dot's Tailwind classes. Color tracks state (via STATE_META); a managed session is a filled dot,
 *  an observed one is a hollow ring in the same color. Pure so the renderer's Dot stays a thin shell and
 *  the encoding is unit-tested. The ring class comes from STATE_META as a literal string (not synthesized)
 *  so Tailwind's scanner actually emits the border utility. */
export function glyphClass(
  state: SessionState,
  management: Management,
): string {
  const m = STATE_META[state];
  if (management === "observed") {
    return `border-[1.5px] bg-transparent ${m.ring}`;
  }
  return m.dot;
}

/** Hover tooltip for a session glyph: "waiting · observed". The one spot the dot is spelled out in full. */
export function glyphTitle(
  state: SessionState,
  management: Management,
): string {
  return `${STATE_META[state].label.toLowerCase()} · ${management}`;
}

/** Only live sessions (working, waiting) get the soft pulse; idle and ended sit still. */
export function glyphPulses(state: SessionState): boolean {
  return state === "working" || state === "waiting";
}

/** The row indicator's glyph per state. Shape carries state — the row icon is monochrome and color does
 *  NOT vary by state; management tones it (see glyphTone). Kept here beside the dot encoding so it stays
 *  unit-tested. */
export const STATE_ICON: Record<SessionState, IconName> = {
  working: "loader-circle",
  waiting: "messages-square",
  idle: "clock",
  ended: "archive",
};

/** The row icon's tone: managed reads at the muted foreground, observed one step fainter — the icon-era
 *  replacement for the dot's filled-vs-hollow management encoding. */
export function glyphTone(management: Management): string {
  return management === "observed" ? "text-fg-faint" : "text-fg-muted";
}

/** Only Working spins — its live cue, replacing the dot's pulse. Waiting is static; its amber corner dot
 *  carries the attention instead. */
export function glyphSpins(state: SessionState): boolean {
  return state === "working";
}
