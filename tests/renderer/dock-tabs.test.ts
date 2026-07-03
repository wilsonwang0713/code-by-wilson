import { describe, expect, it } from "vitest";
import type { Subagent } from "@shared/types";
import {
  defaultDockTab,
  flattenSubagents,
  subagentStats,
} from "../../src/renderer/src/workspace/panels/dock-tabs";

/** A minimal Subagent for the helper tests — only the fields the helpers read. */
function sub(
  id: string,
  status: Subagent["status"],
  children?: Subagent[],
): Subagent {
  return {
    id,
    type: "general-purpose",
    status,
    tokens: 0,
    toolCount: 0,
    durationMs: 0,
    children,
  };
}

describe("subagentStats", () => {
  it("is all zero for an empty forest", () => {
    expect(subagentStats([])).toEqual({
      total: 0,
      working: 0,
      done: 0,
      failed: 0,
    });
  });
  it("counts the whole forest by status, children included", () => {
    expect(
      subagentStats([
        sub("a", "working", [sub("a1", "done"), sub("a2", "working")]),
        sub("b", "failed"),
      ]),
    ).toEqual({ total: 4, working: 2, done: 1, failed: 1 });
  });
  it("counts a nested working child", () => {
    expect(subagentStats([sub("a", "done", [sub("a1", "working")])])).toEqual({
      total: 2,
      working: 1,
      done: 1,
      failed: 0,
    });
  });
});

describe("defaultDockTab", () => {
  it("defaults to subagents while a fan-out is alive, tasks or not", () => {
    expect(defaultDockTab(subagentStats([sub("a", "working")]), 0)).toBe(
      "subagents",
    );
    expect(defaultDockTab(subagentStats([sub("a", "working")]), 5)).toBe(
      "subagents",
    );
  });
  it("defaults to tasks when idle and any task exists", () => {
    expect(
      defaultDockTab({ total: 0, working: 0, done: 0, failed: 0 }, 3),
    ).toBe("tasks");
    expect(defaultDockTab(subagentStats([sub("a", "done")]), 1)).toBe("tasks");
  });
  it("falls back to turns when idle with no tasks", () => {
    expect(
      defaultDockTab({ total: 0, working: 0, done: 0, failed: 0 }, 0),
    ).toBe("turns");
    expect(defaultDockTab(subagentStats([sub("a", "done")]), 0)).toBe("turns");
  });
});

describe("flattenSubagents", () => {
  it("is empty for an empty forest", () => {
    expect(flattenSubagents([])).toEqual([]);
  });
  it("returns roots in order when there is no nesting", () => {
    expect(
      flattenSubagents([sub("a", "done"), sub("b", "working")]).map(
        (s) => s.id,
      ),
    ).toEqual(["a", "b"]);
  });
  it("flattens children depth-first, each parent before its subtree", () => {
    const forest = [
      sub("a", "done", [sub("a1", "done"), sub("a2", "working")]),
      sub("b", "failed"),
    ];
    expect(flattenSubagents(forest).map((s) => s.id)).toEqual([
      "a",
      "a1",
      "a2",
      "b",
    ]);
  });
});
