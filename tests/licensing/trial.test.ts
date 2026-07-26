import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TRIAL_MS,
  beginOrReadTrial,
  deriveLicenseState,
  createLicenseStore,
  type LicenseFile,
  type StoredLicense,
} from "../../src/main/licensing/trial";

const T0 = Date.parse("2026-07-26T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const lic = (over: Partial<StoredLicense> = {}): StoredLicense => ({
  key: "FD-TEST-TEST-TEST-TEST",
  token: "tok",
  plan: "yearly",
  periodEndMs: T0 + 365 * DAY,
  lastValidatedMs: T0,
  ...over,
});

describe("beginOrReadTrial", () => {
  it("stamps the trial start on first read and keeps it thereafter", () => {
    const first = beginOrReadTrial({}, T0);
    expect(first.startedAtMs).toBe(T0);
    expect(first.file.trialStartedAtMs).toBe(T0);
    const later = beginOrReadTrial(first.file, T0 + DAY);
    expect(later.startedAtMs).toBe(T0);
    expect(later.file).toBe(first.file); // unchanged input returned as-is, no rewrite
  });

  it("clamps a future stamp to now, so a rolled-back clock can't extend the trial forever", () => {
    const out = beginOrReadTrial({ trialStartedAtMs: T0 + 30 * DAY }, T0);
    expect(out.startedAtMs).toBe(T0);
    expect(out.file.trialStartedAtMs).toBe(T0);
  });

  it("does not mutate its input", () => {
    const input: LicenseFile = {};
    beginOrReadTrial(input, T0);
    expect(input.trialStartedAtMs).toBeUndefined();
  });
});

describe("deriveLicenseState", () => {
  const noVerify = () => null;

  it("runs the 7-day trial with a daysLeft countdown", () => {
    const { file } = beginOrReadTrial({}, T0);
    expect(deriveLicenseState(file, T0, noVerify)).toEqual({
      kind: "trial",
      daysLeft: 7,
      endsAtMs: T0 + TRIAL_MS,
    });
    expect(deriveLicenseState(file, T0 + 6.5 * DAY, noVerify)).toMatchObject({
      kind: "trial",
      daysLeft: 1,
    });
  });

  it("expires at exactly day 7 with no license", () => {
    const { file } = beginOrReadTrial({}, T0);
    expect(deriveLicenseState(file, T0 + TRIAL_MS, noVerify)).toEqual({
      kind: "expired",
    });
  });

  it("a verified license wins over an expired trial", () => {
    const file: LicenseFile = { trialStartedAtMs: T0, license: lic() };
    const state = deriveLicenseState(file, T0 + 30 * DAY, () => ({
      plan: "yearly",
      periodEndMs: T0 + 365 * DAY,
    }));
    expect(state).toEqual({
      kind: "licensed",
      plan: "yearly",
      periodEndMs: T0 + 365 * DAY,
    });
  });

  it("a license that fails verification falls back to the trial clock", () => {
    const file: LicenseFile = { trialStartedAtMs: T0, license: lic() };
    expect(deriveLicenseState(file, T0 + 30 * DAY, noVerify)).toEqual({
      kind: "expired",
    });
    expect(deriveLicenseState(file, T0 + DAY, noVerify)).toMatchObject({
      kind: "trial",
      daysLeft: 6,
    });
  });

  it("a missing trial stamp with no license reads as a fresh 7-day trial from now", () => {
    expect(deriveLicenseState({}, T0, noVerify)).toEqual({
      kind: "trial",
      daysLeft: 7,
      endsAtMs: T0 + TRIAL_MS,
    });
  });
});

describe("createLicenseStore", () => {
  it("round-trips the license file under the given dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "cbw-lic-"));
    const store = createLicenseStore(dir);
    expect(store.read()).toEqual({});
    store.write({ trialStartedAtMs: T0, license: lic() });
    expect(createLicenseStore(dir).read()).toEqual({
      trialStartedAtMs: T0,
      license: lic(),
    });
  });

  it("treats a corrupt file as empty rather than throwing", () => {
    const dir = mkdtempSync(join(tmpdir(), "cbw-lic-"));
    writeFileSync(join(dir, "license.json"), "{not json");
    expect(createLicenseStore(dir).read()).toEqual({});
  });
});
