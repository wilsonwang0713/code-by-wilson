import { describe, expect, it } from "vitest";
import type { Subagent } from "@shared/types";
import { indexByDispatch } from "../../src/renderer/src/workspace/drill-index";

/** A node carrying only what indexByDispatch reads. */
function node(
  id: string,
  dispatchId: string | undefined,
  children?: Subagent[],
): Subagent {
  const n: Subagent = {
    id,
    type: "Explore",
    status: "done",
    tokens: 0,
    toolCount: 0,
    durationMs: 0,
  };
  if (dispatchId !== undefined) n.dispatchId = dispatchId;
  if (children) n.children = children;
  return n;
}

describe("indexByDispatch", () => {
  it("is empty for an empty forest", () => {
    expect(indexByDispatch([]).size).toBe(0);
  });

  it("indexes every node by dispatchId across nesting levels", () => {
    const kid = node("kid", "d-kid");
    const root = node("root", "d-root", [kid]);
    const map = indexByDispatch([root]);
    expect(map.size).toBe(2);
    expect(map.get("d-root")).toBe(root);
    expect(map.get("d-kid")).toBe(kid);
  });

  it("skips a node with no dispatchId but still recurses its children", () => {
    const kid = node("kid", "d-kid");
    const root = node("root", undefined, [kid]);
    const map = indexByDispatch([root]);
    expect(map.size).toBe(1);
    expect(map.has("d-kid")).toBe(true);
  });
});
