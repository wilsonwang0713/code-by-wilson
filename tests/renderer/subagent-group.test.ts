import { describe, expect, it } from "vitest";
import type { Subagent } from "@shared/types";
import {
  INDIVIDUAL_GROUP_ID,
  groupSubagents,
} from "../../src/renderer/src/workspace/panels/subagent-group";

/** A lane carrying only the fields the grouping reads. */
function lane(
  id: string,
  batchId: string | undefined,
  opts: Partial<Subagent> = {},
): Subagent {
  return {
    id,
    type: opts.type ?? "general-purpose",
    status: opts.status ?? "done",
    tokens: 0,
    toolCount: 0,
    durationMs: opts.durationMs ?? 0,
    startMs: opts.startMs,
    batchId,
  };
}

describe("groupSubagents", () => {
  it("is empty for no lanes", () => {
    expect(groupSubagents([])).toEqual([]);
  });

  it("groups two-plus lanes sharing a batchId into one batch group", () => {
    const groups = groupSubagents([lane("a", "b1"), lane("b", "b1")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("batch");
    expect(groups[0].id).toBe("b1");
    expect(groups[0].agents.map((a) => a.id).sort()).toEqual(["a", "b"]);
  });

  it("pools singleton batches and unknown-batch lanes into one trailing group", () => {
    const groups = groupSubagents([
      lane("a", "b1", { startMs: 0 }),
      lane("b", "b1", { startMs: 0 }),
      lane("c", "b2", { startMs: 5 }), // singleton batch -> pool
      lane("d", undefined, { startMs: 3 }), // no batch -> pool
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["batch", "individual"]);
    const pool = groups[1];
    expect(pool.id).toBe(INDIVIDUAL_GROUP_ID);
    // pool orders by startMs ascending: d(3) before c(5)
    expect(pool.agents.map((a) => a.id)).toEqual(["d", "c"]);
  });

  it("orders batch members by duration descending", () => {
    const g = groupSubagents([
      lane("a", "b1", { durationMs: 10 }),
      lane("b", "b1", { durationMs: 50 }),
      lane("c", "b1", { durationMs: 30 }),
    ])[0];
    expect(g.agents.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });

  it("orders batch groups by earliest start, pool last", () => {
    const groups = groupSubagents([
      lane("l1", "late", { startMs: 100 }),
      lane("l2", "late", { startMs: 100 }),
      lane("e1", "early", { startMs: 10 }),
      lane("e2", "early", { startMs: 10 }),
      lane("solo", undefined, { startMs: 5 }),
    ]);
    expect(groups.map((g) => g.id)).toEqual([
      "early",
      "late",
      INDIVIDUAL_GROUP_ID,
    ]);
  });

  it("breaks an unpositioned pool tie by id (NaN-safe)", () => {
    // Two pooled lanes with no startMs: -Infinity - -Infinity is NaN, so the id tiebreak must fire.
    const pool = groupSubagents([
      lane("z", undefined),
      lane("a", undefined),
    ])[0];
    expect(pool.id).toBe(INDIVIDUAL_GROUP_ID);
    expect(pool.agents.map((a) => a.id)).toEqual(["a", "z"]);
  });

  it("does not mutate its input", () => {
    const input = [
      lane("b", "x", { durationMs: 1 }),
      lane("a", "x", { durationMs: 9 }),
    ];
    const before = input.map((a) => a.id);
    groupSubagents(input);
    expect(input.map((a) => a.id)).toEqual(before);
  });
});
