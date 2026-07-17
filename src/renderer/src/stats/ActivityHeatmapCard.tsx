import type { HourDowCell } from "@shared/stats";
import { CALENDAR_RAMP } from "../ui/meta";
import { foldHourly, maxHourlyTurns } from "./hourly";
import { StatsCard, CardRegion } from "./shared";
import {
  HeatmapChart,
  HeatmapCells,
  HeatmapYAxis,
  HeatmapTooltip,
} from "../ui/bklit/charts/heatmap";

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Chart margins — left clears the weekday labels; keep in sync with the hour-label row's pl. */
const MARGIN = { top: 4, right: 8, bottom: 8, left: 34 };

/**
 * Card: the (weekday × hour) activity heatmap — when the user actually works, range-scoped like
 * the daily chart. Columns are hours (0–23), rows are weekdays; the Bklit heatmap's own X axis
 * renders month labels (it's GitHub-calendar-shaped), so the hour labels are a plain flex row
 * aligned under the grid instead.
 */
export function ActivityHeatmapCard({ hourly }: { hourly: HourDowCell[] }) {
  if (hourly.length === 0) return null;
  const peak = maxHourlyTurns(hourly);
  return (
    <StatsCard>
      <CardRegion title="Active hours">
        <div className="mb-1 text-meta text-fg-faint">
          Peak{" "}
          <span className="font-mono tabular-nums text-fg-muted">{peak}</span>{" "}
          turns in one hour slot
        </div>
        <HeatmapChart
          data={foldHourly(hourly)}
          layout="fill"
          aspectRatio="4.6 / 1"
          gap={2}
          margin={MARGIN}
          levelColors={CALENDAR_RAMP}
          className="text-meta"
        >
          <HeatmapCells />
          <HeatmapYAxis tickFilter="odd" />
          <HeatmapTooltip
            showDateHeader={false}
            formatLabel={(count, date) =>
              `${count} turn${count === 1 ? "" : "s"} · ${DOW_NAMES[date.getDay()]} ${String(
                date.getHours(),
              ).padStart(2, "0")}:00`
            }
          />
        </HeatmapChart>
        <div
          className="flex justify-between font-mono text-micro text-fg-faint"
          style={{ paddingLeft: MARGIN.left, paddingRight: MARGIN.right }}
        >
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </CardRegion>
    </StatsCard>
  );
}
