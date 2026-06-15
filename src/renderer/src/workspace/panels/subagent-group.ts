import type { Subagent } from "@shared/types";

// JSX-free dock logic so the tests can import it under tsconfig.node.json (mirrors dock-tabs.ts).

/** The synthetic id of the pooled group: every lone serial dispatch and every unlocatable lane. */
export const INDIVIDUAL_GROUP_ID = "__individual__";

/** A band on the Subagents gantt. A "batch" is the set of agents fired in one assistant turn (a shared
 *  batchId, two or more members), drawn on its own time axis. The single "individual" group pools every
 *  lone dispatch on a shared axis and always renders last. */
export interface SubagentGroup {
  kind: "batch" | "individual";
  id: string;
  agents: Subagent[];
}

/** A batch's earliest positioned start, or Infinity when no member is positioned (sorts it after
 *  positioned batches; the id tiebreak keeps order deterministic past the resulting NaN). */
export function groupStartMs(group: SubagentGroup): number {
  let min = Infinity;
  for (const a of group.agents)
    if (a.startMs !== undefined && a.startMs < min) min = a.startMs;
  return min;
}

/** Batch order: longest pole first. durationMs is re-measured each poll, so no render clock is needed. */
function orderBatch(agents: Subagent[]): Subagent[] {
  return [...agents].sort(
    (a, b) => b.durationMs - a.durationMs || a.id.localeCompare(b.id),
  );
}

/** Pool order: start ascending, an unpositioned lane first (matching the timeline's left edge). Two
 *  unpositioned lanes yield NaN from -Infinity - -Infinity, which is falsy, so the id tiebreak fires. */
function orderPool(agents: Subagent[]): Subagent[] {
  return [...agents].sort(
    (a, b) =>
      (a.startMs ?? -Infinity) - (b.startMs ?? -Infinity) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Partition the flat lane list into batch groups plus one pooled group. A batchId shared by two or more
 * lanes is a batch (its own axis); a singleton batch or a lane with no batchId joins the pool (shared
 * axis), which always sorts last. Batch groups sort by earliest start. Pure: never mutates the input,
 * same input yields the same output.
 */
export function groupSubagents(lanes: Subagent[]): SubagentGroup[] {
  const buckets = new Map<string, Subagent[]>();
  const pool: Subagent[] = [];
  for (const a of lanes) {
    if (a.batchId === undefined) {
      pool.push(a);
      continue;
    }
    const arr = buckets.get(a.batchId) ?? [];
    arr.push(a);
    buckets.set(a.batchId, arr);
  }
  const batches: SubagentGroup[] = [];
  for (const [id, agents] of buckets) {
    if (agents.length >= 2)
      batches.push({ kind: "batch", id, agents: orderBatch(agents) });
    else pool.push(...agents);
  }
  batches.sort(
    (x, y) => groupStartMs(x) - groupStartMs(y) || x.id.localeCompare(y.id),
  );
  if (pool.length > 0)
    batches.push({
      kind: "individual",
      id: INDIVIDUAL_GROUP_ID,
      agents: orderPool(pool),
    });
  return batches;
}
