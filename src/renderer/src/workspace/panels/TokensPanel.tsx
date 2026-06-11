import type { Usage } from '@shared/types'
import { formatTokensShort } from '@shared/format'
import { PanelSection, PanelHeading } from './chrome'
import { MetricRow } from './MetricRow'

/** Token totals from the session's summed usage. Cached = cache-read + cache-creation. */
export function TokensPanel({ usage }: { usage: Usage }) {
  const cached = usage.cacheReadTokens + usage.cacheCreationTokens
  const total = usage.inputTokens + usage.outputTokens + cached
  return (
    <PanelSection>
      <PanelHeading>Tokens</PanelHeading>
      <MetricRow label="Input" value={formatTokensShort(usage.inputTokens)} />
      <MetricRow label="Output" value={formatTokensShort(usage.outputTokens)} />
      <MetricRow label="Cached" value={formatTokensShort(cached)} />
      <MetricRow label="Total" value={formatTokensShort(total)} />
    </PanelSection>
  )
}
