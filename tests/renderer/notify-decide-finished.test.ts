import { describe, it, expect } from "vitest";
import {
  decideFinishedNotifications,
  FINISHED_BODY,
  type AwaitingCandidate,
  type DecideInput,
} from "../../src/renderer/src/notifications/decide";
import type { SessionState } from "../../src/shared/types";

function row(
  id: string,
  state: SessionState,
  title = `Title ${id}`,
  project = `proj-${id}`,
): AwaitingCandidate {
  return { id, state, title, project };
}

/** Baseline defaults: enabled, window unfocused, nothing selected — the pure transition case. */
function input(
  partial: Partial<DecideInput> & Pick<DecideInput, "prev" | "sessions">,
): DecideInput {
  return {
    enabled: true,
    windowFocused: false,
    selectedId: null,
    ...partial,
  };
}

describe("decideFinishedNotifications", () => {
  it("never notifies on the first poll (no baseline yet), but seeds one", () => {
    const r = decideFinishedNotifications(
      input({
        prev: null,
        sessions: [row("a", "ended"), row("b", "working")],
      }),
    );
    expect(r.notify).toEqual([]);
    expect(r.baseline.get("a")).toBe(true);
    expect(r.baseline.get("b")).toBe(false);
  });

  it("notifies on a false→true transition into ended with the title and finished body", () => {
    const prev = new Map([["a", false]]);
    const r = decideFinishedNotifications(
      input({ prev, sessions: [row("a", "ended", "Fix the tests")] }),
    );
    expect(r.notify).toEqual([
      { sessionId: "a", title: "Fix the tests", body: FINISHED_BODY },
    ]);
  });

  it("falls back to the project when the title is empty", () => {
    const prev = new Map([["a", false]]);
    const r = decideFinishedNotifications(
      input({ prev, sessions: [row("a", "ended", "", "my-project")] }),
    );
    expect(r.notify[0]?.title).toBe("my-project");
  });

  it("does not re-notify a session that stays ended", () => {
    const prev = new Map([["a", true]]);
    const r = decideFinishedNotifications(
      input({ prev, sessions: [row("a", "ended")] }),
    );
    expect(r.notify).toEqual([]);
    expect(r.baseline.get("a")).toBe(true);
  });

  it("re-arms after the session leaves ended: true→false→true fires again", () => {
    const p1 = decideFinishedNotifications(
      input({ prev: new Map([["a", true]]), sessions: [row("a", "working")] }),
    );
    expect(p1.notify).toEqual([]);
    expect(p1.baseline.get("a")).toBe(false);
    const p2 = decideFinishedNotifications(
      input({ prev: p1.baseline, sessions: [row("a", "ended")] }),
    );
    expect(p2.notify.map((n) => n.sessionId)).toEqual(["a"]);
  });

  it("suppresses when the window is focused AND that session is selected", () => {
    const prev = new Map([["a", false]]);
    const r = decideFinishedNotifications(
      input({
        prev,
        sessions: [row("a", "ended")],
        windowFocused: true,
        selectedId: "a",
      }),
    );
    expect(r.notify).toEqual([]);
    // The suppressed transition still lands in the baseline: blurring later must not re-fire it.
    expect(r.baseline.get("a")).toBe(true);
  });

  it("still notifies when focused but a different session is selected", () => {
    const prev = new Map([["a", false]]);
    const r = decideFinishedNotifications(
      input({
        prev,
        sessions: [row("a", "ended")],
        windowFocused: true,
        selectedId: "b",
      }),
    );
    expect(r.notify.map((n) => n.sessionId)).toEqual(["a"]);
  });

  it("does not notify for a session with no baseline entry (just appeared)", () => {
    const prev = new Map([["a", false]]);
    const r = decideFinishedNotifications(
      input({ prev, sessions: [row("a", "working"), row("new", "ended")] }),
    );
    expect(r.notify).toEqual([]);
    expect(r.baseline.get("new")).toBe(true);
  });

  it("setting off suppresses notifications but still advances the baseline", () => {
    const prev = new Map([["a", false]]);
    const off = decideFinishedNotifications(
      input({ prev, sessions: [row("a", "ended")], enabled: false }),
    );
    expect(off.notify).toEqual([]);
    expect(off.baseline.get("a")).toBe(true);
    // Re-enabling on the next poll must not fire the transition that happened while off.
    const on = decideFinishedNotifications(
      input({ prev: off.baseline, sessions: [row("a", "ended")] }),
    );
    expect(on.notify).toEqual([]);
  });

  it("treats non-ended states (waiting, idle, working) as not finished", () => {
    const prev = new Map([
      ["a", true],
      ["b", true],
      ["c", true],
    ]);
    const r = decideFinishedNotifications(
      input({
        prev,
        sessions: [row("a", "waiting"), row("b", "idle"), row("c", "working")],
      }),
    );
    expect(r.notify).toEqual([]);
    expect(r.baseline.get("a")).toBe(false);
    expect(r.baseline.get("b")).toBe(false);
    expect(r.baseline.get("c")).toBe(false);
  });

  it("handles multiple sessions independently in one poll", () => {
    const prev = new Map([
      ["a", false], // transitions into ended → notify
      ["b", true], // stays ended → no re-notify
      ["c", false], // stays working → nothing
    ]);
    const r = decideFinishedNotifications(
      input({
        prev,
        sessions: [row("a", "ended"), row("b", "ended"), row("c", "working")],
      }),
    );
    expect(r.notify.map((n) => n.sessionId)).toEqual(["a"]);
    expect(r.baseline).toEqual(
      new Map([
        ["a", true],
        ["b", true],
        ["c", false],
      ]),
    );
  });
});
