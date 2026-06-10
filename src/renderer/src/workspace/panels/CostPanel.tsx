import type { ModelId, Usage } from '@shared/types'
import { costBreakdown } from '@shared/models'
import { formatUsd, costDisplay } from '@shared/format'

/**
 * Cost for the session: a headline figure (Claude's live number when present, else the computed
 * Equivalent API value) over a per-token-kind split and the cache-hit saving. The split is always the
 * computed Equivalent API value (we have no live split), so its rows carry a leading ~ even when the
 * headline is exact spend — they're an estimate of where the cost went, not a breakdown of the bill.
 */
export function CostPanel({
  usage,
  model,
  liveCostUsd,
  billingMode,
}: {
  usage: Usage
  model: ModelId
  liveCostUsd?: number
  billingMode?: 'subscription' | 'api'
}) {
  const b = costBreakdown(usage, model)
  const headline = costDisplay({ liveCostUsd, equivApiValueUsd: b.total, billingMode })
  const rows = [
    { label: 'Input', value: b.input },
    { label: 'Output', value: b.output },
    { label: 'Cache read', value: b.cacheRead },
    { label: 'Cache write', value: b.cacheWrite },
  ]
  return (
    <section className="space-y-2 border-b border-ink-800 pb-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Cost</h2>
        <span
          className="font-mono text-sm tabular-nums text-fg"
          title={headline.equivalent ? 'Equivalent API value (estimate)' : 'Actual API spend'}
        >
          {headline.text}
        </span>
      </div>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between">
            <dt className="text-[11px] text-fg-muted">{r.label}</dt>
            <dd className="font-mono text-[11px] tabular-nums text-fg-faint">~{formatUsd(r.value)}</dd>
          </div>
        ))}
      </dl>
      {b.cacheSavings > 0 && (
        <div className="flex items-baseline justify-between border-t border-ink-800/70 pt-1.5">
          <span className="text-[11px] text-ok">Cache savings</span>
          <span className="font-mono text-[11px] tabular-nums text-ok">~{formatUsd(b.cacheSavings)}</span>
        </div>
      )}
      <p className="text-[10px] leading-snug text-fg-faint">Split is Equivalent API value by token kind.</p>
    </section>
  )
}
