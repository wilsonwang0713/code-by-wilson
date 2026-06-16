import { describe, it, expect } from "vitest";
import { footerView } from "../../src/renderer/src/ui/rail-footer";
import type { CliStatus } from "../../src/shared/cli-status";

const ready: CliStatus = {
  kind: "ready",
  version: "2.1.178",
  path: "/Users/me/.local/bin/claude",
  source: "shell",
  floor: "2.0.0",
  installMethod: "native",
  duplicates: [],
  detail: "ready",
  configDir: { active: "/Users/me/.claude", recovered: null, mismatch: false },
  checkedAt: 1,
};

describe("footerView", () => {
  it("green + no troubleshoot when ready", () => {
    const v = footerView(ready);
    expect(v.dot).toBe("ok");
    expect(v.showTroubleshoot).toBe(false);
    expect(v.version).toBe("2.1.178");
    expect(v.detail).toBeNull(); // ready's detail would just restate the label
  });
  it("red + troubleshoot when not found", () => {
    const v = footerView({
      ...ready,
      kind: "notFound",
      version: null,
      detail: "not on PATH",
    });
    expect(v.dot).toBe("error");
    expect(v.showTroubleshoot).toBe(true);
  });
  it("amber + troubleshoot when outdated", () => {
    const v = footerView({
      ...ready,
      kind: "outdated",
      version: "1.9.0",
      detail: "needs ≥ 2.0.0",
    });
    expect(v.dot).toBe("warn");
    expect(v.showTroubleshoot).toBe(true);
    expect(v.detail).toBe("needs ≥ 2.0.0"); // remedy hint surfaces in the footer
  });
  it("renders a checking placeholder when status is null", () => {
    expect(footerView(null).statusLabel).toBe("checking…");
  });
});
