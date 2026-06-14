import {
  tokensOf,
  type StatsByProject,
  type StatsByBranch,
} from "@shared/stats";

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
 * snapshot keyed on the full working directory, so two repos that share a basename never merge. Projects and
 * each project's branches both rank by the displayed Tokens metric (tokensOf, which follows the page's
 * Include-cache toggle), so the order AND the per-project branch cap reflect the figures on screen: with
 * cache off, the fresh-heaviest branch can't be capped out behind a cache-heavy one. Branches cap to
 * TOP_BRANCHES_PER_PROJECT with the remainder counted in branchOverflow; the caller caps projects to its own
 * top-N. Mirrors how By model re-ranks on the displayed metric rather than the store's fixed order.
 */
export function groupProjectBranches(
  projects: readonly StatsByProject[],
  branches: readonly StatsByBranch[],
  includeCache: boolean,
): ProjectGroup[] {
  const byCwd = new Map<string, StatsByBranch[]>();
  for (const b of branches) {
    const list = byCwd.get(b.cwd);
    if (list) list.push(b);
    else byCwd.set(b.cwd, [b]);
  }
  return projects
    .map((p) => {
      const all = (byCwd.get(p.cwd) ?? [])
        .slice()
        .sort(
          (a, b) =>
            tokensOf(b, includeCache) - tokensOf(a, includeCache) ||
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
    })
    .sort(
      (a, b) =>
        tokensOf(b, includeCache) - tokensOf(a, includeCache) ||
        a.cwd.localeCompare(b.cwd),
    );
}
