import type { DailyBucket } from "@shared/stats";

/** One point of the cumulative line: the running total through `day`, actual or projected. */
export interface CumulativePoint {
  day: string;
  /** Cumulative total tokens (all four kinds) through this day. */
  value: number;
  /** True on the straight-line projection tail (days after the last actual day). */
  projected: boolean;
}

export interface CumulativeSeries {
  points: CumulativePoint[];
  /** Index of the last actual point — the dash boundary the chart's dashFromIndex uses. -1 when empty. */
  lastActualIndex: number;
  /** The projected total at the end of the tail; null when nothing was projected (no future days,
   *  or a zero-usage window where a flat line would just restate "no usage"). */
  projectedEnd: number | null;
}

function dayTotal(d: DailyBucket): number {
  return (
    d.inputTokens + d.outputTokens + d.cacheReadTokens + d.cacheCreationTokens
  );
}

/**
 * The cumulative-usage line with a straight-line forecast: accumulate the (densified) actual days,
 * then extend one point per `futureDay` at the window's average daily rate. Pure — the card decides
 * the horizon (how many future days) and the window; this only does the math, so vitest owns it.
 */
export function cumulativeWithProjection(
  days: readonly DailyBucket[],
  futureDays: readonly string[],
): CumulativeSeries {
  const points: CumulativePoint[] = [];
  let running = 0;
  for (const d of days) {
    running += dayTotal(d);
    points.push({ day: d.day, value: running, projected: false });
  }
  const lastActualIndex = points.length - 1;
  const rate = days.length > 0 ? running / days.length : 0;
  if (rate <= 0 || futureDays.length === 0) {
    return { points, lastActualIndex, projectedEnd: null };
  }
  let projected = running;
  for (const day of futureDays) {
    projected += rate;
    points.push({ day, value: Math.round(projected), projected: true });
  }
  return {
    points,
    lastActualIndex,
    projectedEnd: points[points.length - 1].value,
  };
}
