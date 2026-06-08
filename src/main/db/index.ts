import Database from 'better-sqlite3'
import type { Session } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'

export type AppDb = Database.Database

export function openDb(path: string): AppDb {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project TEXT NOT NULL,
      branch TEXT,
      state TEXT NOT NULL,
      management TEXT NOT NULL,
      model TEXT NOT NULL,
      last_activity_ms INTEGER NOT NULL
    )
  `)
  return db
}

/** Full-replace the running-session snapshot. Incremental sync is a later issue. */
export function replaceSessions(db: AppDb, sessions: Session[]): void {
  const insert = db.prepare(`
    INSERT INTO sessions (id, title, project, branch, state, management, model, last_activity_ms)
    VALUES (@id, @title, @project, @branch, @state, @management, @model, @last_activity_ms)
  `)

  const tx = db.transaction((rows: Session[]) => {
    db.prepare('DELETE FROM sessions').run()
    for (const s of rows) {
      insert.run({
        id: s.id,
        title: s.title,
        project: s.project,
        branch: s.branch ?? null,
        state: s.state,
        management: s.management,
        model: s.model,
        last_activity_ms: s.lastActivityMs,
      })
    }
  })

  tx(sessions)
}

interface Row {
  id: string
  title: string
  project: string
  branch: string | null
  state: string
  management: string
  model: string
  last_activity_ms: number
}

export function getSessions(db: AppDb): Session[] {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY last_activity_ms DESC').all() as Row[]

  return rows.map((r) => {
    const model = normalizeModelId(r.model)
    return {
      id: r.id,
      title: r.title,
      project: r.project,
      branch: r.branch ?? undefined,
      state: r.state as Session['state'],
      management: r.management as Session['management'],
      model,
      contextPct: 0,
      contextWindow: contextWindowFor(model),
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
      equivApiValueUsd: 0,
      lastActivityMs: r.last_activity_ms,
      tasks: [],
      subagents: [],
    }
  })
}
