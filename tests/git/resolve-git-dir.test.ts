import { describe, it, expect } from "vitest";
import { joinGitDir } from "../../src/main/git/read-git";

describe("joinGitDir", () => {
  it("returns an absolute Windows git-dir unchanged", () => {
    expect(joinGitDir("C:\\proj", "C:\\proj\\.git")).toBe("C:\\proj\\.git");
  });
  it("returns an absolute POSIX git-dir unchanged", () => {
    expect(joinGitDir("/proj", "/proj/.git")).toBe("/proj/.git");
  });
  it("joins a relative git-dir to cwd", () => {
    expect(joinGitDir("/proj", ".git")).toContain(".git");
  });
});
