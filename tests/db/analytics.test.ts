import { describe, it, expect } from "vitest";
import type { AnalyticsTurn } from "../../src/main/db/analytics";
import {
  migrateAnalytics,
  upsertTurns,
  readTotals,
  emptyTotals,
} from "../../src/main/db/analytics";
import { openTestDb } from "../helpers/sqlite";

const turn = (over: Partial<AnalyticsTurn> = {}): AnalyticsTurn => ({
  messageId: "msg-1",
  sessionId: "sess-1",
  ts: 1000,
  modelRaw: "claude-opus-4-8",
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  },
  cwd: "/work/code-by-wire",
  project: "code-by-wire",
  branch: "main",
  ...over,
});

describe("analytics store", () => {
  it("migrates to its own schema and is idempotent", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    migrateAnalytics(db); // second call is a no-op, not an error
    expect(
      (db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
    ).toBe(1);
  });

  it("is durable: re-running migrate preserves existing turns (never drops)", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    upsertTurns(db, [turn()]);
    migrateAnalytics(db); // a later schema bump must not wipe the historical store
    expect(readTotals(db).turns).toBe(1);
  });

  it("returns zeroed totals for an empty store", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    expect(readTotals(db)).toEqual(emptyTotals());
  });

  it("upserts by message_id rather than inserting duplicates (last-write-wins)", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    upsertTurns(db, [
      turn({
        usage: {
          inputTokens: 1,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
    ]);
    upsertTurns(db, [
      turn({
        usage: {
          inputTokens: 9,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
    ]);
    const t = readTotals(db);
    expect(t.turns).toBe(1);
    expect(t.inputTokens).toBe(9); // last write wins
  });

  it("counts distinct sessions, turns, and tokens by kind", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    upsertTurns(db, [
      turn({
        messageId: "a",
        sessionId: "s1",
        usage: {
          inputTokens: 100,
          outputTokens: 10,
          cacheReadTokens: 5,
          cacheCreationTokens: 2,
        },
      }),
      turn({
        messageId: "b",
        sessionId: "s1",
        usage: {
          inputTokens: 200,
          outputTokens: 20,
          cacheReadTokens: 5,
          cacheCreationTokens: 3,
        },
      }),
      turn({
        messageId: "c",
        sessionId: "s2",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
    ]);
    const t = readTotals(db);
    expect(t.sessions).toBe(2);
    expect(t.turns).toBe(3);
    expect(t.inputTokens).toBe(300);
    expect(t.outputTokens).toBe(30);
    expect(t.cacheReadTokens).toBe(10);
    expect(t.cacheCreationTokens).toBe(5);
  });

  it("computes Equivalent API value from family-substring pricing", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    // 1,000,000 input tokens on opus at $5/M = $5.00 exactly.
    upsertTurns(db, [
      turn({
        modelRaw: "claude-opus-4-8",
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
    ]);
    expect(readTotals(db).equivApiValueUsd).toBeCloseTo(5);
  });

  it("counts an unrecognized model's tokens but gives it n/a cost", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    upsertTurns(db, [
      turn({
        messageId: "known",
        modelRaw: "claude-sonnet-4-6",
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
      turn({
        messageId: "unknown",
        modelRaw: "gpt-9-ultra", // matches no family
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      }),
    ]);
    const t = readTotals(db);
    expect(t.turns).toBe(2);
    expect(t.inputTokens).toBe(2_000_000); // unknown model's tokens still counted
    expect(t.equivApiValueUsd).toBeCloseTo(3); // only sonnet ($3/M); the unknown adds nothing
  });
});
