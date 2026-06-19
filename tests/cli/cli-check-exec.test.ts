import { describe, it, expect } from "vitest";
import { execOptionsForBinary } from "../../src/main/cli-check";

describe("execOptionsForBinary", () => {
  it("uses shell on win32 for a .cmd shim", () => {
    expect(execOptionsForBinary("C:\\npm\\claude.cmd", "win32")).toEqual({
      shell: true,
    });
  });
  it("does not use shell for a win32 .exe", () => {
    expect(execOptionsForBinary("C:\\bin\\claude.exe", "win32")).toEqual({
      shell: false,
    });
  });
  it("never uses shell on posix", () => {
    expect(execOptionsForBinary("/usr/bin/claude", "darwin")).toEqual({
      shell: false,
    });
  });
});
