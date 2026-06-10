import { useEffect, useRef, type ReactNode } from 'react'
import type { SessionState } from '@shared/types'
import type { DocState } from './use-transcript'
import { EventItem } from './events'

/**
 * The Observed session's rendered transcript: a read-only, bottom-sticky feed of events plus a prominent
 * Waiting banner. The polling lives in useTranscript (lifted so the context panel and timeline share one
 * doc); this component is a pure renderer of the doc it's handed.
 */
export function TranscriptView({
  doc,
  project,
  state,
}: {
  doc: DocState
  project: string
  state: SessionState
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const countRef = useRef(0)

  // Stick to the bottom when new events arrive — this is a live, read-only feed.
  useEffect(() => {
    const n = doc?.events.length ?? 0
    if (n > countRef.current) bottomRef.current?.scrollIntoView({ block: 'end' })
    countRef.current = n
  }, [doc])

  if (doc === null) {
    return <Center>No transcript on disk for this session yet.</Center>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-5">
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-1 border-b border-ink-800 bg-ink-925/90 px-5 py-2 text-center text-[10px] uppercase tracking-wider text-fg-faint backdrop-blur">
        ● Read-only — live transcript from {project}. You can't type into an Observed session.
      </div>

      {doc?.events.map((e, i) => <EventItem key={i} event={e} />)}

      {state === 'waiting' && (
        <div className="rounded-lg border border-accent/50 bg-accent/[0.08] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-bright">Waiting for you</div>
          <p className="mt-1 whitespace-pre-wrap font-mono text-[12px] text-accent-bright">
            {doc?.waitingReason ?? 'Waiting for your input'}
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-[12px] text-fg-faint">{children}</div>
}
