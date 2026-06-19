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
    expect(src).toContain("cmd.exe /c");
  });

  it("reads stdin and pipes the call-through as UTF-8, not the host code page", () => {
    // Windows PowerShell's default $OutputEncoding is US-ASCII, which turns every non-ASCII byte in the
    // piped JSON (e.g. a cwd under C:\Users\José) into '?'. The wrapper must read stdin as UTF-8 and set
    // $OutputEncoding to UTF-8 so a non-ASCII cwd/path round-trips to the wrapped command intact, matching
    // the POSIX wrapper's byte-exact replay.
    const src = wrapperScriptWin({ wrappedCommand: "my-prompt" });
    expect(src).toContain("$OutputEncoding"); // pins the call-through pipe encoding
    expect(src).toContain("UTF8Encoding"); // ...to UTF-8
    expect(src).toContain("OpenStandardInput"); // reads raw stdin as UTF-8, not the console code page
    expect(src).not.toContain("[Console]::In.ReadToEnd()"); // the code-page-dependent read is gone
  });

  it("ends with an explicit exit 0 so a faulty wrapped command can never fail the prompt", () => {
    // ADR-0001: a blank statusLine is the worst case, never a stalled/failed prompt. The POSIX wrapper
    // enforces this with `exit 0`; the Windows port must too, so the guarantee doesn't rely on the
    // `powershell -File` invocation happening not to propagate $LASTEXITCODE.
    expect(wrapperScriptWin({ wrappedCommand: "my-prompt" }).trimEnd()).toMatch(
      /exit 0$/,
    );
    expect(wrapperScriptWin({ wrappedCommand: null }).trimEnd()).toMatch(
      /exit 0$/,
    );
  });

  it("omits the call-through when there was no original statusLine", () => {
    const src = wrapperScriptWin({ wrappedCommand: null });
    expect(src).not.toContain("cmd.exe /c");
    expect(src).not.toContain("my-prompt");
  });

  it("bakes the command in a single-quoted here-string so PowerShell cannot interpolate it", () => {
    const cmd = "status --home $env:USERPROFILE";
    const src = wrapperScriptWin({ wrappedCommand: cmd });
    // A single-quoted here-string @'...'@ is fully literal: no $-expansion, no escaping.
    expect(src).toContain("@'\n");
    expect(src).toContain("\n'@");
    // The command appears verbatim — not JSON-escaped into a $-interpolating double-quoted string.
    expect(src).toContain(cmd);
    expect(src).not.toContain('cmd /c "'); // not the old double-quoted JSON.stringify form
  });
});

describe("recoverWrappedCommandWin (exact inverse of the bake)", () => {
  it("round-trips a plain command verbatim", () => {
    const cmd = "npx ccusage statusline";
    expect(
      recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd })),
    ).toBe(cmd);
  });

  it("round-trips a command with special characters", () => {
    const cmd = "my-prompt --flag=value --other";
    expect(
      recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd })),
    ).toBe(cmd);
  });

  it("round-trips a multi-line command the first-line approach would have truncated", () => {
    const cmd = "first-line --a\nsecond-line --b\nthird";
    expect(
      recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd })),
    ).toBe(cmd);
  });

  it("round-trips a command containing PowerShell metacharacters verbatim", () => {
    const cmd = "status --home $env:USERPROFILE --tick `n --q \"x\" 'y'";
    expect(
      recoverWrappedCommandWin(wrapperScriptWin({ wrappedCommand: cmd })),
    ).toBe(cmd);
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
