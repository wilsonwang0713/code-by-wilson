import { describe, it, expect } from "vitest";
import {
  remediesFor,
  INSTALL_TABS,
} from "../../src/renderer/src/ui/cli-remedies";

describe("remediesFor", () => {
  it("install guidance for notFound, defaulting to the detected install method", () => {
    const r = remediesFor({ kind: "notFound", installMethod: "homebrew" });
    expect(r.section).toBe("install");
    expect(r.defaultTab).toBe("homebrew");
  });
  it("the matching upgrade command for outdated by install method", () => {
    expect(
      remediesFor({ kind: "outdated", installMethod: "native" }).command,
    ).toBe("claude update");
    expect(
      remediesFor({ kind: "outdated", installMethod: "homebrew" }).command,
    ).toBe("brew upgrade claude-code");
    expect(
      remediesFor({ kind: "outdated", installMethod: "npm" }).command,
    ).toBe("npm install -g @anthropic-ai/claude-code@latest");
  });
  it("login guidance for loggedOut", () => {
    expect(
      remediesFor({ kind: "loggedOut", installMethod: "native" }).section,
    ).toBe("login");
  });
  it("manual-verify guidance for unknown", () => {
    expect(
      remediesFor({ kind: "unknown", installMethod: "unknown" }).section,
    ).toBe("verify");
  });
  it("exposes the three install tabs with copyable commands", () => {
    expect(INSTALL_TABS.map((t) => t.method)).toEqual([
      "native",
      "homebrew",
      "npm",
    ]);
    expect(INSTALL_TABS[0].command).toContain("install.sh");
  });
});
