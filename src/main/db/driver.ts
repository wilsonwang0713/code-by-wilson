/**
 * The minimal SQLite surface the index uses, satisfied by two drivers: better-sqlite3 in the
 * Electron main process (its bundled Node 20 predates the built-in), and the built-in node:sqlite
 * in the Vitest test process (system Node 24). Programming the store against this interface — not a
 * concrete driver — is what lets the same persistence code run against a scratch SQLite in tests
 * while production keeps better-sqlite3. Stick to the common subset: no `.transaction()` sugar (use
 * `transaction()` below) and no `.pragma()` (use `exec('PRAGMA …')`).
 */
export interface SqliteStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
}

// The loose shape both concrete drivers expose. `any` on the variadic params dodges the drivers'
// stricter `SupportedValueType[]` typings without leaking a cast into every call site.
type RawStatement = { run(...p: any[]): any; get(...p: any[]): any; all(...p: any[]): any[] }
type RawDb = { exec(sql: string): unknown; prepare(sql: string): RawStatement }

/** Adapt a concrete driver handle (better-sqlite3 Database or node:sqlite DatabaseSync) to SqliteDb. */
export function wrap(db: RawDb): SqliteDb {
  return {
    exec: (sql) => {
      db.exec(sql)
    },
    prepare: (sql) => {
      const stmt = db.prepare(sql)
      return {
        run: (...p) => stmt.run(...p),
        get: (...p) => stmt.get(...p),
        all: (...p) => stmt.all(...p),
      }
    },
  }
}

/**
 * Run `fn` inside a single transaction. better-sqlite3's `db.transaction()` wrapper doesn't exist on
 * node:sqlite, so both drivers share this explicit BEGIN/COMMIT (ROLLBACK on throw) instead.
 */
export function transaction(db: SqliteDb, fn: () => void): void {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
