import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLicenseController } from "../../src/main/licensing/controller";
import type {
  LicenseBackend,
  ActivateResult,
  ValidateResult,
} from "../../src/main/licensing/lemon-squeezy";
import type { StoredLicense } from "../../src/main/licensing/trial";

const T0 = Date.parse("2026-07-26T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const LICENSE: StoredLicense = {
  key: "38b1460a-5104-4067-a91d-77b872934d51",
  token: "inst-abc",
  plan: "yearly",
  periodEndMs: T0 + 365 * DAY,
  lastValidatedMs: T0,
};

function backendStub(over: Partial<LicenseBackend> = {}): LicenseBackend {
  return {
    activate: vi.fn(
      async (): Promise<ActivateResult> => ({ ok: true, license: LICENSE }),
    ),
    validate: vi.fn(
      async (): Promise<ValidateResult> => ({ ok: true, license: LICENSE }),
    ),
    deactivate: vi.fn(async () => true),
    ...over,
  };
}

function makeController(
  backend: LicenseBackend,
  nowRef: { now: number },
  dir = mkdtempSync(join(tmpdir(), "cbw-licctl-")),
) {
  return {
    dir,
    ctl: createLicenseController({
      dir,
      backend,
      deviceName: "Test Mac",
      now: () => nowRef.now,
    }),
  };
}

describe("createLicenseController", () => {
  it("stamps the trial on first state read and persists it across instances", () => {
    const nowRef = { now: T0 };
    const { dir, ctl } = makeController(backendStub(), nowRef);
    expect(ctl.state()).toMatchObject({ kind: "trial", daysLeft: 7 });
    // a fresh controller over the same dir sees the SAME trial clock, later
    nowRef.now = T0 + 3 * DAY;
    const again = createLicenseController({
      dir,
      backend: backendStub(),
      deviceName: "Test Mac",
      now: () => nowRef.now,
    });
    expect(again.state()).toMatchObject({ kind: "trial", daysLeft: 4 });
  });

  it("activate persists the license and flips the state to licensed", async () => {
    const nowRef = { now: T0 };
    const backend = backendStub();
    const { dir, ctl } = makeController(backend, nowRef); // construction stamps the trial at T0
    nowRef.now = T0 + 10 * DAY; // ten days later: trial over
    expect(ctl.state()).toEqual({ kind: "expired" });

    const res = await ctl.activate("  38b1460a-5104-4067-a91d-77b872934d51  ");
    expect(res).toEqual({ ok: true });
    expect(ctl.state()).toEqual({
      kind: "licensed",
      plan: "yearly",
      periodEndMs: T0 + 365 * DAY,
    });
    // trimmed key + configured device name reach the backend
    expect(backend.activate).toHaveBeenCalledWith(
      "38b1460a-5104-4067-a91d-77b872934d51",
      "Test Mac",
      nowRef.now,
    );
    // persisted: a new controller over the same dir is licensed without any network
    const again = createLicenseController({
      dir,
      backend: backendStub({
        activate: vi.fn(async () => {
          throw new Error("must not be called");
        }) as unknown as LicenseBackend["activate"],
      }),
      deviceName: "Test Mac",
      now: () => nowRef.now,
    });
    expect(again.state()).toMatchObject({ kind: "licensed" });
  });

  it("a failed activation surfaces the reason and leaves the state alone", async () => {
    const nowRef = { now: T0 };
    const { ctl } = makeController(
      backendStub({
        activate: vi.fn(
          async (): Promise<ActivateResult> => ({
            ok: false,
            reason: "limit-reached",
            message: "This license key has reached its activation limit.",
          }),
        ),
      }),
      nowRef,
    );
    const res = await ctl.activate("k");
    expect(res).toMatchObject({ ok: false, reason: "limit-reached" });
    expect(ctl.state()).toMatchObject({ kind: "trial" });
  });

  it("deactivate frees the seat and falls back to the trial clock", async () => {
    const nowRef = { now: T0 };
    const backend = backendStub();
    const { ctl } = makeController(backend, nowRef);
    await ctl.activate("k");
    expect(ctl.state()).toMatchObject({ kind: "licensed" });

    await ctl.deactivate();
    expect(backend.deactivate).toHaveBeenCalledOnce();
    expect(ctl.state()).toMatchObject({ kind: "trial" }); // trial clock still running
  });

  it("maybeRevalidate refreshes the cached period end once past it", async () => {
    const nowRef = { now: T0 };
    const renewed: StoredLicense = {
      ...LICENSE,
      periodEndMs: T0 + 730 * DAY,
      lastValidatedMs: T0 + 366 * DAY,
    };
    const backend = backendStub({
      validate: vi.fn(
        async (): Promise<ValidateResult> => ({ ok: true, license: renewed }),
      ),
    });
    const { ctl } = makeController(backend, nowRef);
    await ctl.activate("k");

    // inside the period: no network
    nowRef.now = T0 + 100 * DAY;
    await ctl.maybeRevalidate();
    expect(backend.validate).not.toHaveBeenCalled();

    // past the period end (renewal should have happened): one validate, cache refreshed
    nowRef.now = T0 + 366 * DAY;
    await ctl.maybeRevalidate();
    expect(backend.validate).toHaveBeenCalledOnce();
    expect(ctl.state()).toMatchObject({
      kind: "licensed",
      periodEndMs: T0 + 730 * DAY,
    });
  });

  it("a revoked validation clears the license; a network failure keeps the cache", async () => {
    const nowRef = { now: T0 };
    const revoking = backendStub({
      validate: vi.fn(
        async (): Promise<ValidateResult> => ({
          ok: false,
          reason: "revoked",
          message: "disabled",
        }),
      ),
    });
    const a = makeController(revoking, nowRef);
    await a.ctl.activate("k");
    nowRef.now = T0 + 366 * DAY;
    await a.ctl.maybeRevalidate();
    expect(a.ctl.state()).toEqual({ kind: "expired" }); // license gone, trial long over

    const offline = backendStub({
      validate: vi.fn(
        async (): Promise<ValidateResult> => ({
          ok: false,
          reason: "network",
          message: "offline",
        }),
      ),
    });
    const b = makeController(offline, { now: T0 });
    await b.ctl.activate("k");
    const bNow = { now: T0 + 366 * DAY };
    const bAgain = createLicenseController({
      dir: b.dir,
      backend: offline,
      deviceName: "Test Mac",
      now: () => bNow.now,
    });
    await bAgain.maybeRevalidate();
    // within the 14-day grace past period end the cached license still holds
    expect(bAgain.state()).toMatchObject({ kind: "licensed" });
  });
});
