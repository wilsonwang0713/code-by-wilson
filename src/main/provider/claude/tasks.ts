import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Task } from '@shared/types'

/** A task file's only fields we care about; the store also writes `description`, `activeForm`, `blocks`. */
interface RawTask {
  id: string
  subject: string
  status: string
  blockedBy: string[]
}

/** Only numbered task files are data; `.lock` / `.highwatermark` are store bookkeeping. */
const TASK_FILE = /^\d+\.json$/

function deriveStatus(t: RawTask, completed: Set<string>): Task['status'] {
  if (t.status === 'completed') return 'completed'
  if (t.status === 'in_progress') return 'in_progress'
  // pending (or anything unexpected): blocked iff some dependency isn't done yet.
  if (t.blockedBy.some((dep) => !completed.has(dep))) return 'blocked'
  return 'pending'
}

/**
 * Read one session's task list from `<claudeDir>/tasks/<sessionId>/`, in numeric id order. Maps each
 * store file to a `Task`, deriving the `blocked` status (the store only writes pending/in_progress/
 * completed). A missing dir or a malformed file is skipped, never fatal.
 */
export function readTasksForSession(claudeDir: string, sessionId: string): Task[] {
  const dir = join(claudeDir, 'tasks', sessionId)
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }

  const raw: RawTask[] = []
  for (const name of names) {
    if (!TASK_FILE.test(name)) continue
    try {
      const j = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (typeof j.id === 'string' && typeof j.subject === 'string' && typeof j.status === 'string') {
        raw.push({
          id: j.id,
          subject: j.subject,
          status: j.status,
          blockedBy: Array.isArray(j.blockedBy) ? j.blockedBy.filter((x: unknown) => typeof x === 'string') : [],
        })
      }
    } catch {
      // skip a malformed task file
    }
  }

  raw.sort((a, b) => Number(a.id) - Number(b.id))
  const completed = new Set(raw.filter((t) => t.status === 'completed').map((t) => t.id))
  return raw.map((t) => {
    const task: Task = { id: t.id, subject: t.subject, status: deriveStatus(t, completed) }
    if (t.blockedBy.length) task.blockedBy = t.blockedBy
    return task
  })
}

/** Newest mtime (ms) among a session's numbered task files, or 0 when the dir is absent/empty. The
 *  `readTasks` change token: rewriting any task file (add or status change) advances it. */
export function tasksNewestMtime(claudeDir: string, sessionId: string): number {
  const dir = join(claudeDir, 'tasks', sessionId)
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return 0
  }
  let newest = 0
  for (const name of names) {
    if (!TASK_FILE.test(name)) continue
    try {
      const m = statSync(join(dir, name)).mtimeMs
      if (m > newest) newest = m
    } catch {
      // skip a vanished file
    }
  }
  return newest
}
