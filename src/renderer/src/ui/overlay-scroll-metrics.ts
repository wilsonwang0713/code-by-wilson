/**
 * Pure geometry for the VSCode-style overlay scrollbar. Kept JSX-free so the node tsconfig (Vitest) can
 * unit-test it. The component (OverlayScroll.tsx) is a thin shell that wires these to scroll/pointer events.
 *
 * Mirrors VSCode's ScrollbarState math: the thumb size is the viewport's share of the content, clamped to a
 * minimum so it stays grabbable, and the thumb travels the leftover track in proportion to scrollTop.
 */

/** The minimum thumb length, so a very long list still leaves something to grab (VSCode uses 20px). */
export const MIN_THUMB = 20;

export interface ThumbMetrics {
  /** Thumb height in px (0 when there's nothing to scroll). */
  height: number;
  /** Thumb offset from the top of the track in px. */
  top: number;
  /** Whether the content overflows — i.e. whether a thumb should show at all. */
  overflow: boolean;
}

/** Thumb height + position for the current scroll state. `top` ranges 0..(clientHeight - height). */
export function thumbMetrics(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  minThumb: number = MIN_THUMB,
): ThumbMetrics {
  if (clientHeight <= 0 || scrollHeight <= clientHeight) {
    return { height: 0, top: 0, overflow: false };
  }
  const height = Math.min(
    clientHeight,
    Math.max(
      minThumb,
      Math.round((clientHeight * clientHeight) / scrollHeight),
    ),
  );
  const maxScroll = scrollHeight - clientHeight;
  const maxTop = clientHeight - height;
  const top = maxScroll <= 0 ? 0 : Math.round((scrollTop / maxScroll) * maxTop);
  return { height, top, overflow: true };
}

/** Inverse of `thumbMetrics`: the scrollTop that places a thumb of `thumbHeight` at `thumbTop`. Used while
 *  dragging — the pointer moves the thumb, this maps it back to a scroll position. Clamps to the track. */
export function scrollTopForThumbTop(
  thumbTop: number,
  thumbHeight: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maxTop = clientHeight - thumbHeight;
  const maxScroll = scrollHeight - clientHeight;
  if (maxTop <= 0 || maxScroll <= 0) return 0;
  const clamped = Math.min(Math.max(thumbTop, 0), maxTop);
  return (clamped / maxTop) * maxScroll;
}
