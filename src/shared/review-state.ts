/** Display tone for a PR review state (statusLine pr.review_state). Known states get a color;
 *  anything else stays neutral gray and renders verbatim — deliberately no whitelist, so a new
 *  CLI state degrades to gray text instead of vanishing. */
export type ReviewTone = "pending" | "approved" | "changes" | "neutral";

export function reviewTone(state: string): ReviewTone {
  if (state === "pending") return "pending";
  if (state === "approved") return "approved";
  if (state === "changes_requested") return "changes";
  return "neutral";
}

/** The short label the rail shows: "changes_requested" compresses to fit a 237px row. */
export function reviewLabel(state: string): string {
  return state === "changes_requested" ? "changes" : state;
}
