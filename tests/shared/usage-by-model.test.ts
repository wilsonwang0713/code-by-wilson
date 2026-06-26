import { describe, it, expect } from "vitest";
import { usage } from "../helpers/usage";
import {
  sumUsages,
  tokenTotal,
  modelUsageCost,
  viewUsageByModel,
  equivApiValueByModel,
} from "../../src/shared/usage-by-model";

describe("sumUsages / tokenTotal", () => {
  it("sums field by field and totals all four kinds", () => {
    const a = usage({
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheCreationTokens: 4,
    });
    const b = usage({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheCreationTokens: 40,
    });
    const s = sumUsages([a, b]);
    expect(s.inputTokens).toBe(11);
    expect(s.outputTokens).toBe(22);
    expect(s.cacheReadTokens).toBe(33);
    expect(s.cacheCreationTokens).toBe(44);
    expect(tokenTotal(s)).toBe(11 + 22 + 33 + 44);
  });
});

describe("modelUsageCost", () => {
  it("prices a recognized model at its rates", () => {
    const c = modelUsageCost({
      modelRaw: "claude-opus-4-8",
      usage: usage({ inputTokens: 1_000_000 }),
    });
    expect(c).not.toBeNull();
    expect(c!.input).toBeCloseTo(5); // opus input $5/1M
  });

  it("prices an unrecognized model at Opus (fallback) rates", () => {
    const c = modelUsageCost({
      modelRaw: "deepseek-v4-pro",
      usage: usage({ inputTokens: 1_000_000 }),
    });
    expect(c).not.toBeNull();
    expect(c!.input).toBeCloseTo(5); // opus input $5/1M fallback
  });

  it("returns null when modelRaw is null (genuinely absent model)", () => {
    expect(
      modelUsageCost({
        modelRaw: null,
        usage: usage({ inputTokens: 1_000_000 }),
      }),
    ).toBeNull();
  });
});

describe("viewUsageByModel", () => {
  it("is all-zero for an empty breakdown", () => {
    const v = viewUsageByModel([]);
    expect(v.totalTokens).toBe(0);
    expect(v.cost.total).toBe(0);
    expect(v.models).toEqual([]);
    expect(v.anyOverride).toBe(false);
  });

  it("combines tokens and per-kind cost across models, sorted biggest first", () => {
    const v = viewUsageByModel([
      {
        modelRaw: "claude-sonnet-4-6",
        usage: usage({ inputTokens: 1_000_000 }),
      },
      { modelRaw: "claude-opus-4-8", usage: usage({ inputTokens: 2_000_000 }) },
    ]);
    // Combined input tokens across both models.
    expect(v.usage.inputTokens).toBe(3_000_000);
    expect(v.totalTokens).toBe(3_000_000);
    // Opus has more tokens, sorts first.
    expect(v.models[0].modelRaw).toBe("claude-opus-4-8");
    // Per-kind cost is the sum at each model's own rate: opus 2M @ $5 + sonnet 1M @ $3.
    expect(v.cost.input).toBeCloseTo(10 + 3);
    expect(v.cost.total).toBeCloseTo(
      equivApiValueByModel([
        {
          modelRaw: "claude-sonnet-4-6",
          usage: usage({ inputTokens: 1_000_000 }),
        },
        {
          modelRaw: "claude-opus-4-8",
          usage: usage({ inputTokens: 2_000_000 }),
        },
      ]),
    );
  });

  it("prices an unrecognized model at Opus fallback rates alongside recognized models", () => {
    const v = viewUsageByModel([
      { modelRaw: "claude-opus-4-8", usage: usage({ inputTokens: 1_000_000 }) },
      { modelRaw: "deepseek-v4-pro", usage: usage({ inputTokens: 1_000_000 }) },
    ]);
    expect(v.usage.inputTokens).toBe(2_000_000); // tokens still combine
    // Both priced at Opus: 2M × $5/1M = $10
    expect(v.cost.input).toBeCloseTo(10);
    const deepseek = v.models.find((m) => m.modelRaw === "deepseek-v4-pro");
    expect(deepseek!.cost).not.toBeNull();
    expect(deepseek!.cost!.input).toBeCloseTo(5);
    expect(deepseek!.totalTokens).toBe(1_000_000);
  });

  it("applies Opus pricing override to an unrecognized model", () => {
    const v = viewUsageByModel(
      [{ modelRaw: "deepseek-v4-pro", usage: usage({ inputTokens: 1_000_000 }) }],
      { opus: { input: 0.5 } },
    );
    expect(v.cost.input).toBeCloseTo(0.5); // overridden Opus rate
    expect(v.anyOverride).toBe(true);
  });

  it("applies a per-model override only to that model and flags anyOverride", () => {
    const models = [
      { modelRaw: "claude-opus-4-8", usage: usage({ inputTokens: 1_000_000 }) },
      {
        modelRaw: "claude-sonnet-4-6",
        usage: usage({ inputTokens: 1_000_000 }),
      },
    ];
    const base = equivApiValueByModel(models);
    const over = equivApiValueByModel(models, { sonnet: { input: 30 } });
    // Sonnet input goes 3 → 30 (+27 on 1M tokens); opus unchanged.
    expect(over - base).toBeCloseTo(27);
    expect(
      viewUsageByModel(models, { sonnet: { input: 30 } }).anyOverride,
    ).toBe(true);
    expect(viewUsageByModel(models).anyOverride).toBe(false);
  });
});
