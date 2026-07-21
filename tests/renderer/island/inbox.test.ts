import { describe, it, expect } from "vitest";
import {
  partitionInbox,
  applyDismissals,
  dismissalSignature,
  RECENT_ENDED_MS,
  AWAITING_REASON,
  ENDED_REASON,
} from "../../../src/renderer/src/island/inbox";
import type {
  InboxCandidate,
  InboxRow,
} from "../../../src/renderer/src/island/inbox";

const NOW = 1_000_000_000;

function row(
  over: Partial<InboxCandidate> & Pick<InboxCandidate, "id" | "state">,
): InboxCandidate {
  return {
    title: over.id,
    project: "proj",
    lastActivityMs: NOW,
    ...over,
  };
}

describe("partitionInbox", () => {
  it("puts waiting sessions in attention, oldest activity first", () => {
    const { attention } = partitionInbox(
      [
        row({ id: "b", state: "waiting", lastActivityMs: NOW - 1000 }),
        row({ id: "a", state: "waiting", lastActivityMs: NOW - 5000 }),
      ],
      NOW,
    );
    expect(attention.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("includes recently ended sessions in attention, drops stale ones", () => {
    const { attention } = partitionInbox(
      [
        row({
          id: "fresh",
          state: "ended",
          lastActivityMs: NOW - RECENT_ENDED_MS + 1,
        }),
        row({
          id: "stale",
          state: "ended",
          lastActivityMs: NOW - RECENT_ENDED_MS - 1,
        }),
      ],
      NOW,
    );
    expect(attention.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("labels reasons: waitingReason wins, then the awaiting fallback, ended reads Finished", () => {
    const { attention } = partitionInbox(
      [
        row({
          id: "w1",
          state: "waiting",
          waitingReason: "Permission needed",
          lastActivityMs: NOW - 3,
        }),
        row({ id: "w2", state: "waiting", lastActivityMs: NOW - 2 }),
        row({ id: "e", state: "ended", lastActivityMs: NOW - 1 }),
      ],
      NOW,
    );
    expect(attention.map((r) => r.reason)).toEqual([
      "Permission needed",
      AWAITING_REASON,
      ENDED_REASON,
    ]);
  });

  it("puts working and idle sessions in running, newest activity first", () => {
    const { running } = partitionInbox(
      [
        row({ id: "old", state: "idle", lastActivityMs: NOW - 9000 }),
        row({ id: "new", state: "working", lastActivityMs: NOW - 100 }),
      ],
      NOW,
    );
    expect(running.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("carries costUsd through to running rows, leaving it absent when unset", () => {
    const { running } = partitionInbox(
      [
        row({ id: "priced", state: "working", costUsd: 0.42 }),
        row({ id: "free", state: "idle" }),
      ],
      NOW,
    );
    const byId = new Map(running.map((r) => [r.id, r.costUsd]));
    expect(byId.get("priced")).toBe(0.42);
    expect(byId.get("free")).toBeUndefined();
  });

  it("never places a session in both sections", () => {
    const sessions = [
      row({ id: "w", state: "waiting" }),
      row({ id: "run", state: "working" }),
      row({ id: "e", state: "ended" }),
    ];
    const { attention, running } = partitionInbox(sessions, NOW);
    const ids = [...attention, ...running].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(running.map((r) => r.id)).toEqual(["run"]);
  });

  it("does not mutate the input list", () => {
    const sessions = [
      row({ id: "b", state: "waiting", lastActivityMs: NOW - 1 }),
      row({ id: "a", state: "waiting", lastActivityMs: NOW - 2 }),
    ];
    const snapshot = sessions.map((s) => s.id);
    partitionInbox(sessions, NOW);
    expect(sessions.map((s) => s.id)).toEqual(snapshot);
  });
});

function attentionRow(
  over: Partial<InboxRow> & Pick<InboxRow, "id" | "state">,
): InboxRow {
  return {
    title: over.id,
    project: "proj",
    lastActivityMs: NOW,
    reason: AWAITING_REASON,
    ...over,
  };
}

describe("applyDismissals", () => {
  it("hides a row whose current signature matches the dismissed one", () => {
    const rows = [
      attentionRow({ id: "a", state: "waiting" }),
      attentionRow({ id: "b", state: "waiting" }),
    ];
    const dismissed = new Map([["a", dismissalSignature(rows[0])]]);
    expect(applyDismissals(rows, dismissed).map((r) => r.id)).toEqual(["b"]);
  });

  it("re-surfaces a dismissed row once its state changes", () => {
    const waiting = attentionRow({ id: "a", state: "waiting" });
    const dismissed = new Map([["a", dismissalSignature(waiting)]]);
    // Answered then finished: same id, new state → signature no longer matches.
    const ended = attentionRow({ id: "a", state: "ended" });
    expect(applyDismissals([ended], dismissed).map((r) => r.id)).toEqual(["a"]);
  });

  it("re-surfaces a dismissed row on a fresh waiting episode (new activity)", () => {
    const firstWait = attentionRow({
      id: "a",
      state: "waiting",
      lastActivityMs: NOW - 5000,
    });
    const dismissed = new Map([["a", dismissalSignature(firstWait)]]);
    // Answered, worked, and re-entered waiting later — same state, newer lastActivityMs.
    const secondWait = attentionRow({
      id: "a",
      state: "waiting",
      lastActivityMs: NOW,
    });
    expect(applyDismissals([secondWait], dismissed).map((r) => r.id)).toEqual([
      "a",
    ]);
  });

  it("returns all rows when nothing is dismissed and never mutates input", () => {
    const rows = [
      attentionRow({ id: "a", state: "waiting" }),
      attentionRow({ id: "b", state: "ended" }),
    ];
    const snapshot = rows.map((r) => r.id);
    expect(applyDismissals(rows, new Map()).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
  });
});
