/**
 * Pure geometry for the rail's diagrams — kept React-free so it unit-tests in the node env (the repo
 * has no DOM test harness). The stacked-bar helpers that once lived here (niceAxisMax / axisTicks /
 * stackBands, #114) left with the hand-rolled BarSeries when the Bklit charts replaced it.
 */

/** Clamp a percentage into 0–100. Shared with the Settings account gauges so the 0–100
 *  clamp lives in one React-free, node-testable place. */
export const clampPct = (n: number): number => Math.min(100, Math.max(0, n));
