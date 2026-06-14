import { describe, it, expect } from "vitest";
import type { StatsByProject, StatsByBranch } from "@shared/stats";
import {
  groupProjectBranches,
  TOP_BRANCHES_PER_PROJECT,
} from "../../src/renderer/src/stats/project-branches";

const proj = (over: Partial<StatsByProject> = {}): StatsByProject => ({
  cwd: "/w/proj",
  project: "proj",
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  equivApiValueUsd: 0,
  ...over,
});

const br = (over: Partial<StatsByBranch> = {}): StatsByBranch => ({
  cwd: "/w/proj",
  project: "proj",
  branch: "main",
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  equivApiValueUsd: 0,
  ...over,
});

describe("groupProjectBranches", () => {
  it("attaches each project's branches by cwd and keeps projects in input order", () => {
    const projects = [
      proj({ cwd: "/w/a", project: "a", totalTokens: 30 }),
      proj({ cwd: "/w/b", project: "b", totalTokens: 10 }),
    ];
    const branches = [
      br({ cwd: "/w/a", branch: "main", totalTokens: 20 }),
      br({ cwd: "/w/b", branch: "dev", totalTokens: 10 }),
      br({ cwd: "/w/a", branch: "feat", totalTokens: 10 }),
    ];
    const groups = groupProjectBranches(projects, branches);
    expect(groups.map((g) => g.cwd)).toEqual(["/w/a", "/w/b"]);
    expect(groups[0].branches.map((b) => b.branch)).toEqual(["main", "feat"]);
    expect(groups[1].branches.map((b) => b.branch)).toEqual(["dev"]);
  });

  it("does not merge two projects that share a basename", () => {
    const projects = [
      proj({ cwd: "/w/one/api", project: "api", totalTokens: 5 }),
      proj({ cwd: "/w/two/api", project: "api", totalTokens: 5 }),
    ];
    const branches = [
      br({ cwd: "/w/one/api", branch: "main", totalTokens: 5 }),
      br({ cwd: "/w/two/api", branch: "main", totalTokens: 5 }),
    ];
    const groups = groupProjectBranches(projects, branches);
    expect(groups[0].branches).toHaveLength(1);
    expect(groups[1].branches).toHaveLength(1);
  });

  it("sorts a project's branches by total tokens descending", () => {
    const groups = groupProjectBranches(
      [proj({ cwd: "/w/a" })],
      [
        br({ cwd: "/w/a", branch: "small", totalTokens: 1 }),
        br({ cwd: "/w/a", branch: "big", totalTokens: 9 }),
      ],
    );
    expect(groups[0].branches.map((b) => b.branch)).toEqual(["big", "small"]);
  });

  it("caps branches per project and reports the overflow", () => {
    const branches = Array.from(
      { length: TOP_BRANCHES_PER_PROJECT + 3 },
      (_, i) => br({ cwd: "/w/a", branch: `b${i}`, totalTokens: 100 - i }),
    );
    const groups = groupProjectBranches([proj({ cwd: "/w/a" })], branches);
    expect(groups[0].branches).toHaveLength(TOP_BRANCHES_PER_PROJECT);
    expect(groups[0].branchOverflow).toBe(3);
  });

  it("is not expandable when a project has only a null branch", () => {
    const groups = groupProjectBranches(
      [proj({ cwd: "/w/a" })],
      [br({ cwd: "/w/a", branch: null, totalTokens: 5 })],
    );
    expect(groups[0].expandable).toBe(false);
  });

  it("is expandable when a project has a real branch", () => {
    const groups = groupProjectBranches(
      [proj({ cwd: "/w/a" })],
      [br({ cwd: "/w/a", branch: "main", totalTokens: 5 })],
    );
    expect(groups[0].expandable).toBe(true);
  });

  it("reports zero overflow when a project is under the branch cap", () => {
    const groups = groupProjectBranches(
      [proj({ cwd: "/w/a" })],
      [
        br({ cwd: "/w/a", branch: "main", totalTokens: 5 }),
        br({ cwd: "/w/a", branch: "dev", totalTokens: 3 }),
      ],
    );
    expect(groups[0].branches).toHaveLength(2);
    expect(groups[0].branchOverflow).toBe(0);
  });

  it("gives a project with no branch rows an empty, non-expandable group", () => {
    const groups = groupProjectBranches([proj({ cwd: "/w/a" })], []);
    expect(groups[0].branches).toEqual([]);
    expect(groups[0].expandable).toBe(false);
    expect(groups[0].branchOverflow).toBe(0);
  });
});
