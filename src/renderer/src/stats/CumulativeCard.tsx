import { type ReactNode } from "react";
import {
  type DailyBucket,
  type StatsRange,
  rangeWindow,
  localDayKey,
  densifyDays,
  addDays,
} from "@shared/stats";
import {
  formatTokensShort,
  formatTokensAxis,
  formatDayLong,
} from "@shared/format";
import { cumulativeWithProjection } from "./cumulative";
import { StatsCard, CardRegion } from "./shared";
import { LineChart } from "../ui/bklit/charts/line-chart";
import { Line } from "../ui/bklit/charts/line";
import { Grid } from "../ui/bklit/charts/grid";
import { XAxis } from "../ui/bklit/charts/x-axis";
import { YAxis } from "../ui/bklit/charts/y-axis";
import { ChartTooltip } from "../ui/bklit/charts/tooltip";

/** How far past today the straight-line forecast extends. One week reads as "where is this
 *  heading" without pretending to know the month. */
const PROJECTION_DAYS = 7;

/** 'YYYY-MM-DD' → local-midnight Date (the time scale's x value). */
function dayToDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Card: cumulative token usage across the active trailing window, with a dashed one-week
 * projection at the window's average daily rate (see cumulative.ts). Trailing presets only —
 * "today" has nothing to accumulate and "all" has no meaningful rate window.
 */
export function CumulativeCard({
  daily,
  range,
}: {
  daily: DailyBucket[];
  range: StatsRange;
}) {
  if (range !== "7d" && range !== "30d" && range !== "90d") return null;

  const now = Date.now();
  const { sinceMs } = rangeWindow(range, now);
  const endDay = localDayKey(now);
  const startDay = sinceMs != null ? localDayKey(sinceMs) : endDay;
  const days = densifyDays(daily, startDay, endDay);

  const futureDays = Array.from({ length: PROJECTION_DAYS }, (_, i) =>
    addDays(endDay, i + 1),
  );
  const { points, lastActualIndex, projectedEnd } = cumulativeWithProjection(
    days,
    futureDays,
  );
  if (points.length === 0) return null;

  const rows = points.map((p) => ({
    date: dayToDate(p.day),
    day: p.day,
    tokens: p.value,
    projected: p.projected,
  }));
  const lastDay = points[points.length - 1].day;

  const renderTooltip = ({
    point,
  }: {
    point: Record<string, unknown>;
  }): ReactNode => (
    <div className="flex flex-col gap-1 text-meta">
      <div className="font-medium text-fg">
        {formatDayLong(point.day as string)}
        {point.projected === true && (
          <span className="ml-1.5 text-fg-faint">projected</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-fg-muted">Cumulative</span>
        <span className="ml-auto pl-3 font-mono tabular-nums text-fg">
          {formatTokensShort(point.tokens as number)}
        </span>
      </div>
    </div>
  );

  return (
    <StatsCard>
      <CardRegion title="Cumulative usage">
        {projectedEnd != null && (
          <div className="mb-1 text-meta text-fg-faint">
            On pace for{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              ≈{formatTokensShort(projectedEnd)}
            </span>{" "}
            by {formatDayLong(lastDay)}
          </div>
        )}
        <LineChart
          data={rows}
          aspectRatio="3.4 / 1"
          margin={{ top: 16, right: 24, bottom: 32, left: 48 }}
          className="text-meta"
        >
          <Grid horizontal />
          <Line
            dataKey="tokens"
            stroke="var(--chart-line-primary)"
            strokeWidth={2.25}
            dashFromIndex={lastActualIndex >= 0 ? lastActualIndex : undefined}
          />
          <XAxis numTicks={6} />
          <YAxis formatValue={formatTokensAxis} />
          <ChartTooltip content={renderTooltip} />
        </LineChart>
      </CardRegion>
    </StatsCard>
  );
}
