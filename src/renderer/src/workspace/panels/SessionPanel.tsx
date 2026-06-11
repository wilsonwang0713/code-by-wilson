import type { Session } from '@shared/types'
import { PanelSection, PanelHeading } from './chrome'
import { MetricRow } from './MetricRow'

/** Session identifiers: the deliberately-named title and the short session id. Model/effort/clock now
 *  live in the session header. */
export function SessionPanel({ session: s }: { session: Session }) {
  const shortId = s.id.length > 12 ? `${s.id.slice(0, 4)}…${s.id.slice(-4)}` : s.id
  return (
    <PanelSection>
      <PanelHeading>Session</PanelHeading>
      <MetricRow label="Name" value={s.title} />
      <MetricRow label="Session ID" value={shortId} tone="text-fg-muted" title={s.id} />
    </PanelSection>
  )
}
