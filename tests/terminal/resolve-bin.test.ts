import { describe, it, expect } from "vitest";
import {
  binNotFoundMessage,
  pathFromEnv,
  resolveExecutable,
  spawnFailedMessage,
} from "../../src/main/terminal/resolve-bin";

/** Resolve with an injected set of "executable" paths, so no real filesystem is touched. */
function resolve(
  file: string,
  path: string,
  executables: string[],
  platform: NodeJS.Platform = "linux",
) {
  const set = new Set(executables);
  return resolveExecutable({
    file,
    path,
    platform,
    isExecutable: (p) => set.has(p),
  });
}

describe("resolveExecutable", () => {
  it("finds a bare name on the first PATH entry that holds it", () => {
    expect(
      resolve("claude", "/usr/bin:/home/u/.local/bin", [
        "/home/u/.local/bin/claude",
      ]),
    ).toBe("/home/u/.local/bin/claude");
  });

  it("returns null when the name is on no PATH entry", () => {
    expect(resolve("claude", "/usr/bin:/bin", [])).toBeNull();
  });

  it("skips empty PATH segments", () => {
    expect(resolve("claude", "::/opt/bin:", ["/opt/bin/claude"])).toBe(
      "/opt/bin/claude",
    );
  });

  it("checks an explicit path directly, ignoring PATH", () => {
    expect(resolve("/custom/claude", "/usr/bin", ["/custom/claude"])).toBe(
      "/custom/claude",
    );
    expect(resolve("/custom/claude", "/usr/bin", [])).toBeNull();
  });

  it("tries PATHEXT suffixes on Windows", () => {
    const hit = resolveExecutable({
      file: "claude",
      path: "C:\\bin",
      platform: "win32",
      pathExt: ".EXE;.CMD",
      isExecutable: (p) => p === "C:\\bin\\claude.CMD",
    });
    expect(hit).toBe("C:\\bin\\claude.CMD");
  });
});

describe("pathFromEnv", () => {
  it("returns PATH when present", () => {
    expect(pathFromEnv({ PATH: "/usr/bin" })).toBe("/usr/bin");
  });

  it("falls back to a differently-cased key (Windows `Path`)", () => {
    expect(pathFromEnv({ Path: "C:\\bin" })).toBe("C:\\bin");
  });

  it("returns empty string when no PATH-like key exists", () => {
    expect(pathFromEnv({ HOME: "/home/u" })).toBe("");
  });
});

describe("binNotFoundMessage", () => {
  it("lists the searched PATH dirs and the fixes for a bare name", () => {
    const msg = binNotFoundMessage("claude", "/usr/bin:/home/u/.local/bin");
    expect(msg).toContain("Could not start Claude Code");
    expect(msg).toContain("/usr/bin");
    expect(msg).toContain("/home/u/.local/bin");
    expect(msg).toContain("CBW_CLAUDE_BIN");
  });

  it("calls out a bad explicit override instead of listing PATH", () => {
    const msg = binNotFoundMessage("/bad/claude", "/usr/bin");
    expect(msg).toContain("/bad/claude");
    expect(msg).not.toContain("Searched these PATH locations");
  });
});

describe("spawnFailedMessage", () => {
  it("includes the underlying error message", () => {
    expect(spawnFailedMessage("claude", new Error("EACCES"))).toContain(
      "EACCES",
    );
  });
});
