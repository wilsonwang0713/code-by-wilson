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
    expect(s.awaitingUser).toBe(false)
    // The fixture's single assistant turn carries usage {input:100, output:50, cache_read:10, cache_creation:5}.
    expect(s.usage).toEqual({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5 })
    expect(s.contextTokens).toBe(110) // latest turn: input (100) + cache-read (10)
    expect(s.contextWindow).toBe(200_000)
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

  it('derives a title from array-form user content (content blocks)', () => {
    const jsonl = JSON.stringify({
      type: 'user',
      isMeta: false,
      cwd: '/work/app',
      message: { role: 'user', content: [{ type: 'text', text: 'Add pagination to the list view' }] },
    })
    expect(parseTranscript(jsonl).title).toBe('Add pagination to the list view')
  })

  it('ignores tool-result blocks and finds the first real text prompt', () => {
    const jsonl = [
      {
        type: 'user',
        isMeta: false,
        cwd: '/work/app',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'output' }] },
      },
      {
        type: 'user',
        isMeta: false,
        cwd: '/work/app',
        message: { role: 'user', content: [{ type: 'text', text: 'Fix the flaky test' }] },
      },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).title).toBe('Fix the flaky test')
  })

  it('flags awaitingUser when the last turn leaves a tool use unanswered', () => {
    const jsonl = [
      { type: 'user', isMeta: false, cwd: '/work/app', message: { role: 'user', content: 'Run the migration' } },
      {
        type: 'assistant',
        timestamp: '2026-06-09T01:00:00.000Z',
        message: {
          role: 'assistant',
          model: 'claude-opus-4-8',
          content: [
            { type: 'text', text: 'Running it now.' },
            { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'make migrate' } },
          ],
        },
      },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(true)
  })

  it('clears awaitingUser once the tool use has a result', () => {
    const jsonl = [
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: {} }] } },
      { type: 'user', isMeta: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'done' }] } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(false)
  })

  it('keeps awaitingUser true when only one of several tool uses is answered', () => {
    const jsonl = [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: {} },
            { type: 'tool_use', id: 'toolu_2', name: 'Read', input: {} },
          ],
        },
      },
      {
        type: 'user',
        isMeta: false,
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'done' }] },
      },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(true)
  })

  it('leaves awaitingUser false for a plain completed turn', () => {
    const jsonl = [
      { type: 'user', isMeta: false, cwd: '/work/app', message: { role: 'user', content: 'Summarize the file' } },
      { type: 'assistant', message: { role: 'assistant', model: 'claude-opus-4-8', content: [{ type: 'text', text: 'Here is the summary.' }] } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(false)
  })

  it('does not latch awaitingUser on a tool_use the user interrupted earlier in the session', () => {
    // The assistant started a tool, the user cut it off with a new prompt instead of letting it
    // return, and the session finished cleanly. The abandoned tool_use lives in the file forever;
    // it must not keep the session pinned to Waiting. (96% of real awaitingUser=true cases are this.)
    const jsonl = [
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_interrupted', name: 'Read', input: {} }] } },
      { type: 'user', isMeta: false, message: { role: 'user', content: 'actually, do this instead' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(false)
  })

  it('reflects only the latest assistant turn, not an earlier abandoned tool_use', () => {
    // Interrupted tool, then a fresh turn whose own tool gets answered. Only the last turn counts.
    const jsonl = [
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_old', name: 'Bash', input: {} }] } },
      { type: 'user', isMeta: false, message: { role: 'user', content: 'stop, read this first' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_new', name: 'Read', input: {} }] } },
      { type: 'user', isMeta: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_new', content: 'ok' }] } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'All set.' }] } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    expect(parseTranscript(jsonl).awaitingUser).toBe(false)
  })

  it('sums usage across assistant turns and takes the latest turn for context size', () => {
    const jsonl = [
      { type: 'user', isMeta: false, cwd: '/w/app', message: { role: 'user', content: 'go' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-opus-4-8',
          usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 800 },
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-opus-4-8',
          usage: { input_tokens: 1500, output_tokens: 300, cache_read_input_tokens: 9000, cache_creation_input_tokens: 400 },
        },
      },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    const s = parseTranscript(jsonl)
    expect(s.usage).toEqual({ inputTokens: 2500, outputTokens: 500, cacheReadTokens: 14000, cacheCreationTokens: 1200 })
    expect(s.contextTokens).toBe(10500) // latest turn only: 1500 + 9000, not the running sum
  })

  it('treats assistant turns with no usage block as zero', () => {
    const jsonl = [
      { type: 'user', isMeta: false, cwd: '/w/app', message: { role: 'user', content: 'go' } },
      { type: 'assistant', message: { role: 'assistant', model: 'claude-opus-4-8', content: [{ type: 'text', text: 'done' }] } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')
    const s = parseTranscript(jsonl)
    expect(s.usage).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 })
    expect(s.contextTokens).toBe(0)
  })

  it('resolves the 1M window from a [1m] model tag while still normalizing the model', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        model: 'claude-opus-4-8[1m]',
        usage: { input_tokens: 300_000, output_tokens: 1000, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 0 },
      },
    })
    const s = parseTranscript(jsonl)
    expect(s.model).toBe('claude-opus-4-8') // normalized: the [1m] suffix is stripped from the id
    expect(s.contextWindow).toBe(1_000_000) // ...but the window keeps the 1M bit
    expect(s.contextTokens).toBe(400_000)
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

  it('surfaces the command name for a slash-command turn, not the stripped soup', () => {
    expect(
      deriveTitle(
        [
          '<command-name>/code-review</command-name>\n<command-message>code-review</command-message>',
        ],
        '/x/y',
      ),
    ).toBe('/code-review')
  })

  it('keeps prose containing angle-bracket operators, JSX, and generics intact', () => {
    expect(deriveTitle(['Why does a < b && b > c fail?'], '/x/y')).toBe(
      'Why does a < b && b > c fail?',
    )
    expect(deriveTitle(['Render <Button onClick={fn}/> in the modal'], '/x/y')).toBe(
      'Render <Button onClick={fn}/> in the modal',
    )
  })
})
