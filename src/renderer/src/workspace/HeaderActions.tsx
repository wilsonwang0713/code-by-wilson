import { useState } from 'react'
import type { Session } from '@shared/types'
import { Icon } from '../ui/icons'
import { OpenInMenu } from './OpenInMenu'

/** The header's right-side action cluster. Adopt — the one wired action — leads when an observed session
 *  has ended; the rest (Open in, Interrupt, End) ship disabled until their plumbing lands. Status chips
 *  live on the header's second line, not here, so this row is purely actions. */
export function HeaderActions({
  session: s,
  onAdopt,
}: {
  session: Session
  onAdopt: (id: string) => Promise<void>
}) {
  const canAdopt = s.management === 'observed' && s.state === 'ended'
  const [adoptBusy, setAdoptBusy] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)

  async function handleAdopt() {
    setAdoptBusy(true)
    setAdoptError(null)
    try {
      await onAdopt(s.id)
    } catch (e) {
      setAdoptError(e instanceof Error ? e.message : 'Failed to resume')
    } finally {
      // Always clear busy: the button is hidden after a successful adopt, but a session that later Ends
      // reverts to Observed/Ended and the button returns — a stuck flag would wedge it on "Adopting…".
      setAdoptBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {canAdopt && (
        <>
          {adoptError && <span className="text-[11px] text-danger">{adoptError}</span>}
          <button
            type="button"
            onClick={() => void handleAdopt()}
            disabled={adoptBusy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-ink-950 ring-1 ring-primary/40 transition-colors enabled:hover:bg-primary-bright disabled:opacity-40"
          >
            <Icon name="git-pull-request-arrow" size={13} />
            {adoptBusy ? 'Adopting…' : 'Adopt'}
          </button>
          <span className="h-4 w-px bg-ink-800" />
        </>
      )}

      <OpenInMenu />

      <span className="h-4 w-px bg-ink-800" />

      <button
        type="button"
        disabled
        title="Coming soon"
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900 px-2.5 py-1 text-[12px] text-fg-muted opacity-40"
      >
        <Icon name="pause" size={13} />
        Interrupt
      </button>

      <button
        type="button"
        disabled
        title="Coming soon"
        className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1 text-[12px] text-danger opacity-40"
      >
        <Icon name="square" size={13} />
        End session
      </button>
    </div>
  )
}
