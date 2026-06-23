import { describe, it, expect } from "vitest";
import { toolIcon } from "../../src/renderer/src/workspace/tool-icon";

describe("toolIcon", () => {
  it("maps known tools to their glyph", () => {
    expect(toolIcon("Bash")).toBe("terminal");
    expect(toolIcon("Read")).toBe("code");
    expect(toolIcon("Grep")).toBe("search");
    expect(toolIcon("WebFetch")).toBe("globe");
  });
  it("maps edit tools to the pencil glyph", () => {
    expect(toolIcon("Edit")).toBe("pencil");
    expect(toolIcon("Write")).toBe("pencil");
    expect(toolIcon("MultiEdit")).toBe("pencil");
  });
  it("falls back to terminal for an unknown tool", () => {
    expect(toolIcon("Frobnicate")).toBe("terminal");
  });
});
