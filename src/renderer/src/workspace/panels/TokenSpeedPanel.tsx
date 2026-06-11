import type { TokenSpeed } from '@shared/metrics'
import { formatTps } from '@shared/format'
import { SPEED_WINDOW_LABEL } from './speed-window'
import { PanelSection, PanelHeading } from './chrome'
import { MetricRow } from './MetricRow'

/** Rolling-window token throughput. Renders nothing while metrics haven't reported a speed (no completed
 *  request yet) — the whole section hides (empty-state rule). */
export function TokenSpeedPanel({ speed }: { speed: TokenSpeed | null | undefined }) {
  if (!speed) return null
  return (
    <PanelSection>
      <div className="flex items-baseline justify-between gap-2">
        <PanelHeading>Token speed</PanelHeading>
        <span className="rounded border border-ink-800 px-1 py-px text-[9px] uppercase tracking-wider text-fg-faint">
          {SPEED_WINDOW_LABEL}
        </span>
      </div>
      <MetricRow label="Output" value={formatTps(speed.outputTps)} />
      <MetricRow label="Input" value={formatTps(speed.inputTps)} tone="text-fg-muted" />
      <MetricRow label="Total" value={formatTps(speed.totalTps)} />
    </PanelSection>
  )
}
