import type { Subagent } from "@shared/types";

/** The handler bundle threaded through the shared TranscriptFeed: which dispatch ids are drillable, and
 *  the click that pushes the resolved Subagent onto the drill-stack. */
export type DispatchDrill = {
  drillableIds: ReadonlySet<string>;
  onDrill: (toolUseId: string) => void;
};

/** Flatten the nested subagent forest into a lookup from each node's spawning dispatch id to the node.
 *  The session transcript doc already carries the full nested forest, so this resolves an inline
 *  dispatch at any depth. Nodes without a dispatchId are skipped (they can never be a drill target);
 *  their children are still walked. Pure: same input, same output. */
export function indexByDispatch(forest: Subagent[]): Map<string, Subagent> {
  const map = new Map<string, Subagent>();
  const walk = (nodes: Subagent[]): void => {
    for (const n of nodes) {
      if (n.dispatchId) map.set(n.dispatchId, n);
      if (n.children) walk(n.children);
    }
  };
  walk(forest);
  return map;
}
