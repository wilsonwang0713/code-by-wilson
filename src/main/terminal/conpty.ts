/**
 * Decide whether node-pty should use Windows ConPTY (the modern pseudo-console) for a spawn. ConPTY is
 * Windows-only and stable from build 18309 — the floor VSCode uses (`getWindowsBuildNumber() >= 18309`).
 * Below it, or off Windows, node-pty falls back to winpty. We parse `os.release()` ("10.0.22631" → 22631)
 * rather than rely on node-pty's internal default, so the choice is explicit and unit-testable on any host.
 * Lives apart from pty-process so tests can import it without pulling in node-pty (a native addon).
 */
export function wantsConpty(
  platform: NodeJS.Platform,
  osRelease: string,
): boolean {
  if (platform !== "win32") return false;
  const build = Number(osRelease.split(".")[2]);
  return Number.isFinite(build) && build >= 18309;
}
