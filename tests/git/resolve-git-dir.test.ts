import { describe, it, expect } from "vitest";
import { win32, posix } from "node:path";
import { joinGitDir } from "../../src/main/git/read-git";

// Inject path.win32/path.posix so both platform behaviors are verified deterministically on any host —
// joinGitDir's default uses the host node:path, which is what production runs against.
describe("joinGitDir", () => {
  it("returns an absolute Windows git-dir unchanged (win32 semantics)", () => {
    expect(joinGitDir("C:\\proj", "C:\\proj\\.git", win32)).toBe(
      "C:\\proj\\.git",
    );
  });
  it("returns an absolute POSIX git-dir unchanged (posix semantics)", () => {
    expect(joinGitDir("/proj", "/proj/.git", posix)).toBe("/proj/.git");
  });
  it("joins a relative git-dir to cwd (posix)", () => {
    expect(joinGitDir("/proj", ".git", posix)).toBe("/proj/.git");
  });
  it("joins a relative git-dir to cwd (win32)", () => {
    expect(joinGitDir("C:\\proj", ".git", win32)).toBe("C:\\proj\\.git");
  });
});
