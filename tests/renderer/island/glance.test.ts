import { describe, it, expect } from "vitest";
import { deriveGlance } from "../../../src/renderer/src/island/glance";
import type { GlanceCandidate } from "../../../src/renderer/src/island/glance";

const s = (state: GlanceCandidate["state"]): GlanceCandidate => ({ state });

describe("deriveGlance", () => {
  it("shows the empty state when there are no sessions", () => {
    const g = deriveGlance([]);
    expect(g.total).toBe(0);
    expect(g.waiting).toBe(0);
    expect(g.label).toBe("No sessions");
    expect(g.hasAttention).toBe(false);
  });

  it("treats an all-ended list as empty (N counts non-ended only)", () => {
    const g = deriveGlance([s("ended"), s("ended")]);
    expect(g.total).toBe(0);
    expect(g.label).toBe("No sessions");
  });

  it("singularizes one session", () => {
    const g = deriveGlance([s("working")]);
    expect(g.label).toBe("1 session · 0 waiting");
    expect(g.hasAttention).toBe(false);
  });

  it("counts waiting sessions and raises the attention flag", () => {
    const g = deriveGlance([
      s("working"),
      s("waiting"),
      s("waiting"),
      s("idle"),
    ]);
    expect(g.total).toBe(4);
    expect(g.waiting).toBe(2);
    expect(g.label).toBe("4 sessions · 2 waiting");
    expect(g.hasAttention).toBe(true);
  });

  it("excludes ended sessions from both counts", () => {
    const g = deriveGlance([s("waiting"), s("ended")]);
    expect(g.label).toBe("1 session · 1 waiting");
  });
});
