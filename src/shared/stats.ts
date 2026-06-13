/**
 * All-time usage totals the Stats view renders as headline cards, computed by the analytics store from
 * a single SQL aggregate. `equivApiValueUsd` is an Equivalent API value (a reference figure, never money
 * owed on a subscription — see CONTEXT.md): the sum over only the models whose raw id maps to a known
 * family. Tokens from an unrecognized model are still counted in the token totals but contribute n/a cost.
 */
export interface StatsTotals {
  /** Distinct sessions that contributed at least one turn. */
  sessions: number;
  /** Assistant turns ingested. */
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  equivApiValueUsd: number;
}
