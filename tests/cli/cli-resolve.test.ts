import { describe, it, expect } from "vitest";
import { pickBinary, installMethodForPath } from "../../src/main/cli-resolve";

const isFile = (p: string) => p.startsWith("/real/");

describe("pickBinary", () => {
  it("prefers a persisted override that exists", () => {
    const r = pickBinary({
      overridePath: "/real/override/claude",
      envBin: "/real/env/claude",
      shellPath: "/real/shell/claude",
      shellDuplicates: ["/real/shell/claude"],
      fallbackPath: "/real/fallback/claude",
      isFile,
    });
    expect(r).toMatchObject({
      path: "/real/override/claude",
      source: "override",
      isRegularFile: true,
    });
  });
  it("skips an override that doesn't exist and falls to the env bin", () => {
    const r = pickBinary({
      overridePath: "/missing/claude",
      envBin: "/real/env/claude",
      shellPath: null,
      shellDuplicates: [],
      fallbackPath: null,
      isFile,
    });
    expect(r.source).toBe("env");
  });
  it("uses the shell-resolved path when no override/env", () => {
    const r = pickBinary({
      overridePath: null,
      envBin: undefined,
      shellPath: "/real/shell/claude",
      shellDuplicates: ["/real/shell/claude", "/real/other/claude"],
      fallbackPath: null,
      isFile,
    });
    expect(r).toMatchObject({ path: "/real/shell/claude", source: "shell" });
    expect(r.duplicates).toHaveLength(2);
  });
  it("reports isRegularFile=false for an alias/function (shell path is not a file)", () => {
    const r = pickBinary({
      overridePath: null,
      envBin: undefined,
      shellPath: "claude: aliased to ...",
      shellDuplicates: ["claude: aliased to ..."],
      fallbackPath: null,
      isFile,
    });
    expect(r.isRegularFile).toBe(false);
  });
  it("a real fallback binary beats a shell alias/function (no false notFound)", () => {
    const r = pickBinary({
      overridePath: null,
      envBin: undefined,
      shellPath: "claude: aliased to ...", // not a file
      shellDuplicates: ["claude: aliased to ..."],
      fallbackPath: "/real/fallback/claude", // a genuine binary on PATH
      isFile,
    });
    expect(r).toMatchObject({
      path: "/real/fallback/claude",
      source: "fallback",
      isRegularFile: true,
    });
  });
  it("returns a null path when nothing resolves", () => {
    const r = pickBinary({
      overridePath: null,
      envBin: undefined,
      shellPath: null,
      shellDuplicates: [],
      fallbackPath: null,
      isFile,
    });
    expect(r).toMatchObject({ path: null, source: null, isRegularFile: false });
  });
});

describe("installMethodForPath", () => {
  it("maps known locations to methods", () => {
    expect(installMethodForPath("/Users/me/.local/bin/claude")).toBe("native");
    expect(installMethodForPath("/opt/homebrew/bin/claude")).toBe("homebrew");
    expect(
      installMethodForPath("/Users/me/.nvm/versions/node/v22/bin/claude"),
    ).toBe("npm");
    expect(installMethodForPath("/weird/place/claude")).toBe("unknown");
    expect(installMethodForPath(null)).toBe("unknown");
  });
});
