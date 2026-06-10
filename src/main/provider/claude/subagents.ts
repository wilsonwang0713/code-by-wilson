import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { ModelId, Subagent } from '@shared/types'
import { normalizeModelId } from '@shared/models'
import { num, parseJsonlRows } from './transcript-row'

/** The `.meta.json` companion of a subagent transcript. */
export interface SubagentMeta {
  agentType: string
  description: string
  /** The id of the Task/Agent tool_use that spawned this subagent — the link to its parent. */
  toolUseId: string
}

/** One subagent's reconstruction inputs: its id, its meta, and its parsed transcript rows. */
export interface SubagentSource {
  agentId: string
  meta: SubagentMeta
  rows: any[]
}

/** What a single transcript (the main one, or one subagent's) contributes to reconstruction. */
interface Scan {
  /** tool_use ids dispatched in this transcript — used to find which agent (or main) owns a child. */
  toolUseIds: Set<string>
  /** tool_use_id → is_error, for the tool_results recorded in this transcript. */
  results: Map<string, boolean>
  /** First raw model string seen on an assistant row, normalized later. */
  model: string | undefined
  /** Summed input + output tokens across assistant rows (cache excluded — the Cost panel owns cache). */
  tokens: number
  /** Min / max parseable timestamp (ms); duration is their difference. */
  firstTs: number
  lastTs: number
}

function scanRows(rows: any[]): Scan {
  const toolUseIds = new Set<string>()
  const results = new Map<string, boolean>()
  let model: string | undefined
  let tokens = 0
  let firstTs = Infinity
  let lastTs = -Infinity
  for (const row of rows) {
    const ts = typeof row?.timestamp === 'string' ? Date.parse(row.timestamp) : NaN
    if (!Number.isNaN(ts)) {
      if (ts < firstTs) firstTs = ts
      if (ts > lastTs) lastTs = ts
    }
    const msg = row?.message
    if (row?.type === 'assistant') {
      if (!model && typeof msg?.model === 'string') model = msg.model
      const u = msg?.usage
      if (u && typeof u === 'object') tokens += num(u.input_tokens) + num(u.output_tokens)
    }
    const content = msg?.content
    if (Array.isArray(content)) {
      for (const b of content) {
        if (b?.type === 'tool_use' && typeof b.id === 'string') toolUseIds.add(b.id)
        if (b?.type === 'tool_result' && typeof b.tool_use_id === 'string') results.set(b.tool_use_id, !!b.is_error)
      }
    }
  }
  return { toolUseIds, results, model, tokens, firstTs, lastTs }
}

/**
 * Reconstruct the subagent forest from the main transcript's rows and each subagent's rows + meta. A
 * root subagent is dispatched from the main transcript; a nested one is dispatched from inside its
 * parent agent's transcript. Status comes from the dispatch's tool_result (absent ⇒ working, is_error ⇒
 * failed, else done). Pure: same input, same output.
 */
export function buildSubagentForest(mainRows: any[], agents: SubagentSource[]): Subagent[] {
  const mainScan = scanRows(mainRows)
  const scans = new Map<string, Scan>()
  for (const a of agents) scans.set(a.agentId, scanRows(a.rows))

  // owner[toolUseId] = the agentId that dispatched it, or null for the main transcript.
  const owner = new Map<string, string | null>()
  for (const id of mainScan.toolUseIds) owner.set(id, null)
  for (const a of agents) for (const id of scans.get(a.agentId)!.toolUseIds) owner.set(id, a.agentId)

  // is_error of a dispatch's result, searched across every transcript (main + all agents).
  const resultOf = (toolUseId: string): boolean | undefined => {
    if (mainScan.results.has(toolUseId)) return mainScan.results.get(toolUseId)
    for (const a of agents) {
      const r = scans.get(a.agentId)!.results
      if (r.has(toolUseId)) return r.get(toolUseId)
    }
    return undefined
  }

  const nodeById = new Map<string, Subagent>()
  for (const a of agents) {
    const s = scans.get(a.agentId)!
    const err = resultOf(a.meta.toolUseId)
    const status: Subagent['status'] = err === undefined ? 'working' : err ? 'failed' : 'done'
    const model: ModelId = normalizeModelId(s.model)
    const durationMs = Number.isFinite(s.firstTs) && s.lastTs >= s.firstTs ? s.lastTs - s.firstTs : 0
    nodeById.set(a.agentId, { id: a.agentId, type: a.meta.agentType, status, model, tokens: s.tokens, durationMs, children: [] })
  }

  // Link each node to its parent (or the roots), in dispatch order (the agent's own first timestamp).
  const ordered = [...agents].sort((x, y) => scans.get(x.agentId)!.firstTs - scans.get(y.agentId)!.firstTs)
  const roots: Subagent[] = []
  for (const a of ordered) {
    const node = nodeById.get(a.agentId)!
    const parentId = owner.get(a.meta.toolUseId)
    if (parentId && nodeById.has(parentId)) nodeById.get(parentId)!.children!.push(node)
    else roots.push(node)
  }

  // Drop empty children arrays so the output matches the optional `children?` shape.
  for (const node of nodeById.values()) if (node.children && node.children.length === 0) delete node.children
  return roots
}

/** projects/<proj>/<sid>.jsonl → projects/<proj>/<sid>/subagents */
export function subagentsDirFor(transcriptPath: string): string {
  return join(dirname(transcriptPath), basename(transcriptPath, '.jsonl'), 'subagents')
}

/** Newest mtime (ms) among the `agent-*.jsonl` files, or 0 when the dir is absent/empty. The transcript
 *  read folds this into its change token so a running subagent's growth re-triggers a poll. */
export function subagentsNewestMtime(dir: string): number {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return 0
  }
  let newest = 0
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue
    try {
      const m = statSync(join(dir, name)).mtimeMs
      if (m > newest) newest = m
    } catch {
      // skip a vanished file
    }
  }
  return newest
}

/** Read every `agent-<id>.meta.json` + `agent-<id>.jsonl` pair in a subagents dir into reconstruction
 *  inputs. A missing dir, a bad meta, or an unreadable transcript is skipped, never fatal. */
export function readSubagentSources(dir: string): SubagentSource[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const out: SubagentSource[] = []
  for (const name of names) {
    if (!name.startsWith('agent-') || !name.endsWith('.meta.json')) continue
    const agentId = name.slice('agent-'.length, -'.meta.json'.length)
    let meta: SubagentMeta
    try {
      const m = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      meta = {
        agentType: typeof m.agentType === 'string' ? m.agentType : '',
        description: typeof m.description === 'string' ? m.description : '',
        toolUseId: typeof m.toolUseId === 'string' ? m.toolUseId : '',
      }
    } catch {
      continue
    }
    let rows: any[] = []
    try {
      rows = parseJsonlRows(readFileSync(join(dir, `agent-${agentId}.jsonl`), 'utf8'))
    } catch {
      rows = []
    }
    out.push({ agentId, meta, rows })
  }
  return out
}
