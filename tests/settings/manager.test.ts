import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSettingsManager } from '../../src/main/settings/manager'

const NOW = 1781000000000 // fixed clock (ms) for deterministic backup timestamps

const tmpHomes: string[] = []
function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'cbw-settings-'))
  tmpHomes.push(home)
  return home
}
afterEach(() => {
  for (const home of tmpHomes.splice(0)) rmSync(home, { recursive: true, force: true })
})

const settingsPath = (home: string) => join(home, 'settings.json')
const readRaw = (home: string) => readFileSync(settingsPath(home), 'utf8')
const readJson = (home: string) => JSON.parse(readRaw(home))
const readState = (home: string) => JSON.parse(readFileSync(join(home, '.code-by-wire', 'state.json'), 'utf8'))

// The exact command install writes — the contract the wrapper script (issue #11) will live behind.
const appCommandFor = (home: string) => `"${join(home, '.code-by-wire', 'statusline-wrapper.sh')}"`

describe('install — clean (AC #2)', () => {
  it('adds the app statusLine and preserves every other key when none exists', () => {
    const home = makeHome()
    writeFileSync(settingsPath(home), JSON.stringify({ theme: 'dark', permissions: { allow: ['Bash'] } }, null, 2))
    const mgr = createSettingsManager({ claudeDir: home, now: () => NOW })

    expect(mgr.isInstalled()).toBe(false)
    const result = mgr.install()

    const after = readJson(home)
    expect(after.statusLine).toEqual({ type: 'command', command: appCommandFor(home) })
    expect(after.theme).toBe('dark') // untouched
    expect(after.permissions).toEqual({ allow: ['Bash'] }) // untouched
    expect(result.wrappedExisting).toBe(false)
    expect(mgr.isInstalled()).toBe(true)
  })

  it('creates settings.json from scratch when the file is absent', () => {
    const home = makeHome()
    const mgr = createSettingsManager({ claudeDir: home, now: () => NOW })

    expect(existsSync(settingsPath(home))).toBe(false)
    const result = mgr.install()

    expect(readJson(home).statusLine).toEqual({ type: 'command', command: appCommandFor(home) })
    expect(result.wrappedExisting).toBe(false)
    expect(mgr.isInstalled()).toBe(true)
  })
})
