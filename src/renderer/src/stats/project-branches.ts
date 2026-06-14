import type { StatsByProject, StatsByBranch } from "@shared/stats";

/** Display caps for the By-project panel. Projects beyond TOP_PROJECTS roll into a "+N more" note; an
 *  expanded project shows at most TOP_BRANCHES_PER_PROJECT branches, the rest into a per-project note. */
export const TOP_PROJECTS = 8;
export const TOP_BRANCHES_PER_PROJECT = 8;

/** A project row with its branches folded in: the top branches by tokens, how many were dropped, and
 *  whether the row is worth a disclosure caret. `expandable` is false when the project recorded no real
 *  branch (only a null "—" row, which would just echo the project total). */
export interface ProjectGroup extends StatsByProject {
  branches: StatsByBranch[];
  branchOverflow: number;
  expandable: boolean;
}

/**
 * Join the per-branch breakdown under the per-project breakdown by full `cwd`. Both arrive on the stats
 * snapshot keyed on the full working directory, so two repos that share a basename never merge. Projects
 * stay in their input order (the store's token-descending order); each project's branches are sorted by
 * total tokens descending, capped to TOP_BRANCHES_PER_PROJECT with the remainder counted in branchOverflow.
 * The displayed token figure (which follows the page's cache toggle) is left to the caller — this is a pure
 * structural join, independent of the toggle, the same way the By-project panel keeps the store's ranking.
 */
export function groupProjectBranches(
  projects: readonly StatsByProject[],
  branches: readonly StatsByBranch[],
): ProjectGroup[] {
  const byCwd = new Map<string, StatsByBranch[]>();
  for (const b of branches) {
    const list = byCwd.get(b.cwd);
    if (list) list.push(b);
    else byCwd.set(b.cwd, [b]);
  }
  return projects.map((p) => {
    const all = (byCwd.get(p.cwd) ?? [])
      .slice()
      .sort(
        (a, b) =>
          b.totalTokens - a.totalTokens ||
          (a.branch ?? "").localeCompare(b.branch ?? ""),
      );
    return {
      ...p,
      branches: all.slice(0, TOP_BRANCHES_PER_PROJECT),
      branchOverflow: Math.max(0, all.length - TOP_BRANCHES_PER_PROJECT),
      // At most one null-branch row exists per cwd (the store folds all branchless turns into one), so
      // "has a non-null branch" over the full list is safe: an expandable project always shows a real
      // branch in its capped slice, never an overflow-only one.
      expandable: all.some((b) => b.branch !== null),
    };
  });
}
