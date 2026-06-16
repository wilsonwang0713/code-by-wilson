import type { BinSource, CliStatus, InstallMethod } from "@shared/cli-status";
import { compareSemver, parseSemver } from "./cli-version";

/** The minimum Claude Code version the app supports. A one-line maintainer lever — bump it when the app
 *  starts relying on a newer CLI behavior. Set near-latest deliberately: installs below it read as "too
 *  old" and get nudged to update. Verify against the changelog when changing. */
export const MIN_CLAUDE_VERSION = "2.1.177";

/** The raw probe results the pure evaluator classifies. Mirrors shell-path.ts's pure/wiring split. */
export interface CliProbeInput {
  path: string | null;
  source: BinSource | null;
  isRegularFile: boolean;
  duplicates: string[];
  version:
    | { status: "ok"; raw: string }
    | { status: "spawnError" } // ENOENT — binary not actually there
    | { status: "failed" }; // ran but non-zero / timeout / garbage
  auth: { status: "ok" } | { status: "loggedOut" } | { status: "unknown" };
  floor: string;
  installMethod: InstallMethod;
  configDir: { active: string; recovered: string | null };
  now: number;
}

export function evaluateCliStatus(p: CliProbeInput): CliStatus {
  const configDir = {
    active: p.configDir.active,
    recovered: p.configDir.recovered,
    mismatch:
      p.configDir.recovered !== null &&
      p.configDir.recovered !== p.configDir.active,
  };
  const common = {
    path: p.path,
    source: p.source,
    floor: p.floor,
    installMethod: p.installMethod,
    duplicates: p.duplicates,
    configDir,
    checkedAt: p.now,
  };

  if (
    p.path === null ||
    !p.isRegularFile ||
    p.version.status === "spawnError"
  ) {
    return {
      ...common,
      kind: "notFound",
      version: null,
      detail: "not on PATH",
    };
  }
  if (p.version.status === "failed") {
    return {
      ...common,
      kind: "unknown",
      version: null,
      detail: "couldn't run claude",
    };
  }
  const parsed = parseSemver(p.version.raw);
  if (!parsed) {
    return {
      ...common,
      kind: "unknown",
      version: null,
      detail: "unrecognized version",
    };
  }
  // Guard a colliding non-Claude `claude` on PATH: the real CLI prints "<x.y.z> (Claude Code)". Reject only
  // when --version carries a parenthesized product tag that ISN'T Claude (e.g. "9.9.9 (SomeOtherTool)"). A
  // bare "x.y.z" with no tag is NOT rejected — parseSemver documents that bare output is a valid format, and
  // blocking a working CLI over a missing suffix (→ unknown → spawning disabled) is worse than tolerating a
  // vanishingly-rare untagged impostor, which fails at auth/usage anyway. Loose match on the tag so a
  // "(… Claude …)" wording variant still passes.
  const tag = /\(([^)]*)\)/.exec(p.version.raw);
  if (tag && !/claude/i.test(tag[1])) {
    return {
      ...common,
      kind: "unknown",
      version: null,
      detail: "not Claude Code",
    };
  }
  const version = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (compareSemver(version, p.floor) < 0) {
    return {
      ...common,
      kind: "outdated",
      version,
      detail: `needs ≥ ${p.floor}`,
    };
  }
  if (p.auth.status === "loggedOut") {
    return { ...common, kind: "loggedOut", version, detail: "logged out" };
  }
  return { ...common, kind: "ready", version, detail: "ready" };
}
