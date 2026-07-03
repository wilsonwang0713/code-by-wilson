import { Fragment } from "react";
import { type StatsByProject, tokensOf } from "@shared/stats";
import { formatTokensShort } from "@shared/format";
import { Swatch } from "../ui/atoms";
import { StatsCard, CardRegion } from "./shared";

/** Display cap for the full-width By-project card (#spec 2026-07-03: a whole card now, so deeper
 *  than the old side-by-side panel's 7). Rows past it roll into a "+N more" note. */
const TOP_PROJECTS = 20;

/** One row of a Breakdown panel: an entity with its displayed-metric tokens and the color its bar (and
 *  optional swatch) take. The caller ranks the rows and assigns colors; the panel slices to `cap`, sizes
 *  bars against the largest displayed value, and renders the header and "+N more" note. */
type BreakdownRow = {
  key: string;
  label: string;
  title?: string;
  tokens: number;
  color: string;
};

/** The shared ranked-breakdown panel behind By model and By project (#111/#112): a titled table of entities,
 *  biggest first, each a row of name + Tokens with a full-width bar beneath. The two callers differ only in
 *  props: model rows carry a per-model swatch (`showSwatch`); both cap to `cap.n` rows with a "+N more
 *  {cap.noun}s" note. The count and its noun ride in one object so a cap can't be set without the note that
 *  discloses it. Bars size against the largest DISPLAYED row, so a cap changes the denominator; an all-zero
 *  window yields empty bars rather than a divide-by-zero. The bar is built inline (not the `Bar` atom)
 *  because its color is a dynamic CSS value, not a Tailwind class. */
function Breakdown({
  title,
  nameLabel,
  rows,
  showSwatch = false,
  cap,
}: {
  title: string;
  nameLabel: string;
  rows: BreakdownRow[];
  showSwatch?: boolean;
  cap: { n: number; noun: string };
}) {
  const shown = rows.slice(0, cap.n);
  const max = Math.max(...shown.map((r) => r.tokens), 0);
  const rest = rows.length - shown.length;
  return (
    <StatsCard>
      <CardRegion title={title}>
        <table className="w-full table-fixed text-aux">
          <colgroup>
            <col className="w-[70%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="text-label uppercase tracking-wide text-fg-faint">
              <th
                scope="col"
                className="whitespace-nowrap pb-1.5 text-left font-normal"
              >
                {nameLabel}
              </th>
              <th
                scope="col"
                className="whitespace-nowrap pb-1.5 text-right font-normal"
              >
                Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <Fragment key={r.key}>
                <tr className={i === 0 ? "" : "border-t border-ink-850"}>
                  <td className="pt-2 pr-3 align-middle">
                    <span className="flex min-w-0 items-center gap-2">
                      {showSwatch && <Swatch color={r.color} />}
                      <span className="truncate text-fg" title={r.title}>
                        {r.label}
                      </span>
                    </span>
                  </td>
                  <td className="pt-2 pl-2 text-right align-middle font-mono tabular-nums text-fg-muted">
                    {formatTokensShort(r.tokens)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="pb-2 pt-1.5">
                    <div className="h-[5px] overflow-hidden rounded-full bg-ink-850">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${max > 0 ? (r.tokens / max) * 100 : 0}%`,
                          background: r.color,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        {rest > 0 && (
          <p className="mt-2 text-meta text-fg-faint">
            +{rest} more {rest === 1 ? cap.noun : `${cap.noun}s`}
          </p>
        )}
      </CardRegion>
    </StatsCard>
  );
}

/** The per-project breakdown (#112) — the old panel, now a full-width card capped at TOP_PROJECTS. Keyed
 *  on the full cwd so two repos that share a basename stay separate (the cwd rides along as the row's
 *  hover title). Ranks by the displayed Tokens metric, so order follows the page's Include-cache toggle. */
export function ProjectsCard({
  rows,
  includeCache,
}: {
  rows: StatsByProject[];
  includeCache: boolean;
}) {
  if (!rows.some((r) => r.totalTokens > 0)) return null;
  const ranked: BreakdownRow[] = rows
    .slice()
    .sort(
      (a, b) =>
        tokensOf(b, includeCache) - tokensOf(a, includeCache) ||
        a.cwd.localeCompare(b.cwd),
    )
    .map((r) => ({
      key: r.cwd,
      label: r.project,
      title: r.cwd,
      tokens: tokensOf(r, includeCache),
      color: "var(--color-data-1)",
    }));
  return (
    <Breakdown
      title="By project"
      nameLabel="Project"
      rows={ranked}
      cap={{ n: TOP_PROJECTS, noun: "project" }}
    />
  );
}
