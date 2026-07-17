import { describe, it, expect } from "vitest";
import {
  partitionInbox,
  RECENT_ENDED_MS,
  AWAITING_REASON,
  ENDED_REASON,
} from "../../../src/renderer/src/island/inbox";
import type { InboxCandidate } from "../../../src/renderer/src/island/inbox";

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
