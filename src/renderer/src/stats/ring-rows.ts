import type { StatsByModel } from "@shared/stats";

/**
 * How many concentric rings the model-share ring may draw. RingChart scales the whole stack to fit
 * its fixed canvas, so every extra model SHRINKS the center hole (size 168, stroke 10, gap 6: two
 * rings leave a 76px hole, seven leave ~30px — below what the two-line center stat needs, which is
 * how the hovered label got clipped once multi-provider ingestion grew the model list). Five rings
 * keep the hole ≥ ~42px, comfortably above the stat's ~31px floor.
 */
export const MAX_RINGS = 5;

/** One ring of the share ring: a real model, or (modelRaw null + otherCount) the fold bucket. */
export interface RingRow {
  modelRaw: string | null;
  totalTokens: number;
  /** The fold bucket: how many models it absorbed. Absent on a real model's ring. */
  otherCount?: number;
}

/**
 * The share ring's rows: every model when they fit the ring budget, else the top MAX_RINGS - 1 by
 * tokens plus one "Other" bucket carrying the EXACT remainder — shares still sum to the window's
 * total (the ring stays honest; the by-model list beside it remains the complete legend). Rows
 * order by tokens descending with the raw id as a stable tiebreak (the same comparator the list
 * uses, so ring order and legend order never disagree); zero-token rows are dropped first, matching
 * the ring's existing filter.
 */
export function foldRingRows(rows: StatsByModel[]): RingRow[] {
  const sorted = rows
    .filter((r) => r.totalTokens > 0)
    .sort(
      (a, b) =>
        b.totalTokens - a.totalTokens ||
        (a.modelRaw ?? "").localeCompare(b.modelRaw ?? ""),
    )
    .map(
      (r): RingRow => ({ modelRaw: r.modelRaw, totalTokens: r.totalTokens }),
    );
  if (sorted.length <= MAX_RINGS) return sorted;
  const kept = sorted.slice(0, MAX_RINGS - 1);
  const tail = sorted.slice(MAX_RINGS - 1);
  return [
    ...kept,
    {
      modelRaw: null,
      totalTokens: tail.reduce((s, r) => s + r.totalTokens, 0),
      otherCount: tail.length,
    },
  ];
}
