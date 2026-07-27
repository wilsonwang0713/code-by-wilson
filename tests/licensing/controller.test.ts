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

const okActivate = (): Promise<ActivateResult> =>
  Promise.resolve({ ok: true, license: LICENSE });
const okValidate = (): Promise<ValidateResult> =>
  Promise.resolve({ ok: true, license: LICENSE });

function backendStub(over: Partial<LicenseBackend> = {}): LicenseBackend {
  return {
    activate: vi.fn(okActivate),
    validate: vi.fn(okValidate),
    deactivate: vi.fn(() => Promise.resolve(true)),
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
  it("stamps the trial on first launch and persists it across instances", () => {
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
    const activate = vi.fn(okActivate);
    const { dir, ctl } = makeController(backendStub({ activate }), nowRef); // stamps the trial at T0
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
    expect(activate).toHaveBeenCalledWith(
      "38b1460a-5104-4067-a91d-77b872934d51",
      "Test Mac",
      nowRef.now,
    );
    // persisted: a new controller over the same dir is licensed without any network
    const mustNotActivate = vi.fn(
      (): Promise<ActivateResult> =>
        Promise.reject(new Error("must not be called")),
    );
    const again = createLicenseController({
      dir,
      backend: backendStub({ activate: mustNotActivate }),
      deviceName: "Test Mac",
      now: () => nowRef.now,
    });
    expect(again.state()).toMatchObject({ kind: "licensed" });
    expect(mustNotActivate).not.toHaveBeenCalled();
  });

  it("a failed activation surfaces the reason and leaves the state alone", async () => {
    const nowRef = { now: T0 };
    const { ctl } = makeController(
      backendStub({
        activate: vi.fn(
          (): Promise<ActivateResult> =>
            Promise.resolve({
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
    const deactivate = vi.fn(() => Promise.resolve(true));
    const { ctl } = makeController(backendStub({ deactivate }), nowRef);
    await ctl.activate("k");
    expect(ctl.state()).toMatchObject({ kind: "licensed" });

    await ctl.deactivate();
    expect(deactivate).toHaveBeenCalledOnce();
    expect(ctl.state()).toMatchObject({ kind: "trial" }); // trial clock still running
  });

  it("maybeRevalidate refreshes the cached period end once past it", async () => {
    const nowRef = { now: T0 };
    const renewed: StoredLicense = {
      ...LICENSE,
      periodEndMs: T0 + 730 * DAY,
      lastValidatedMs: T0 + 366 * DAY,
    };
    const validate = vi.fn(
      (): Promise<ValidateResult> =>
        Promise.resolve({ ok: true, license: renewed }),
    );
    const { ctl } = makeController(backendStub({ validate }), nowRef);
    await ctl.activate("k");

    // inside the period: no network
    nowRef.now = T0 + 100 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).not.toHaveBeenCalled();

    // past the period end (renewal should have happened): one validate, cache refreshed
    nowRef.now = T0 + 366 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).toHaveBeenCalledOnce();
    expect(ctl.state()).toMatchObject({
      kind: "licensed",
      periodEndMs: T0 + 730 * DAY,
    });
  });

  it("a never-expiring key still re-checks every few days, so a revocation eventually lands", async () => {
    const nowRef = { now: T0 };
    const lifetime: StoredLicense = { ...LICENSE, periodEndMs: null };
    const validate = vi.fn(
      (): Promise<ValidateResult> =>
        Promise.resolve({
          ok: true,
          license: { ...lifetime, lastValidatedMs: nowRef.now },
        }),
    );
    const activate = vi.fn(
      (): Promise<ActivateResult> =>
        Promise.resolve({ ok: true, license: lifetime }),
    );
    const { ctl } = makeController(backendStub({ activate, validate }), nowRef);
    await ctl.activate("k");

    // one day in: the last validation is fresh — quiet
    nowRef.now = T0 + 1 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).not.toHaveBeenCalled();

    // four days in: past the recheck window — one validate, stamp refreshed
    nowRef.now = T0 + 4 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).toHaveBeenCalledOnce();

    // two days after that refresh: quiet again
    nowRef.now = T0 + 6 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).toHaveBeenCalledOnce();

    // four days after the refresh: re-check hits a revocation → license clears → trial clock
    // (long over by now) reads expired
    validate.mockResolvedValueOnce({
      ok: false,
      reason: "revoked",
      message: "disabled",
    });
    nowRef.now = T0 + 8 * DAY;
    await ctl.maybeRevalidate();
    expect(validate).toHaveBeenCalledTimes(2);
    expect(ctl.state()).toEqual({ kind: "expired" });
  });

  it("a revoked validation clears the license; a network failure keeps the cache", async () => {
    const nowRef = { now: T0 };
    const revoking = backendStub({
      validate: vi.fn(
        (): Promise<ValidateResult> =>
          Promise.resolve({
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
        (): Promise<ValidateResult> =>
          Promise.resolve({
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
    // within the 14-day grace past the period end the cached license still holds
    expect(bAgain.state()).toMatchObject({ kind: "licensed" });
  });
});
