import { describe, it, expect } from "vitest";
import { gearBadge } from "../../src/renderer/src/ui/gear-badge";

describe("gearBadge", () => {
  it("cli error outranks any update", () => {
    expect(gearBadge("error", "downloaded")).toEqual({ kind: "cli-error" });
  });
  it("cli warn outranks an update", () => {
    expect(gearBadge("warn", "available")).toEqual({ kind: "cli-warn" });
  });
  it("downloaded shows the ready badge when cli is ok", () => {
    expect(gearBadge("ok", "downloaded")).toEqual({ kind: "update-ready" });
  });
  it("available shows the update badge", () => {
    expect(gearBadge("ok", "available")).toEqual({ kind: "update-available" });
  });
  it("downloading shows the update badge", () => {
    expect(gearBadge("ok", "downloading")).toEqual({
      kind: "update-available",
    });
  });
  it("idle cli (pre-check) still shows an available update", () => {
    expect(gearBadge("idle", "available")).toEqual({
      kind: "update-available",
    });
  });
  it("shows nothing when there is nothing to act on", () => {
    expect(gearBadge("ok", "upToDate")).toBeNull();
    expect(gearBadge("ok", "idle")).toBeNull();
    expect(gearBadge("ok", "checking")).toBeNull();
    expect(gearBadge("ok", "unsupported")).toBeNull();
  });
});
