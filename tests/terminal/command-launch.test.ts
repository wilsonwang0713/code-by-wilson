import { describe, it, expect } from "vitest";
import { launchForm } from "../../src/main/terminal/command";

describe("launchForm", () => {
  it("passes an .exe through unchanged", () => {
    const c = { file: "C:\\bin\\claude.exe", args: ["--session-id", "x"] };
    expect(launchForm(c, "win32")).toEqual(c);
  });
  it("wraps a .cmd via cmd.exe /c on win32", () => {
    const c = { file: "C:\\npm\\claude.cmd", args: ["--resume", "x"] };
    expect(launchForm(c, "win32")).toEqual({
      file: "cmd.exe",
      args: ["/c", "C:\\npm\\claude.cmd", "--resume", "x"],
    });
  });
  it("wraps a .ps1 via powershell on win32", () => {
    const c = { file: "C:\\bin\\claude.ps1", args: ["--session-id", "x"] };
    expect(launchForm(c, "win32")).toEqual({
      file: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "C:\\bin\\claude.ps1",
        "--session-id",
        "x",
      ],
    });
  });
  it("passes through unchanged on posix", () => {
    const c = { file: "claude", args: ["--model", "opus"] };
    expect(launchForm(c, "darwin")).toEqual(c);
  });
});
