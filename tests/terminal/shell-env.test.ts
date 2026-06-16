import { describe, it, expect } from "vitest";
import {
  parseShellEnv,
  SHELL_ENV_SCRIPT,
} from "../../src/main/terminal/shell-path";

const F = "__CBW_FIELD__";
function fenced(path: string, configDir: string, claude: string): string {
  return `banner from .zshrc\n${F}${path}${F}${configDir}${F}${claude}${F}`;
}

describe("parseShellEnv", () => {
  it("pulls PATH, CLAUDE_CONFIG_DIR, and the claude path(s) out of the fenced output", () => {
    const out = fenced(
      "/opt/homebrew/bin:/usr/bin",
      "/custom/claude",
      "/opt/homebrew/bin/claude",
    );
    expect(parseShellEnv(out)).toEqual({
      path: "/opt/homebrew/bin:/usr/bin",
      configDir: "/custom/claude",
      claudePath: "/opt/homebrew/bin/claude",
      duplicates: ["/opt/homebrew/bin/claude"],
    });
  });
  it("treats empty fields as null and splits multiple claude paths into duplicates", () => {
    const out = fenced(
      "/usr/bin",
      "",
      "/usr/local/bin/claude\n/opt/homebrew/bin/claude",
    );
    const r = parseShellEnv(out);
    expect(r?.configDir).toBeNull();
    expect(r?.claudePath).toBe("/usr/local/bin/claude");
    expect(r?.duplicates).toEqual([
      "/usr/local/bin/claude",
      "/opt/homebrew/bin/claude",
    ]);
  });
  it("returns null when the fence is missing (shell errored)", () => {
    expect(parseShellEnv("command not found\n")).toBeNull();
  });
  it("ships a script that prints the three fields between fences", () => {
    expect(SHELL_ENV_SCRIPT).toContain("printenv PATH");
    expect(SHELL_ENV_SCRIPT).toContain("CLAUDE_CONFIG_DIR");
    expect(SHELL_ENV_SCRIPT).toContain("command -v");
  });
});
