import { describe, it, expect } from "vitest";
import { toolIcon } from "../../src/renderer/src/workspace/tool-icon";

describe("toolIcon", () => {
  it("maps known tools to their glyph", () => {
    expect(toolIcon("Bash")).toBe("terminal");
    expect(toolIcon("Read")).toBe("code");
    expect(toolIcon("Grep")).toBe("search");
    expect(toolIcon("WebFetch")).toBe("globe");
  });
  it("falls back to terminal for an unknown tool", () => {
    expect(toolIcon("Frobnicate")).toBe("terminal");
  });
});
