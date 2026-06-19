import { describe, it, expect } from "vitest";
import {
  wrapperScriptWin,
  recoverWrappedCommandWin,
} from "../../src/main/settings/wrapper-win";

describe("wrapperScriptWin", () => {
  it("captures and bakes the wrapped command for round-trip", () => {
    const src = wrapperScriptWin({ wrappedCommand: "my-statusline --json" });
    expect(src).toContain("statusline"); // writes to the capture dir
    expect(recoverWrappedCommandWin(src)).toBe("my-statusline --json");
  });

  it("recovers null for a capture-only wrapper", () => {
    const src = wrapperScriptWin({ wrappedCommand: null });
    expect(recoverWrappedCommandWin(src)).toBeNull();
  });
});

describe("wrapperScriptWin (pure source)", () => {
  it("includes session_id extraction and the capture dir reference", () => {
    const src = wrapperScriptWin({ wrappedCommand: null });
    expect(src).toContain("session_id"); // extracts the id
    expect(src).toContain("statusline"); // capture dir
    expect(src).toContain("PSScriptRoot"); // self-locates (no baked path)
    expect(src).toContain("notmatch"); // rejects traversal ids
  });

  it("includes the call-through when a wrapped command is given", () => {
    const src = wrapperScriptWin({ wrappedCommand: "my-prompt --color" });
    expect(src).toContain("my-prompt --color");
    expect(src).toContain("cmd /c");
  });

  it("omits the call-through when there was no original statusLine", () => {
    const src = wrapperScriptWin({ wrappedCommand: null });
    expect(src).not.toContain("cmd /c");
    expect(src).not.toContain("my-prompt");
  });
});

describe("recoverWrappedCommandWin (exact inverse of the bake)", () => {
  it("round-trips a plain command verbatim", () => {
    const cmd = "npx ccusage statusline";
    expect(recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd }))).toBe(cmd);
  });

  it("round-trips a command with special characters", () => {
    const cmd = "my-prompt --flag=value --other";
    expect(recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd }))).toBe(cmd);
  });

  it("returns null for a capture-only wrapper (no original command)", () => {
    expect(
      recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: null })),
    ).toBeNull();
  });

  it("returns null for unrecognized text rather than guessing", () => {
    expect(recoverWrappedCommandWin("not a wrapper")).toBeNull();
  });
});
