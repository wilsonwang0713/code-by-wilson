import type { Session, PersistedSession } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'
import { transaction, type SqliteDb } from './driver'

/** Bump when the schema changes; `migrate` rebuilds the index (a disposable cache) to match. */
const SCHEMA_VERSION = 1

function userVersion(db: SqliteDb): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
}

/**
 * Bring the index up to the current schema. The SQLite file is a rebuildable cache (ADR-0002: the
 * raw JSONL is the source of truth), so a version bump just drops and recreates — the next sync
 * repopulates from disk. Keyed on PRAGMA user_version so every launch past the first is a no-op.
 */
export function migrate(db: SqliteDb): void {
  if (userVersion(db) < SCHEMA_VERSION) {
    db.exec(`
      DROP TABLE IF EXISTS sessions;
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project TEXT NOT NULL,
        branch TEXT,
        state TEXT NOT NULL,
        management TEXT NOT NULL,
        model TEXT NOT NULL,
        last_activity_ms INTEGER NOT NULL,
        awaiting_user INTEGER NOT NULL DEFAULT 0,
        transcript_mtime_ms INTEGER NOT NULL DEFAULT 0
      );
      PRAGMA user_version = ${SCHEMA_VERSION};
    `)
  }
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
  awaiting_user: number
  transcript_mtime_ms: number
}

function rowToPersisted(r: Row): PersistedSession {
  return {
    id: r.id,
    title: r.title,
    project: r.project,
    branch: r.branch ?? undefined,
    state: r.state as PersistedSession['state'],
    management: r.management as PersistedSession['management'],
    model: normalizeModelId(r.model),
    lastActivityMs: r.last_activity_ms,
    awaitingUser: !!r.awaiting_user,
    transcriptMtimeMs: r.transcript_mtime_ms,
  }
}

/**
 * Fill the deferred-scope fields a persisted snapshot doesn't carry — the single place these zeros
 * and empties live, so discovery and the DB read no longer hand-author the same defaults in two
 * spots. Real usage/cost/context/tasks/subagents arrive in later issues.
 */
export function hydrate(p: PersistedSession): Session {
  return {
    id: p.id,
    title: p.title,
    project: p.project,
    branch: p.branch,
    state: p.state,
    management: p.management,
    model: p.model,
    contextPct: 0,
    contextWindow: contextWindowFor(p.model),
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    equivApiValueUsd: 0,
    lastActivityMs: p.lastActivityMs,
    tasks: [],
    subagents: [],
  }
}

const UPSERT = `
  INSERT INTO sessions
    (id, title, project, branch, state, management, model, last_activity_ms, awaiting_user, transcript_mtime_ms)
  VALUES
    (@id, @title, @project, @branch, @state, @management, @model, @last_activity_ms, @awaiting_user, @transcript_mtime_ms)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    project = excluded.project,
    branch = excluded.branch,
    state = excluded.state,
    management = excluded.management,
    model = excluded.model,
    last_activity_ms = excluded.last_activity_ms,
    awaiting_user = excluded.awaiting_user,
    transcript_mtime_ms = excluded.transcript_mtime_ms
`

/**
 * Upsert snapshots by id: changed rows update in place, new ones insert, the rest are rewritten with
 * identical values (so a no-change pass leaves content untouched). One transaction, so a mid-batch
 * failure leaves the index as it was.
 */
export function upsertSessions(db: SqliteDb, snapshots: PersistedSession[]): void {
  const stmt = db.prepare(UPSERT)
  transaction(db, () => {
    for (const s of snapshots) {
      stmt.run({
        id: s.id,
        title: s.title,
        project: s.project,
        branch: s.branch ?? null,
        state: s.state,
        management: s.management,
        model: s.model,
        last_activity_ms: s.lastActivityMs,
        awaiting_user: s.awaitingUser ? 1 : 0,
        transcript_mtime_ms: s.transcriptMtimeMs,
      })
    }
  })
}

/** Every persisted snapshot, freshest first. The sync reads this once to learn stored mtimes and to
 *  reuse unchanged snapshots without reparsing. */
export function getPersisted(db: SqliteDb): PersistedSession[] {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY last_activity_ms DESC').all() as Row[]
  return rows.map(rowToPersisted)
}

/** The renderer-facing sessions: persisted snapshots hydrated with the deferred-scope defaults. */
export function getSessions(db: SqliteDb): Session[] {
  return getPersisted(db).map(hydrate)
}

/** Drop every row whose id isn't in `keepIds` — sessions that aged out of the window and aren't live.
 *  An empty keep-set clears the table. */
export function pruneSessions(db: SqliteDb, keepIds: string[]): void {
  if (keepIds.length === 0) {
    db.exec('DELETE FROM sessions')
    return
  }
  const placeholders = keepIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM sessions WHERE id NOT IN (${placeholders})`).run(...keepIds)
}
