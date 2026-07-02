/**
 * Pure layout math for the pane-shell grid (ported from hermes-agent's pane-shell.tsx), split from
 * the JSX engine so it stays importable by tests under the node tsconfig.
 */

export type PaneSide = "left" | "right";
export type WidthValue = string | number;

export interface CollectedPane {
  bottomRow: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  forceCollapsed: boolean;
  height: string;
  id: string;
  resizable: boolean;
  side: PaneSide;
  width: string;
}

export type PaneStoreState = Record<
  string,
  { open: boolean; widthOverride?: number; heightOverride?: number }
>;

export const DEFAULT_WIDTH = "16rem";
export const DEFAULT_HEIGHT = "18rem";
export const DEFAULT_RESIZE_MIN_WIDTH = 160;
export const DEFAULT_RESIZE_MIN_HEIGHT = 120;

export const widthToCss = (value: WidthValue | undefined, fallback: string) =>
  value === undefined
    ? fallback
    : typeof value === "number"
      ? `${value}px`
      : value;

const remPx = () =>
  typeof window === "undefined"
    ? 16
    : Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      ) || 16;

const viewportPx = () =>
  typeof window === "undefined" ? 1280 : window.innerWidth;
const viewportHeightPx = () =>
  typeof window === "undefined" ? 800 : window.innerHeight;

// Resolves PaneProps min/max (number | "Npx" | "Nrem" | "Nvw" | "Nvh" | "N%") to
// pixels for drag clamping. vw/% resolve against window width, vh against height.
export function widthToPx(value: WidthValue | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const match = value?.trim().match(/^(-?\d*\.?\d+)(px|rem|vw|vh|%)?$/);
  if (!match) return undefined;
  const n = Number.parseFloat(match[1]);
  switch (match[2]) {
    case "rem":
      return n * remPx();
    case "vh":
      return (n * viewportHeightPx()) / 100;
    case "vw":
    case "%":
      return (n * viewportPx()) / 100;
    default:
      return n;
  }
}

export function paneIsOpen(
  pane: CollectedPane,
  states: PaneStoreState,
): boolean {
  const stateOpen = states[pane.id]?.open ?? pane.defaultOpen;
  return !pane.disabled && !pane.forceCollapsed && stateOpen;
}

export function trackForPane(pane: CollectedPane, states: PaneStoreState) {
  const open = paneIsOpen(pane, states);
  if (!open) return { open: false, track: "0px" };
  const override = pane.resizable ? states[pane.id]?.widthOverride : undefined;
  return {
    open: true,
    track: override !== undefined ? `${override}px` : pane.width,
  };
}

export function heightTrackForPane(
  pane: CollectedPane,
  states: PaneStoreState,
): string {
  const override = pane.resizable ? states[pane.id]?.heightOverride : undefined;
  return override !== undefined ? `${override}px` : pane.height;
}
