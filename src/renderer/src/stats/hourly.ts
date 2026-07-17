import type { HourDowCell } from "@shared/stats";

/** Structurally match Bklit's HeatmapBin/HeatmapColumn (heatmap-context.tsx) WITHOUT importing
 *  that .tsx module: this file is test-reachable, so it must typecheck under the JSX-free
 *  tsconfig.node.json (CLAUDE.md). The card's call site assigns these structurally. */
export interface HourlyHeatmapBin {
  bin: number;
  count: number;
  date: Date;
}
export interface HourlyHeatmapColumn {
  bin: number;
  bins: HourlyHeatmapBin[];
}

/** A reference Sunday for the synthetic bin dates. The heatmap's tooltip and reveal animation key
 *  off each bin's Date; only its weekday and hour matter here, so any fixed Sunday works. */
const REF_SUNDAY = { year: 2026, monthIndex: 0, date: 4 };

/**
 * Densify the sparse (weekday × hour) cells into the Bklit heatmap's shape: 24 columns (hour of
 * day) of 7 bins (weekday rows, Sunday first — the axis component's weekStartDay 0 order). Pure,
 * so vitest owns the grid math.
 */
export function foldHourly(
  cells: readonly HourDowCell[],
): HourlyHeatmapColumn[] {
  const byKey = new Map<string, number>();
  for (const c of cells) byKey.set(`${c.dow}:${c.hour}`, c.turns);
  return Array.from({ length: 24 }, (_, hour) => ({
    bin: hour,
    bins: Array.from({ length: 7 }, (_, dow) => ({
      bin: dow,
      count: byKey.get(`${dow}:${hour}`) ?? 0,
      date: new Date(
        REF_SUNDAY.year,
        REF_SUNDAY.monthIndex,
        REF_SUNDAY.date + dow,
        hour,
      ),
    })),
  }));
}

/** The busiest cell's turn count — the card's "peak" readout. */
export function maxHourlyTurns(cells: readonly HourDowCell[]): number {
  let max = 0;
  for (const c of cells) if (c.turns > max) max = c.turns;
  return max;
}
