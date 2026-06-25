import { describe, it, expect } from "vitest";
import {
  extractTurns,
  foldTurnsByModel,
} from "../../src/main/provider/claude/turns";

/** One assistant JSONL line with a given model + input tokens. */
const assistant = (id: string, model: string, input: number): string =>
  JSON.stringify({
    type: "assistant",
    cwd: "/work/proj",
    gitBranch: "main",
    timestamp: "2026-06-09T03:00:00.000Z",
    message: {
      role: "assistant",
      id,
      model,
      usage: {
        input_tokens: input,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      content: [{ type: "text", text: "ok" }],
    },
  });

describe("foldTurnsByModel", () => {
  it("folds turns into one entry per model, summed, biggest first", () => {
    const jsonl = [
      assistant("m1", "claude-opus-4-8", 100),
      assistant("m2", "claude-opus-4-8", 50),
      assistant("m3", "claude-sonnet-4-6", 30),
    ].join("\n");
    const folded = foldTurnsByModel(extractTurns(jsonl, "sess-1"));
    expect(folded).toEqual([
      {
        modelRaw: "claude-opus-4-8",
        usage: expect.objectContaining({ inputTokens: 150 }),
      },
      {
        modelRaw: "claude-sonnet-4-6",
        usage: expect.objectContaining({ inputTokens: 30 }),
      },
    ]);
  });

  it("folds a turn with no model under null", () => {
    const noModel = JSON.stringify({
      type: "assistant",
      timestamp: "2026-06-09T03:00:00.000Z",
      message: {
        role: "assistant",
        id: "x",
        usage: { input_tokens: 7 },
        content: [],
      },
    });
    const folded = foldTurnsByModel(extractTurns(noModel, "sess-1"));
    expect(folded).toHaveLength(1);
    expect(folded[0].modelRaw).toBeNull();
    expect(folded[0].usage.inputTokens).toBe(7);
  });
});
