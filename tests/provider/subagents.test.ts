import { describe, it, expect } from 'vitest'
import { buildSubagentForest, type SubagentSource } from '../../src/main/provider/claude/subagents'

const SONNET = 'global.anthropic.claude-sonnet-4-6'
const HAIKU = 'global.anthropic.claude-haiku-4-5'

// A main transcript that dispatches `toolUseId` and (optionally) records its result.
function main(toolUseId: string, result?: { is_error: boolean }): any[] {
  const rows: any[] = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: toolUseId, name: 'Task' }] } },
  ]
  if (result) rows.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: result.is_error }] } })
  return rows
}

function agent(agentId: string, toolUseId: string, agentType: string, rows: any[]): SubagentSource {
  return { agentId, meta: { agentType, description: '', toolUseId }, rows }
}

describe('buildSubagentForest', () => {
  it('builds a flat fan-out of roots with type/model/tokens/duration', () => {
    const forest = buildSubagentForest(
      [...main('tu-1', { is_error: false }), ...main('tu-2', { is_error: false })],
      [
        agent('a1', 'tu-1', 'Explore', [
          { type: 'assistant', timestamp: '2026-06-04T03:00:00.000Z', message: { model: SONNET, usage: { input_tokens: 5, output_tokens: 100 }, content: [] } },
          { type: 'assistant', timestamp: '2026-06-04T03:00:10.000Z', message: { model: SONNET, usage: { input_tokens: 2, output_tokens: 50 }, content: [] } },
        ]),
        agent('a2', 'tu-2', 'general-purpose', [
          { type: 'assistant', timestamp: '2026-06-04T03:00:01.000Z', message: { model: HAIKU, usage: { input_tokens: 1, output_tokens: 9 }, content: [] } },
        ]),
      ],
    )
    expect(forest).toEqual([
      { id: 'a1', type: 'Explore', status: 'done', model: 'claude-sonnet-4-6', tokens: 157, durationMs: 10000 },
      { id: 'a2', type: 'general-purpose', status: 'done', model: 'claude-haiku-4-5', tokens: 10, durationMs: 0 },
    ])
  })

  it('nests a child under the parent that dispatched it', () => {
    const forest = buildSubagentForest(main('root', { is_error: false }), [
      agent('parent', 'root', 'general-purpose', [
        { type: 'assistant', timestamp: '2026-06-04T03:00:00.000Z', message: { model: SONNET, usage: { input_tokens: 1, output_tokens: 10 }, content: [{ type: 'tool_use', id: 'child', name: 'Task' }] } },
        { type: 'user', timestamp: '2026-06-04T03:00:05.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 'child', is_error: false }] } },
      ]),
      agent('kid', 'child', 'Explore', [
        { type: 'assistant', timestamp: '2026-06-04T03:00:01.000Z', message: { model: HAIKU, usage: { input_tokens: 1, output_tokens: 4 }, content: [] } },
      ]),
    ])
    expect(forest).toEqual([
      {
        id: 'parent', type: 'general-purpose', status: 'done', model: 'claude-sonnet-4-6', tokens: 11, durationMs: 5000,
        children: [{ id: 'kid', type: 'Explore', status: 'done', model: 'claude-haiku-4-5', tokens: 5, durationMs: 0 }],
      },
    ])
  })

  it('marks a subagent working when its dispatch has no result yet', () => {
    const forest = buildSubagentForest(main('tu-1'), [
      agent('a1', 'tu-1', 'Explore', [
        { type: 'assistant', timestamp: '2026-06-04T03:00:00.000Z', message: { model: SONNET, usage: { input_tokens: 1, output_tokens: 1 }, content: [] } },
      ]),
    ])
    expect(forest[0].status).toBe('working')
  })

  it('marks a subagent failed when its dispatch result is an error', () => {
    const forest = buildSubagentForest(main('tu-1', { is_error: true }), [
      agent('a1', 'tu-1', 'Explore', [
        { type: 'assistant', timestamp: '2026-06-04T03:00:00.000Z', message: { model: SONNET, usage: { input_tokens: 1, output_tokens: 1 }, content: [] } },
      ]),
    ])
    expect(forest[0].status).toBe('failed')
  })

  it('returns [] when there are no subagents', () => {
    expect(buildSubagentForest(main('tu-1', { is_error: false }), [])).toEqual([])
  })
})
