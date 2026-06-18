import { describe, it, expect } from "vitest";
import { buildChildEnv } from "../../src/main/terminal/child-env";

describe("buildChildEnv", () => {
  it("pins CLAUDE_CONFIG_DIR to claudeDir, overriding any inherited value", () => {
    const env = buildChildEnv({
      baseEnv: { CLAUDE_CONFIG_DIR: "/old/.claude", FOO: "bar" },
      claudeDir: "/work/.claude",
      correctedPath: null,
    });
    expect(env.CLAUDE_CONFIG_DIR).toBe("/work/.claude");
  });

  it("overrides PATH when a corrected path is given (packaged)", () => {
    const env = buildChildEnv({
      baseEnv: { PATH: "/usr/bin:/bin" },
      claudeDir: "/c",
      correctedPath: "/opt/homebrew/bin:/usr/bin",
    });
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin");
  });

  it("leaves PATH untouched when correctedPath is null (dev)", () => {
    const env = buildChildEnv({
      baseEnv: { PATH: "/usr/bin:/bin" },
      claudeDir: "/c",
      correctedPath: null,
    });
    expect(env.PATH).toBe("/usr/bin:/bin");
  });

  it("preserves other base env vars", () => {
    const env = buildChildEnv({
      baseEnv: { HOME: "/Users/me", LANG: "en_US.UTF-8" },
      claudeDir: "/c",
      correctedPath: null,
    });
    expect(env.HOME).toBe("/Users/me");
    expect(env.LANG).toBe("en_US.UTF-8");
  });
});
