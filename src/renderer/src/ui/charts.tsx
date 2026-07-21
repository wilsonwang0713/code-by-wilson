import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CalendarCell } from "./contributions-geom";

/**
 * A horizontal fill gauge with caution/danger zones and threshold ticks — the cockpit's "fuel gauge".
 * `pct` fills 0..100 in `fill`; the zones tint the track from `caution`% and `danger`% so the redline is
 * visible even before the fill reaches it, and a tick marks the danger threshold ahead of the fill.
 */
export function FillGauge({
  pct,
  fill,
  caution,
  danger,
  height = 10,
}: {
  pct: number;
  fill: string;
  caution: number;
  danger: number;
  height?: number;
}) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="relative overflow-hidden rounded-full bg-ink-850"
      style={{ height }}
    >
      {/* Caution and danger zones, drawn under the fill so the redline shows where the fill hasn't reached. */}
      <span
        className="absolute inset-y-0"
        style={{
          left: `${caution}%`,
          right: `${100 - danger}%`,
          background:
            "color-mix(in srgb, var(--color-accent) 12%, transparent)",
        }}
      />
      <span
        className="absolute inset-y-0"
        style={{
          left: `${danger}%`,
          right: 0,
          background:
            "color-mix(in srgb, var(--color-accent) 22%, transparent)",
        }}
      />
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${w}%`, background: fill }}
      />
      <span
        className="absolute -inset-y-px w-px bg-accent"
        style={{ left: `${danger}%` }}
      />
    </div>
  );
}

/** Calendar cell geometry: a square cell and the gap to the next, in SVG/pixel units. Fixed (not stretched)
 *  so cells stay square; the container scrolls horizontally when too narrow rather than shrinking them. */
const CAL_CELL = 11;
const CAL_GAP = 3;
const CAL_STEP = CAL_CELL + CAL_GAP;

/** Mon/Wed/Fri weekday labels down the left of the grid (rows 1/3/5, Sunday = row 0). GitHub's convention. */
const CAL_WEEKDAYS: { row: number; label: string }[] = [
  { row: 1, label: "Mon" },
  { row: 3, label: "Wed" },
  { row: 5, label: "Fri" },
];

/** Fixed left-gutter width (px) holding the weekday labels, and the flex gap between it and the scroll area
 *  (Tailwind gap-2 = 8px) — together the grid's x offset inside the wrapper, so the tooltip (which lives in
 *  the non-scrolling wrapper) can line up over a cell. */
const CAL_GUTTER_W = 26;
const CAL_GAP_X = 8;
/** Height (px) of the month-label row above the grid (h-3.5 = 14 + mb-1 = 4), the grid's y offset. */
const CAL_MONTH_ROW_H = 18;

/**
 * A hand-rolled SVG contributions calendar (#115): one square cell per local day, laid out in week columns
 * (calendarGrid from contributions-geom), filled by the caller's `levelOf` against a ramp. Hovering a cell
 * shows the caller's tooltip (date + value); clicking calls `onSelectDay`; the page-selected day gets a ring.
 * Cells are fixed-size, so the plot scrolls horizontally inside its container when the column is too narrow
 * rather than shrinking. Month labels run along the top, weekday labels down the left.
 */
export function CalendarHeatmap({
  weeks,
  levelOf,
  colors,
  selectedDay,
  onSelectDay,
  renderTooltip,
  ariaLabelOf,
  monthLabels,
  activeWindow,
}: {
  weeks: CalendarCell[][];
  levelOf: (day: string) => number;
  colors: readonly string[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  renderTooltip: (day: string) => ReactNode;
  ariaLabelOf: (day: string) => string;
  monthLabels: { col: number; label: string }[];
  /** The page range's day window ('YYYY-MM-DD', inclusive): cells outside it dim, so the
   *  year-at-a-glance calendar still shows which slice the stats above are scoped to. Null (the
   *  All range) leaves every cell at full strength. */
  activeWindow?: { start: string; end: string } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // `x`/`y` are the hovered cell's position in the OUTER wrapper's coordinates (gutter + gap offset, minus the
  // scroll position baked in at hover time), so the tooltip — which lives in the non-scrolling wrapper, not
  // the clipping scroll area — can sit over the cell without being cut off at the grid's top edge.
  const [hovered, setHovered] = useState<{
    day: string;
    x: number;
    y: number;
  } | null>(null);
  const width = weeks.length * CAL_STEP;
  const height = 7 * CAL_STEP;

  // Open scrolled to the newest week (the grid runs oldest -> newest left to right), so the latest activity is
  // visible without scrolling. Keyed on the window's first/last day, so it snaps right only when the window
  // changes (page open, year switch) — NOT on the data-only polls that refresh cell colors, which would
  // otherwise fight a user who scrolled back to look at an earlier month.
  const firstDay = weeks[0]?.[0]?.day;
  const lastDay = weeks[weeks.length - 1]?.[6]?.day;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth; // clamps to the max automatically
  }, [firstDay, lastDay]);

  // Position the tooltip over a cell — shared by pointer hover and keyboard focus. The x is the cell's center
  // in the OUTER wrapper's coordinates, with the current scroll offset baked in at call time (see `hovered`).
  const showAt = (day: string, ci: number, ri: number): void =>
    setHovered({
      day,
      x:
        CAL_GUTTER_W +
        CAL_GAP_X +
        ci * CAL_STEP +
        CAL_CELL / 2 -
        (scrollRef.current?.scrollLeft ?? 0),
      y: ri * CAL_STEP,
    });
  const hideIf = (day: string): void =>
    setHovered((h) => (h?.day === day ? null : h));

  return (
    // Relative, non-clipping wrapper: the tooltip renders here, free to overhang the grid's top, while only
    // the inner div scrolls. (overflow-x-auto forces overflow-y to clip too, so a tooltip inside it would be
    // cut off for the top rows.)
    <div className="relative">
      <div className="flex gap-2">
        {/* Weekday labels: a fixed left gutter, dropped past the month-label row to align with the cell rows. */}
        <div
          className="relative shrink-0"
          style={{ width: CAL_GUTTER_W, height, marginTop: CAL_MONTH_ROW_H }}
        >
          {CAL_WEEKDAYS.map(({ row, label }) => (
            <span
              key={label}
              className="absolute right-0 text-micro text-fg-faint"
              style={{ top: row * CAL_STEP - 1 }}
            >
              {label}
            </span>
          ))}
        </div>
        {/* Scrolls horizontally when the grid is wider than the column. */}
        <div ref={scrollRef} className="min-w-0 overflow-x-auto">
          {/* Month labels above their column. */}
          <div className="relative mb-1 h-3.5" style={{ width }}>
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute text-micro text-fg-faint"
                style={{ left: m.col * CAL_STEP }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <svg width={width} height={height} className="block">
            {weeks.map((col, ci) =>
              col.map((cell, ri) =>
                cell.inRange ? (
                  <rect
                    key={cell.day}
                    x={ci * CAL_STEP}
                    y={ri * CAL_STEP}
                    width={CAL_CELL}
                    height={CAL_CELL}
                    rx={2}
                    fill={colors[levelOf(cell.day)] ?? colors[0]}
                    stroke="var(--color-fg)"
                    strokeWidth={cell.day === selectedDay ? 1.5 : 0}
                    opacity={
                      activeWindow &&
                      (cell.day < activeWindow.start ||
                        cell.day > activeWindow.end)
                        ? 0.3
                        : 1
                    }
                    className="cursor-pointer transition-opacity"
                    // A focusable, labeled button so the click-to-filter is reachable by keyboard and announced
                    // to screen readers; Enter/Space drill in, focus mirrors hover to surface the tooltip.
                    tabIndex={0}
                    role="button"
                    aria-label={ariaLabelOf(cell.day)}
                    onMouseEnter={() => showAt(cell.day, ci, ri)}
                    onMouseLeave={() => hideIf(cell.day)}
                    onFocus={() => showAt(cell.day, ci, ri)}
                    onBlur={() => hideIf(cell.day)}
                    onClick={() => onSelectDay(cell.day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectDay(cell.day);
                      }
                    }}
                  />
                ) : null,
              ),
            )}
          </svg>
        </div>
      </div>
      {/* Tooltip for the hovered cell, anchored just above it in the wrapper's coordinates; pointer-events-none
          so it never steals the hover. -translate-y-full lifts its own height so its bottom edge sits over the
          cell top; at the top rows it overhangs the wrapper (uncut) rather than clipping. */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-ink-800 bg-ink-900 px-2 py-1.5 text-meta shadow-lg"
          style={{ left: hovered.x, top: CAL_MONTH_ROW_H + hovered.y - 4 }}
        >
          {renderTooltip(hovered.day)}
        </div>
      )}
    </div>
  );
}
