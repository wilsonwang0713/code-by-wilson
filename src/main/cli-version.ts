export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

/** Pull the first `x.y.z` out of arbitrary CLI output (`claude --version` may print bare or suffixed). */
export function parseSemver(s: string): Semver | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(s);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** -1 / 0 / 1. An unparsable side sorts lowest, so it never passes a floor by accident. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (const k of ["major", "minor", "patch"] as const) {
    if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
  }
  return 0;
}
