import { useEffect, useState } from "react";
import type { TokenSpeed } from "@shared/metrics";
import { formatTps } from "@shared/format";
import {
  LiveLineChart,
  type LiveLinePoint,
} from "../../ui/bklit/charts/live-line-chart";
import { LiveLine } from "../../ui/bklit/charts/live-line";
import { SPEED_WINDOW_LABEL } from "./speed-window";
import { PanelSection, PanelHeading, StatRow } from "./chrome";

const SPEED_INFO =
  "Token throughput over the last 60s of active generation. The live trace streams total tokens/sec across recent samples; idle gaps between turns don't count.";

/** How many samples the live trace keeps. At the 3s poll that spans well past the visible window. */
const TRACE_SAMPLES = 60;

/** The live trace's visible span in seconds. Wider than the poll-window label so a full minute of
 *  history scrolls through view before falling off the left edge. */
const TRACE_WINDOW_S = 90;

/** Accumulate timestamped total-tps samples across polls, so the live chart has a stream to draw
 *  from a metric that only reports a current snapshot. Appends when the value changes (each poll
 *  re-rolls the 60s window, so it rarely repeats); resets with the panel, which the Workspace
 *  remounts per session. */
function useSpeedTrace(tps: number | null): LiveLinePoint[] {
  const [trace, setTrace] = useState<LiveLinePoint[]>([]);
  useEffect(() => {
    if (tps == null) return;
    setTrace((t) =>
      [...t, { time: Date.now() / 1000, value: tps }].slice(-TRACE_SAMPLES),
    );
  }, [tps]);
  return trace;
}

/** Rolling-window token throughput: a hero total over a streaming live trace (Bklit LiveLineChart —
 *  the scroll, edge pulse, and value lerp are its runtime), with the output/input split below.
 *  Always renders, per the cockpit's no-vanishing-sections rule — before the first sample the
 *  `idle` hero shows over a flat trace. */
export function TokenSpeedPanel({
  speed,
}: {
  speed: TokenSpeed | null | undefined;
}) {
  const trace = useSpeedTrace(speed?.totalTps ?? null);
  return (
    <PanelSection>
      <PanelHeading
        icon="activity"
        info={SPEED_INFO}
        right={
          <span className="rounded-sm border border-(--ui-stroke-secondary) px-1.5 py-0.5 text-[0.65rem] font-medium leading-none text-(--ui-text-tertiary)">
            {SPEED_WINDOW_LABEL}
          </span>
        }
      >
        Throughput
      </PanelHeading>
      <div className="flex items-baseline justify-between">
        {speed ? (
          <span className="font-mono text-title font-medium tabular-nums text-fg">
            {formatTps(speed.totalTps).replace(/ t\/s$/, "")}
            <span className="text-xs text-fg-faint"> t/s</span>
          </span>
        ) : (
          <span className="font-mono text-title font-medium tabular-nums text-fg-faint">
            idle
          </span>
        )}
        <span className="text-xs text-(--ui-text-tertiary)">
          total throughput
        </span>
      </div>
      <LiveLineChart
        data={trace}
        value={speed?.totalTps ?? 0}
        window={TRACE_WINDOW_S}
        margin={{ top: 6, right: 10, bottom: 2, left: 2 }}
        // The chart hard-codes an inline height:300; the style spread is the supported override.
        style={{ height: 64 }}
      >
        <LiveLine dataKey="value" strokeWidth={1.5} />
      </LiveLineChart>
      {speed && (
        <div className="space-y-1.5">
          <StatRow label="Input" value={formatTps(speed.inputTps)} />
          <StatRow label="Output" value={formatTps(speed.outputTps)} />
        </div>
      )}
    </PanelSection>
  );
}
