import { useEffect, useRef, useState } from 'react'
import type { Task } from '@shared/types'

/** Matches useTranscript's cadence: a poll, deduped by the read's change token. */
const POLL_MS = 1500

// `undefined` until the first read lands or when the session has no tasks dir; a list once read.
export type TasksState = Task[] | undefined

/**
 * Poll one session's task list on an interval. Resets when the id changes. Skips a poll while one is in
 * flight or the window is hidden; reads immediately when the window returns to the foreground. A
 * transient error keeps the last list. Mirrors useTranscript so the two panels behave identically.
 */
export function useTasks(sessionId: string): TasksState {
  const [tasks, setTasks] = useState<TasksState>(undefined)
  const sinceRef = useRef<number | undefined>(undefined)
  const inFlightRef = useRef(false)

  useEffect(() => {
    let alive = true
    sinceRef.current = undefined
    inFlightRef.current = false
    setTasks(undefined)

    async function poll() {
      if (inFlightRef.current || document.hidden) return
      inFlightRef.current = true
      try {
        const r = await window.api.readTasks(sessionId, sinceRef.current)
        if (!alive) return
        switch (r.status) {
          case 'changed':
            sinceRef.current = r.mtimeMs
            setTasks(r.tasks)
            break
          case 'unchanged':
            break // nothing moved — hold the current list
          case 'absent':
            sinceRef.current = undefined
            setTasks(undefined)
            break
          case 'error':
            break // transient — keep the last list, retry next poll
        }
      } catch {
        // IPC itself failed; treat like a transient error and keep the last list.
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

  return tasks
}
