import { describe, it, expect } from "vitest";
import { wantsConpty } from "../../src/main/terminal/conpty";

describe("wantsConpty", () => {
  it("enables ConPTY on a current Windows 11 build", () => {
    expect(wantsConpty("win32", "10.0.22631")).toBe(true);
  });
  it("enables ConPTY exactly at the 18309 floor", () => {
    expect(wantsConpty("win32", "10.0.18309")).toBe(true);
  });
  it("falls back to winpty just below the floor", () => {
    expect(wantsConpty("win32", "10.0.18308")).toBe(false);
  });
  it("is false off Windows", () => {
    expect(wantsConpty("darwin", "23.6.0")).toBe(false);
    expect(wantsConpty("linux", "6.1.0")).toBe(false);
  });
  it("is false when the build number is unparseable", () => {
    expect(wantsConpty("win32", "10.0")).toBe(false);
  });
});
