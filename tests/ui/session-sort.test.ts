import { describe, it, expect } from "vitest";
import type { StatsBySession } from "@shared/stats";
import {
  sortSessions,
  defaultDirFor,
  DEFAULT_SESSION_SORT,
} from "../../src/renderer/src/stats/session-sort";

const row = (over: Partial<StatsBySession> = {}): StatsBySession => ({
  sessionId: "s",
  cwd: "/w/proj",
  project: "proj",
  modelRaw: "claude-opus-4-8",
  lastActivityMs: 0,
  durationMs: 0,
  turns: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  title: null,
  ...over,
});

describe("sortSessions", () => {
  it("defaults to most recent activity first", () => {
    expect(DEFAULT_SESSION_SORT).toEqual({ key: "lastActivity", dir: "desc" });
    const rows = [
      row({ sessionId: "old", lastActivityMs: 1000 }),
      row({ sessionId: "new", lastActivityMs: 9000 }),
    ];
    expect(
      sortSessions(rows, DEFAULT_SESSION_SORT).map((r) => r.sessionId),
    ).toEqual(["new", "old"]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row({ sessionId: "a", lastActivityMs: 1 }),
      row({ sessionId: "b", lastActivityMs: 2 }),
    ];
    const before = rows.map((r) => r.sessionId);
    sortSessions(rows, { key: "lastActivity", dir: "asc" });
    expect(rows.map((r) => r.sessionId)).toEqual(before);
  });

  it("sorts ascending and descending by a numeric column", () => {
    const rows = [
      row({ sessionId: "a", durationMs: 100 }),
      row({ sessionId: "b", durationMs: 300 }),
      row({ sessionId: "c", durationMs: 200 }),
    ];
    expect(
      sortSessions(rows, { key: "duration", dir: "desc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["b", "c", "a"]);
    expect(
      sortSessions(rows, { key: "duration", dir: "asc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["a", "c", "b"]);
  });

  it("sorts the tokens column by totalTokens, matching the visible figure", () => {
    // Ids chosen so the sessionId tie-break (ascending) would give the OPPOSITE order: the test
    // fails unless totalTokens actually drives the comparison.
    const rows = [
      row({ sessionId: "a", totalTokens: 500 }),
      row({ sessionId: "z", totalTokens: 9000 }),
    ];
    expect(
      sortSessions(rows, { key: "tokens", dir: "desc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["z", "a"]);
  });

  it("breaks ties by session id, stable across a direction flip", () => {
    const rows = [
      row({ sessionId: "b", lastActivityMs: 5000 }),
      row({ sessionId: "a", lastActivityMs: 5000 }),
    ];
    // Equal keys → session id ascending in both directions (a before b).
    expect(
      sortSessions(rows, { key: "lastActivity", dir: "desc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["a", "b"]);
    expect(
      sortSessions(rows, { key: "lastActivity", dir: "asc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["a", "b"]);
  });

  it("sorts by the model column", () => {
    const rows = [
      row({ sessionId: "1", modelRaw: "claude-sonnet-4-6" }),
      row({ sessionId: "2", modelRaw: "claude-opus-4-8" }),
    ];
    expect(
      sortSessions(rows, { key: "model", dir: "asc" }).map((r) => r.modelRaw),
    ).toEqual(["claude-opus-4-8", "claude-sonnet-4-6"]);
  });

  it("sorts by the turns column", () => {
    const rows = [
      row({ sessionId: "a", turns: 3 }),
      row({ sessionId: "b", turns: 30 }),
      row({ sessionId: "c", turns: 12 }),
    ];
    expect(
      sortSessions(rows, { key: "turns", dir: "desc" }).map((r) => r.sessionId),
    ).toEqual(["b", "c", "a"]);
  });

  it("sorts the Session column by the effective name (title, else project)", () => {
    const rows = [
      row({ sessionId: "1", title: "Zebra task", project: "z-proj" }),
      row({ sessionId: "2", title: null, project: "apple" }), // falls back to project
    ];
    expect(
      sortSessions(rows, { key: "session", dir: "asc" }).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["2", "1"]); // "apple" < "Zebra task"
  });
});

describe("defaultDirFor", () => {
  it("starts text columns ascending and numeric/time columns descending", () => {
    expect(defaultDirFor("session")).toBe("asc");
    expect(defaultDirFor("model")).toBe("asc");
    expect(defaultDirFor("lastActivity")).toBe("desc");
    expect(defaultDirFor("duration")).toBe("desc");
    expect(defaultDirFor("turns")).toBe("desc");
    expect(defaultDirFor("tokens")).toBe("desc");
  });
});
