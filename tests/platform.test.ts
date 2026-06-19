import { describe, it, expect } from "vitest";
import { isMacPlatform, toPosixPath } from "../src/shared/platform";

describe("isMacPlatform", () => {
  it("is true only for darwin", () => {
    expect(isMacPlatform("darwin")).toBe(true);
    expect(isMacPlatform("win32")).toBe(false);
    expect(isMacPlatform("linux")).toBe(false);
    expect(isMacPlatform("")).toBe(false);
  });
});

describe("toPosixPath", () => {
  it("rewrites backslashes to forward slashes", () => {
    expect(toPosixPath("C:\\Users\\me\\AppData\\Roaming\\npm")).toBe(
      "C:/Users/me/AppData/Roaming/npm",
    );
  });
  it("leaves a posix path unchanged", () => {
    expect(toPosixPath("/usr/local/bin/claude")).toBe("/usr/local/bin/claude");
  });
});
