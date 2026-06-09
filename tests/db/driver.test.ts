import { describe, it, expect } from 'vitest'
import { transaction } from '../../src/main/db/driver'
import { openTestDb } from '../helpers/sqlite'

describe('SqliteDb seam (node:sqlite)', () => {
  it('execs, prepares, and round-trips @named params', () => {
    const db = openTestDb()
    db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER NOT NULL)')
    db.prepare('INSERT INTO t (id, n) VALUES (@id, @n)').run({ id: 'a', n: 1 })
    expect({ ...(db.prepare('SELECT id, n FROM t WHERE id = ?').get('a') as object) }).toEqual({
      id: 'a',
      n: 1,
    })
  })

  it('commits a transaction', () => {
    const db = openTestDb()
    db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)')
    const ins = db.prepare('INSERT INTO t (id) VALUES (?)')
    transaction(db, () => {
      ins.run('a')
      ins.run('b')
    })
    expect(db.prepare('SELECT count(*) AS c FROM t').get()).toMatchObject({ c: 2 })
  })

  it('rolls back a transaction that throws, leaving no partial writes', () => {
    const db = openTestDb()
    db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)')
    const ins = db.prepare('INSERT INTO t (id) VALUES (?)')
    expect(() =>
      transaction(db, () => {
        ins.run('a')
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(db.prepare('SELECT count(*) AS c FROM t').get()).toMatchObject({ c: 0 })
  })
})
