import { describe, it, expect } from "vitest";
import { extractCodexTurns } from "../../src/main/provider/codex/turns";

const meta = (cwd: string, branch?: string) =>
  JSON.stringify({
    timestamp: "2026-07-25T11:30:12.632Z",
    type: "session_meta",
    payload: { session_id: "s1", cwd, ...(branch ? { git: { branch } } : {}) },
  });

const turnCtx = (model: string) =>
  JSON.stringify({
    timestamp: "2026-07-25T11:30:12.645Z",
    type: "turn_context",
    payload: { model, effort: "high", cwd: "/work/proj" },
  });

const tokenCount = (
  ts: string,
  totals: {
    input: number;
    cached: number;
    output: number;
    cacheWrite?: number;
  } | null,
) =>
  JSON.stringify({
    timestamp: ts,
    type: "event_msg",
    payload: {
      type: "token_count",
      info:
        totals === null
          ? null
          : {
              total_token_usage: {
                input_tokens: totals.input,
                cached_input_tokens: totals.cached,
                cache_write_input_tokens: totals.cacheWrite ?? 0,
                output_tokens: totals.output,
              },
              model_context_window: 258400,
            },
      rate_limits: {},
    },
  });

describe("extractCodexTurns", () => {
  it("diffs cumulative totals into per-request usage with disjoint input/cache", () => {
    // The numbers mirror a real rollout: consecutive total_token_usage snapshots whose
    // deltas equal the rollout's own last_token_usage blocks.
    const jsonl = [
      meta("/work/proj", "main"),
      turnCtx("gpt-5.6-sol"),
      tokenCount("2026-07-25T11:30:25.170Z", {
        input: 18873,
        cached: 6912,
        output: 415,
      }),
      tokenCount("2026-07-25T11:30:36.253Z", {
        input: 40605,
        cached: 25088,
        output: 776,
      }),
    ].join("\n");
    const turns = extractCodexTurns(jsonl, "s1");
    expect(turns).toHaveLength(2);
    // first snapshot diffs against zero
    expect(turns[0]).toMatchObject({
      messageId: "s1#2",
      sessionId: "s1",
      modelRaw: "gpt-5.6-sol",
      cwd: "/work/proj",
      project: "proj",
      branch: "main",
      ts: Date.parse("2026-07-25T11:30:25.170Z"),
      usage: {
        inputTokens: 18873 - 6912,
        outputTokens: 415,
        cacheReadTokens: 6912,
        cacheCreationTokens: 0,
        cacheCreation5mTokens: 0,
        cacheCreation1hTokens: 0,
      },
    });
    // second diffs against the first (matches the rollout's own last_token_usage)
    expect(turns[1].usage).toEqual({
      inputTokens: 21732 - 18176,
      outputTokens: 361,
      cacheReadTokens: 18176,
      cacheCreationTokens: 0,
      cacheCreation5mTokens: 0,
      cacheCreation1hTokens: 0,
    });
  });

  it("maps cache_write_input_tokens into the all-5m creation split", () => {
    const jsonl = [
      meta("/work/proj"),
      turnCtx("gpt-5.5"),
      tokenCount("2026-07-25T11:30:25.170Z", {
        input: 100,
        cached: 0,
        output: 10,
        cacheWrite: 40,
      }),
    ].join("\n");
    const [t] = extractCodexTurns(jsonl, "s1");
    expect(t.usage.cacheCreationTokens).toBe(40);
    expect(t.usage.cacheCreation5mTokens).toBe(40);
    expect(t.usage.cacheCreation1hTokens).toBe(0);
  });

  it("re-baselines on a cumulative reset instead of emitting negative usage", () => {
    const jsonl = [
      meta("/work/proj"),
      turnCtx("gpt-5.5"),
      tokenCount("2026-07-25T11:30:25.170Z", {
        input: 1000,
        cached: 400,
        output: 50,
      }),
      // totals shrank: the counter reset (new thread) — this snapshot IS the new baseline
      tokenCount("2026-07-25T11:31:00.000Z", {
        input: 300,
        cached: 100,
        output: 20,
      }),
    ].join("\n");
    const turns = extractCodexTurns(jsonl, "s1");
    expect(turns[1].usage).toMatchObject({
      inputTokens: 200,
      cacheReadTokens: 100,
      outputTokens: 20,
    });
  });

  it("attributes each snapshot to the newest turn_context model", () => {
    const jsonl = [
      meta("/work/proj"),
      turnCtx("gpt-5.5"),
      tokenCount("2026-07-25T11:30:25.170Z", {
        input: 10,
        cached: 0,
        output: 1,
      }),
      turnCtx("gpt-5.6-sol"),
      tokenCount("2026-07-25T11:31:25.170Z", {
        input: 20,
        cached: 0,
        output: 2,
      }),
    ].join("\n");
    const turns = extractCodexTurns(jsonl, "s1");
    expect(turns[0].modelRaw).toBe("gpt-5.5");
    expect(turns[1].modelRaw).toBe("gpt-5.6-sol");
  });

  it("attributes pre-context snapshots to the file's first declared model", () => {
    // Codex Desktop subagent threads stream token_counts from line ~9 while the first
    // turn_context lands hundreds of lines later — the model is declared in-file, just late.
    const jsonl = [
      meta("/work/proj"),
      tokenCount("2026-07-26T13:30:20.000Z", {
        input: 10,
        cached: 0,
        output: 1,
      }),
      tokenCount("2026-07-26T13:30:25.000Z", {
        input: 30,
        cached: 0,
        output: 3,
      }),
      turnCtx("gpt-5.6-sol"),
      tokenCount("2026-07-26T13:31:25.000Z", {
        input: 60,
        cached: 0,
        output: 6,
      }),
    ].join("\n");
    const turns = extractCodexTurns(jsonl, "s1");
    expect(turns.map((t) => t.modelRaw)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-sol",
      "gpt-5.6-sol",
    ]);
  });

  it("a rollout with no turn_context anywhere stays honestly unattributed", () => {
    const jsonl = [
      meta("/work/proj"),
      tokenCount("2026-07-26T13:30:20.000Z", {
        input: 10,
        cached: 0,
        output: 1,
      }),
    ].join("\n");
    expect(extractCodexTurns(jsonl, "s1")[0].modelRaw).toBeUndefined();
  });

  it("skips null-info samples, zero deltas, malformed lines, and stamps ts=0 when unparseable", () => {
    const dup = tokenCount("2026-07-25T11:30:25.170Z", {
      input: 10,
      cached: 0,
      output: 1,
    });
    const jsonl = [
      meta("/work/proj"),
      turnCtx("gpt-5.5"),
      "not json {{{",
      tokenCount("2026-07-25T11:30:20.000Z", null), // rate-limit-only sample
      dup,
      dup, // identical snapshot: zero delta — no turn
      tokenCount("2026-07-25T11:31:25.170Z", {
        input: 30,
        cached: 0,
        output: 3,
      }).replace(
        '"timestamp":"2026-07-25T11:31:25.170Z"',
        '"timestamp":"nope"',
      ),
    ].join("\n");
    const turns = extractCodexTurns(jsonl, "s1");
    expect(turns).toHaveLength(2);
    expect(turns[0].usage.inputTokens).toBe(10);
    expect(turns[1].ts).toBe(0);
    expect(turns[1].usage.inputTokens).toBe(20);
  });

  it("windowed extraction emits identical rows to a whole-file parse", () => {
    const lines = [
      meta("/work/proj", "main"),
      turnCtx("gpt-5.5"),
      tokenCount("2026-07-25T11:30:25.170Z", {
        input: 100,
        cached: 40,
        output: 5,
      }),
      turnCtx("gpt-5.6-sol"),
      tokenCount("2026-07-25T11:31:25.170Z", {
        input: 220,
        cached: 90,
        output: 12,
      }),
      tokenCount("2026-07-25T11:32:25.170Z", {
        input: 300,
        cached: 90,
        output: 20,
      }),
    ];
    const jsonl = lines.join("\n");
    const whole = extractCodexTurns(jsonl, "s1", "kp");
    expect(whole).toHaveLength(3);
    // an incremental step that starts at line 4 must produce the same tail rows —
    // same keys, same deltas — as the whole-file parse did for those lines
    const tail = extractCodexTurns(jsonl, "s1", "kp", 4, 2);
    expect(tail).toEqual(whole.slice(1));
    expect(tail[0].messageId).toBe("kp#4");
    // and a bounded take stops emission mid-file
    const head = extractCodexTurns(jsonl, "s1", "kp", 0, 3);
    expect(head).toEqual(whole.slice(0, 1));
  });
});
