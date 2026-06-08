import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTranscript, deriveTitle } from '../../src/main/provider/claude/transcript'

const fx = (p: string) => readFileSync(resolve('tests/fixtures/claude-home', p), 'utf8')

describe('parseTranscript', () => {
  it('extracts title, project, branch, model, and last activity', () => {
    const s = parseTranscript(
      fx('projects/-work-code-by-wire/aaaa1111-1111-1111-1111-111111111111.jsonl'),
    )
    expect(s.title).toBe('Add a login form to the settings page')
    expect(s.project).toBe('code-by-wire')
    expect(s.cwd).toBe('/work/code-by-wire')
    expect(s.branch).toBe('feature/login')
    expect(s.model).toBe('claude-sonnet-4-6')
    expect(s.lastActivityMs).toBe(Date.parse('2026-06-08T22:54:06.078Z'))
  })

  it('strips slash-command wrappers, skips meta lines, and tolerates malformed json', () => {
    const s = parseTranscript(
      fx('projects/-work-api-service/cccc3333-3333-3333-3333-333333333333.jsonl'),
    )
    expect(s.title).toBe('deploy')
    expect(s.model).toBe('claude-opus-4-8')
    expect(s.project).toBe('api-service')
    expect(s.branch).toBe('main')
  })
})

describe('deriveTitle', () => {
  it('falls back to the project basename when there is no prose', () => {
    expect(deriveTitle([], '/work/empty-proj')).toBe('empty-proj')
  })

  it('skips empty prompts and picks the first real one', () => {
    expect(
      deriveTitle(['<command-message></command-message>', '   ', 'Fix the timeout bug'], '/x/y'),
    ).toBe('Fix the timeout bug')
  })
})
