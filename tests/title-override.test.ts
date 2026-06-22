import { describe, it, expect } from "vitest";
import type { Session } from "@shared/types";
import { applyTitleOverrides } from "@shared/title-override";

// The function only reads `id` and `title` and spreads the rest, so a minimal cast is enough here.
const session = (id: string, title: string): Session =>
  ({ id, title }) as Session;

describe("applyTitleOverrides", () => {
  it("replaces the title of a session that has an override", () => {
    const out = applyTitleOverrides([session("a", "derived")], {
      a: "Renamed",
    });
    expect(out[0].title).toBe("Renamed");
  });
  it("leaves a session without an override untouched (same reference)", () => {
    const a = session("a", "derived");
    const out = applyTitleOverrides([a], { b: "Other" });
    expect(out[0]).toBe(a);
  });
  it("applies overrides per id across a mixed list", () => {
    const out = applyTitleOverrides(
      [session("a", "da"), session("b", "db"), session("c", "dc")],
      { a: "A!", c: "C!" },
    );
    expect(out.map((s) => s.title)).toEqual(["A!", "db", "C!"]);
  });
  it("returns an empty list unchanged", () => {
    expect(applyTitleOverrides([], { a: "x" })).toEqual([]);
  });
});
