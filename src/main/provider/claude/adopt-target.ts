import { readFileSync } from 'node:fs'
import { indexTranscripts, readSessionFiles } from './discover'
import { parseTranscript } from './transcript'

export interface AdoptTargetDeps {
  claudeDir: string
  isPidAlive: (pid: number) => boolean
  id: string
}

/**
 * Resolve what Adopt needs to safely resume a session: whether any live process still owns it (the
 * liveness re-check that backs the Ended-only state gate) and the working directory to relaunch it in.
 * cwd comes from the freshest registry entry, else from the Transcript, which records `cwd` on every
 * row — so a reaped registry file (the common Ended case) still yields it. Null when neither source
 * gives a cwd: there is nothing to adopt.
 */
export function resolveAdoptTarget({ claudeDir, isPidAlive, id }: AdoptTargetDeps): { alive: boolean; cwd: string } | null {
  const reg = readSessionFiles(claudeDir)
    .filter((s) => s.sessionId === id)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
  const alive = reg ? isPidAlive(reg.pid) : false

  let cwd = reg?.cwd ?? ''
  if (!cwd) {
    const t = indexTranscripts(claudeDir).get(id)
    if (t) {
      try {
        cwd = parseTranscript(readFileSync(t.path, 'utf8')).cwd
      } catch {
        cwd = ''
      }
    }
  }
  return cwd ? { alive, cwd } : null
}
