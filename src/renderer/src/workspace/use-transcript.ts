import { useEffect, useRef, useState } from 'react'
import type { TranscriptDoc } from '@shared/transcript'

/** How often the Observed view re-reads the transcript. A poll, not a watcher: it matches the app's
 *  request/response IPC, and the read's change token makes an unchanged poll a cheap no-op (the main
 *  process skips the read+parse, the renderer skips the re-render). */
const POLL_MS = 1500

// Tri-state: `undefined` = the first read hasn't landed (show the shell), `null` = read and there's no
// transcript (show the empty state), a doc = render it.
export type DocState = TranscriptDoc | null | undefined

/**
 * Poll one session's transcript on an interval, returning the latest doc. Resets cleanly when the
 * session id changes. Skips a poll while one is in flight (a slow read on a big transcript must not let
 * polls overlap and apply out of order) or while the window is hidden; reads immediately when the window
 * returns to the foreground. A transient read error keeps the last doc rather than blanking the view.
 */
export function useTranscript(sessionId: string): DocState {
  const [doc, setDoc] = useState<DocState>(undefined)
  const sinceRef = useRef<number | undefined>(undefined) // last seen change token (mtime)
  const inFlightRef = useRef(false)

  useEffect(() => {
    let alive = true
    sinceRef.current = undefined
    inFlightRef.current = false
    setDoc(undefined)

    async function poll() {
      if (inFlightRef.current || document.hidden) return
      inFlightRef.current = true
      try {
        const r = await window.api.readTranscript(sessionId, sinceRef.current)
        if (!alive) return
        switch (r.status) {
          case 'changed':
            sinceRef.current = r.mtimeMs
            setDoc(r.doc)
            break
          case 'unchanged':
            break // nothing moved — hold the current doc
          case 'absent':
            sinceRef.current = undefined
            setDoc(null)
            break
          case 'error':
            break // transient — keep the last doc, retry next poll
        }
      } catch {
        // IPC itself failed; treat like a transient error and keep the last doc.
      } finally {
        if (alive) inFlightRef.current = false
      }
    }

    void poll()
    const h = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(h)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId])

  return doc
}
