// tests/renderer/shell-view.test.ts
import { describe, it, expect } from "vitest";
import {
  shellGlyph,
  truncLabel,
  ansiClass,
} from "../../src/renderer/src/workspace/panels/shell-view";

describe("shellGlyph", () => {
  it("running is a teal dot", () => {
    expect(shellGlyph({ status: "running" })).toEqual({
      char: "●",
      tone: "text-working-bright",
    });
  });
  it("completed with exit 0 is a green check", () => {
    expect(shellGlyph({ status: "completed", exitCode: 0 })).toEqual({
      char: "✓",
      tone: "text-ok",
    });
  });
  it("completed with a non-zero exit is a red cross", () => {
    expect(shellGlyph({ status: "completed", exitCode: 1 })).toEqual({
      char: "✕",
      tone: "text-danger",
    });
  });
  it("killed is a grey square", () => {
    expect(shellGlyph({ status: "killed" })).toEqual({
      char: "■",
      tone: "text-fg-faint",
    });
  });
});

describe("truncLabel", () => {
  it("is empty when nothing was dropped", () => {
    expect(truncLabel(0)).toBe("");
  });
  it("reports dropped KB", () => {
    expect(truncLabel(262144)).toBe("256 KB of earlier output hidden");
  });
});

describe("ansiClass", () => {
  it("maps base colors to cbw tokens", () => {
    expect(ansiClass("red")).toBe("text-danger");
    expect(ansiClass("green")).toBe("text-ok");
  });
  it("uses the bright token when available", () => {
    expect(ansiClass("green", true)).toBe("text-working-bright");
  });
});
