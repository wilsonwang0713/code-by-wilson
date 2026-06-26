# Provider-Agnostic Cost Display

## Problem

Non-Anthropic models (e.g. DeepSeek) show tokens but no meaningful cost in the Tokens panel:

- `modelUsageCost()` returns `null` because `isKnownModelString("deepseek-v4-pro")` returns `false`
- `viewUsageByModel()` accumulates `cost.total` as `$0.00` — misleadingly suggesting the session was free
- The by-model row shows `"n/a"` (honest) but every per-kind row shows `~$0.00` (wrong)
- Per-family pricing overrides (PricingEditor) are ignored for unrecognized models even though the user can edit the Opus row expecting it to apply

## Goal

For any model, show a non-zero cost estimate — never `$0.00` when tokens were actually consumed. Let the user control that estimate via the existing PricingEditor.

## Design

### 1. `modelUsageCost()` falls back to default family pricing

**File:** `src/shared/usage-by-model.ts`

`modelUsageCost()` currently bails out when `isKnownModelString()` returns `false`:

```ts
// Before
export function modelUsageCost(mu, overrides): CostBreakdown | null {
  const raw = mu.modelRaw ?? undefined;
  if (!isKnownModelString(raw)) return null;
  return costBreakdown(mu.usage, normalizeModelId(raw), overrides);
}
```

Change it to fall back to the default family:

```ts
// After
export function modelUsageCost(mu, overrides): CostBreakdown | null {
  const raw = mu.modelRaw ?? undefined;
  const known = isKnownModelString(raw);
  if (!known && !raw) return null; // genuinely absent model → n/a
  return costBreakdown(mu.usage, normalizeModelId(raw), overrides);
}
```

`normalizeModelId()` already returns `"opus"` for unrecognized strings, so DeepSeek tokens get priced at Opus rates. If the user overrides Opus rates in the PricingEditor, those overrides apply immediately — no new UI needed.

The `null` return is now reserved for `modelRaw: null` only (a turn with no model recorded — should be rare).

### 2. Per-kind rows show `"—"` when there's no priced model AND no live cost

**File:** `src/renderer/src/workspace/panels/TokensPanel.tsx`

The `TokensPanel` already receives `liveCostUsd`. Add a derived flag:

```ts
const noPricing = models.every(m => m.cost === null) && liveCostUsd == null;
```

In the `Row` component, when `noPricing` is true, show `"—"` instead of `~$0.00` for the cost column. The by-model row already shows `"n/a"` when `m.cost` is `null` — that stays.

### 3. Headline and cache-savings row follow the same rule

The headline already uses `costDisplay()` which picks `liveCostUsd` over `equivApiValueUsd`. With change (1), `equivApiValueUsd` is no longer zero, so the headline works even without `liveCostUsd`.

When both are absent (`liveCostUsd` undefined AND no model recognized), the headline shows `"n/a"` instead of `~$0.00`.

The cache-savings row is conditionally rendered (`cacheSavings > 0`) so it naturally disappears when cost is zero.

### Behavior matrix

| Scenario | Headline | Per-kind rows | By-model row |
|---|---|---|---|
| Recognized model (e.g. claude-sonnet) | `~$x.xx` | `~$x.xx` | `~$x.xx` |
| Unrecognized model, no override | `~$x.xx` (Opus rates) | `~$x.xx` | `~$x.xx` |
| Unrecognized model + Opus override | `~$x.xx` (your rates) | `~$x.xx` | `~$x.xx` |
| Unrecognized model + `liveCostUsd` | `~$2.83` (live) | `~$x.xx` (computed) | `~$x.xx` |
| No model at all, no live cost | `n/a` | `—` | `n/a` |

## What this does NOT do

- **Does not** allocate `liveCostUsd` proportionally across token kinds (left for a future change)
- **Does not** add per-model-ID family mapping (the Opus fallback is the single escape hatch — edit Opus rates to match your provider)
- **Does not** change the `costDisplay()` equivalent-vs-real logic — DeepSeek still shows `~` because it's not Anthropic direct billing
- **Does not** touch the PricingEditor UI or the `PricingOverrides` type

## Test changes

`tests/shared/usage-by-model.test.ts`:

- Replace the `"returns null for an unrecognized id (n/a cost)"` test: now expect a non-null `CostBreakdown` priced at Opus rates
- Add a test: `"returns null when modelRaw is null"` — the one remaining `null` path
- Add a test: `"prices an unrecognized model at Opus rates"`
- Add a test: `"applies Opus override to an unrecognized model"`
- The `"counts an unrecognized model's tokens but excludes it from cost (n/a)"` test changes: the unknown model now contributes cost

## Files touched

| File | Change |
|---|---|
| `src/shared/usage-by-model.ts` | `modelUsageCost()` fallback logic |
| `src/renderer/src/workspace/panels/TokensPanel.tsx` | `noPricing` flag, `"—"` display |
| `tests/shared/usage-by-model.test.ts` | Update tests for new behavior |
