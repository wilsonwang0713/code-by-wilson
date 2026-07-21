/** Pure island-window geometry — no Electron imports, so vitest exercises it directly. The
 *  Electron `Display` object structurally satisfies DisplayLike; window.ts passes it straight in. */

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayLike {
  bounds: RectLike;
  workArea: RectLike;
}

/** The island window's fixed outer bounds. Sized for the EXPANDED panel: the window never
 *  resizes; collapsed vs expanded is a renderer-side visual state, and the transparent
 *  remainder passes clicks through via setIgnoreMouseEvents (see window.ts). */
export const ISLAND_WIDTH = 420;
export const ISLAND_HEIGHT = 420;

/** Top-center of the work area: horizontally centered, pinned just below the menu bar — directly
 *  under the notch on built-in displays, plain top-center on displays without one (US-1 AC1; the
 *  two cases share this geometry, so no notch detection is needed). True notch-flanking (drawing
 *  inside the menu bar strip beside the notch) is not feasible in pure Electron and is P1's
 *  problem, along with reacting to display-metrics changes after creation. */
export function islandBounds(d: DisplayLike): RectLike {
  return {
    x: Math.round(d.workArea.x + (d.workArea.width - ISLAND_WIDTH) / 2),
    y: d.workArea.y,
    width: ISLAND_WIDTH,
    height: ISLAND_HEIGHT,
  };
}
