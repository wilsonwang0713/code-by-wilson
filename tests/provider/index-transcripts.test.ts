import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { indexTranscripts } from '../../src/main/provider/claude/discover'

const tmpHomes: string[] = []
function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'cbw-'))
  tmpHomes.push(home)
  return home
}
afterEach(() => {
  for (const home of tmpHomes.splice(0)) rmSync(home, { recursive: true, force: true })
})

// Whole-second mtimes dodge filesystem mtime granularity; the helper returns the file path.
function writeTranscript(home: string, proj: string, id: string, mtimeSec: number): string {
  const dir = join(home, 'projects', proj)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${id}.jsonl`)
  writeFileSync(path, '{"type":"user","message":{"role":"user","content":"hi"}}\n')
  utimesSync(path, new Date(mtimeSec * 1000), new Date(mtimeSec * 1000))
  return path
}

describe('indexTranscripts', () => {
  it('maps each session id to its transcript path and mtime in one sweep', () => {
    const home = makeHome()
    writeTranscript(home, '-work-a', 'sess-a', 1_000_000)
    writeTranscript(home, '-work-b', 'sess-b', 2_000_000)
    const idx = indexTranscripts(home)
    expect([...idx.keys()].sort()).toEqual(['sess-a', 'sess-b'])
    expect(idx.get('sess-a')!.mtimeMs).toBe(1_000_000_000)
    expect(idx.get('sess-b')!.path.endsWith(join('-work-b', 'sess-b.jsonl'))).toBe(true)
  })

  it('ignores non-jsonl files', () => {
    const home = makeHome()
    const dir = join(home, 'projects', '-work-a')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'notes.txt'), 'nope')
    expect(indexTranscripts(home).size).toBe(0)
  })

  it('returns an empty map when projects is missing or unreadable', () => {
    const home = makeHome()
    expect(indexTranscripts(home).size).toBe(0)
    writeFileSync(join(home, 'projects'), 'not a dir') // readdir → ENOTDIR
    expect(indexTranscripts(home).size).toBe(0)
  })

  it('keeps the freshest path when an id appears under two project dirs', () => {
    const home = makeHome()
    writeTranscript(home, '-work-old', 'dup', 1_000)
    const fresh = writeTranscript(home, '-work-new', 'dup', 9_000)
    expect(indexTranscripts(home).get('dup')!.path).toBe(fresh)
  })
})
