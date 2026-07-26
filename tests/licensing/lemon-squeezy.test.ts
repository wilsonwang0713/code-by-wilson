import { describe, it, expect, vi } from "vitest";
import {
  createLemonSqueezyBackend,
  verifyCachedLicense,
  LICENSE_GRACE_MS,
} from "../../src/main/licensing/lemon-squeezy";
import type { StoredLicense } from "../../src/main/licensing/trial";

const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const PERIOD_END = "2026-08-26T12:00:00.000Z";

const CONFIG = { storeId: 111, productId: 222 };

/** An LS /v1/licenses/* response body, overridable per test. */
function lsBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    activated: true,
    valid: true,
    error: null,
    license_key: {
      id: 1,
      status: "active",
      key: "38b1460a-5104-4067-a91d-77b872934d51",
      activation_limit: 3,
      activation_usage: 1,
      expires_at: PERIOD_END,
    },
    instance: { id: "inst-abc", name: "Wilson's MacBook Pro" },
    meta: {
      store_id: 111,
      product_id: 222,
      variant_id: 333,
      variant_name: "Yearly",
      customer_email: "buyer@example.com",
    },
    ...over,
  };
}

function fetchStub(
  status: number,
  body: Record<string, unknown>,
): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

const stored = (over: Partial<StoredLicense> = {}): StoredLicense => ({
  key: "38b1460a-5104-4067-a91d-77b872934d51",
  token: "inst-abc",
  plan: "yearly",
  periodEndMs: Date.parse(PERIOD_END),
  lastValidatedMs: NOW,
  ...over,
});

describe("activate", () => {
  it("posts the key + device name and maps the response into a stored license", async () => {
    const f = fetchStub(200, lsBody());
    const be = createLemonSqueezyBackend({ ...CONFIG, fetchFn: f });
    const out = await be.activate(
      "38b1460a-5104-4067-a91d-77b872934d51",
      "Wilson's MacBook Pro",
      NOW,
    );
    expect(out).toEqual({ ok: true, license: stored() });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.lemonsqueezy.com/v1/licenses/activate");
    expect(JSON.parse(init.body as string)).toEqual({
      license_key: "38b1460a-5104-4067-a91d-77b872934d51",
      instance_name: "Wilson's MacBook Pro",
    });
  });

  it("rejects a key from another store or product even when LS accepts it", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(
        200,
        lsBody({ meta: { store_id: 999, product_id: 222 } }),
      ),
    });
    const out = await be.activate("k", "dev", NOW);
    expect(out).toMatchObject({ ok: false, reason: "wrong-product" });
  });

  it("maps the activation-limit error", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(400, {
        activated: false,
        error: "This license key has reached its activation limit.",
      }),
    });
    expect(await be.activate("k", "dev", NOW)).toMatchObject({
      ok: false,
      reason: "limit-reached",
    });
  });

  it("maps an unknown key and an expired key", async () => {
    const be1 = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(404, {
        activated: false,
        error: "license_key not found.",
      }),
    });
    expect(await be1.activate("k", "dev", NOW)).toMatchObject({
      ok: false,
      reason: "invalid-key",
    });
    const be2 = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(400, {
        activated: false,
        error: "This license key has expired.",
      }),
    });
    expect(await be2.activate("k", "dev", NOW)).toMatchObject({
      ok: false,
      reason: "expired",
    });
  });

  it("degrades a thrown fetch to a network error", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    expect(await be.activate("k", "dev", NOW)).toMatchObject({
      ok: false,
      reason: "network",
    });
  });

  it("a null expires_at stores a non-expiring license", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(
        200,
        lsBody({
          license_key: {
            id: 1,
            status: "active",
            key: "38b1460a-5104-4067-a91d-77b872934d51",
            activation_limit: 3,
            activation_usage: 1,
            expires_at: null,
          },
        }),
      ),
    });
    const out = await be.activate(
      "38b1460a-5104-4067-a91d-77b872934d51",
      "dev",
      NOW,
    );
    expect(out).toEqual({ ok: true, license: stored({ periodEndMs: null }) });
  });
});

describe("validate", () => {
  it("refreshes the cached period end after a renewal", async () => {
    const renewed = "2026-09-26T12:00:00.000Z";
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(
        200,
        lsBody({
          license_key: {
            id: 1,
            status: "active",
            key: "38b1460a-5104-4067-a91d-77b872934d51",
            activation_limit: 3,
            activation_usage: 1,
            expires_at: renewed,
          },
        }),
      ),
    });
    const out = await be.validate(stored(), NOW + 32 * DAY);
    expect(out).toEqual({
      ok: true,
      license: stored({
        periodEndMs: Date.parse(renewed),
        lastValidatedMs: NOW + 32 * DAY,
      }),
    });
  });

  it("reports a definitively revoked key so the caller can clear it", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: fetchStub(400, {
        valid: false,
        error: "This license key has been disabled.",
      }),
    });
    expect(await be.validate(stored(), NOW)).toMatchObject({
      ok: false,
      reason: "revoked",
    });
  });

  it("keeps the cache on a network failure", async () => {
    const be = createLemonSqueezyBackend({
      ...CONFIG,
      fetchFn: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    expect(await be.validate(stored(), NOW)).toMatchObject({
      ok: false,
      reason: "network",
    });
  });
});

describe("verifyCachedLicense (the offline check deriveLicenseState injects)", () => {
  it("accepts within the period and through the grace window", () => {
    const l = stored();
    expect(verifyCachedLicense(l, Date.parse(PERIOD_END) - DAY)).toEqual({
      plan: "yearly",
      periodEndMs: Date.parse(PERIOD_END),
    });
    expect(
      verifyCachedLicense(l, Date.parse(PERIOD_END) + LICENSE_GRACE_MS - 1),
    ).not.toBeNull();
  });

  it("rejects once the grace window is exhausted", () => {
    expect(
      verifyCachedLicense(stored(), Date.parse(PERIOD_END) + LICENSE_GRACE_MS),
    ).toBeNull();
  });

  it("a non-expiring license always verifies", () => {
    expect(
      verifyCachedLicense(stored({ periodEndMs: null }), NOW + 3650 * DAY),
    ).toEqual({ plan: "yearly", periodEndMs: null });
  });
});
