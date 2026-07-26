import { describe, it, expect } from "vitest";
import {
  foldRingRows,
  MAX_RINGS,
} from "../../../src/renderer/src/stats/ring-rows";
import type { StatsByModel } from "../../../src/shared/stats";

function row(modelRaw: string | null, totalTokens: number): StatsByModel {
  return { modelRaw, totalTokens, inputTokens: 0, outputTokens: 0 };
}

describe("foldRingRows", () => {
  it("passes through when the model count fits the ring budget", () => {
    const rows = [row("a", 300), row("b", 200), row("c", 100)];
    const out = foldRingRows(rows);
    expect(out).toEqual([
      { modelRaw: "a", totalTokens: 300 },
      { modelRaw: "b", totalTokens: 200 },
      { modelRaw: "c", totalTokens: 100 },
    ]);
  });

  it("sorts by tokens descending with the raw id as a stable tiebreak", () => {
    const out = foldRingRows([row("z", 100), row("a", 100), row("m", 900)]);
    expect(out.map((r) => r.modelRaw)).toEqual(["m", "a", "z"]);
  });

  it("drops zero-token rows before folding", () => {
    const out = foldRingRows([row("a", 100), row("b", 0)]);
    expect(out).toEqual([{ modelRaw: "a", totalTokens: 100 }]);
  });

  it("folds the tail into one Other bucket once rows exceed MAX_RINGS", () => {
    const rows = [
      row("claude-opus-4-8", 700),
      row("gpt-5.6-sol", 600),
      row("claude-sonnet-4-6", 500),
      row("gpt-5.5", 400),
      row("claude-haiku-4-5", 300),
      row("gpt-5.1", 200),
      row(null, 100),
    ];
    const out = foldRingRows(rows);
    expect(out).toHaveLength(MAX_RINGS);
    // top MAX_RINGS - 1 real models keep their identity...
    expect(out.slice(0, MAX_RINGS - 1).map((r) => r.modelRaw)).toEqual([
      "claude-opus-4-8",
      "gpt-5.6-sol",
      "claude-sonnet-4-6",
      "gpt-5.5",
    ]);
    // ...and the fold bucket carries the EXACT remainder, so shares still sum to the total
    const other = out[MAX_RINGS - 1];
    expect(other).toEqual({
      modelRaw: null,
      totalTokens: 300 + 200 + 100,
      otherCount: 3,
    });
    const sum = out.reduce((s, r) => s + r.totalTokens, 0);
    expect(sum).toBe(rows.reduce((s, r) => s + r.totalTokens, 0));
  });

  it("a boundary count of exactly MAX_RINGS renders every model, no fold", () => {
    const rows = [
      row("a", 500),
      row("b", 400),
      row("c", 300),
      row("d", 200),
      row("e", 100),
    ];
    const out = foldRingRows(rows);
    expect(out).toHaveLength(MAX_RINGS);
    expect(out.every((r) => r.otherCount === undefined)).toBe(true);
  });
});
