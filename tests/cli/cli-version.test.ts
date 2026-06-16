import { describe, it, expect } from "vitest";
import { parseSemver, compareSemver } from "../../src/main/cli-version";

describe("parseSemver", () => {
  it("extracts the first x.y.z from any surrounding text", () => {
    expect(parseSemver("2.1.178")).toEqual({ major: 2, minor: 1, patch: 178 });
    expect(parseSemver("2.1.178 (Claude Code)")).toEqual({
      major: 2,
      minor: 1,
      patch: 178,
    });
    expect(parseSemver("v1.9.0\n")).toEqual({ major: 1, minor: 9, patch: 0 });
  });
  it("returns null when there is no semver", () => {
    expect(parseSemver("not a version")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("compareSemver", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver("2.1.0", "2.0.9")).toBe(1);
    expect(compareSemver("1.9.9", "2.0.0")).toBe(-1);
    expect(compareSemver("2.1.5", "2.1.10")).toBe(-1);
  });
  it("treats an unparsable left side as lower", () => {
    expect(compareSemver("garbage", "2.0.0")).toBe(-1);
  });
});
