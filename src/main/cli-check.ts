import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CliStatus } from "@shared/cli-status";
import {
  evaluateCliStatus,
  MIN_CLAUDE_VERSION,
  type CliProbeInput,
} from "./cli-status";
import { installMethodForPath, resolveClaudeBinary } from "./cli-resolve";
import type { AppSettingsStore } from "./app-settings";

const execFileAsync = promisify(execFile);

/** Node 24 refuses to execFile a .cmd/.bat on Windows without shell:true (CVE-2024-27980). A real .exe
 *  runs directly. Pure + tested so the platform rule isn't re-derived per call site. */
export function execOptionsForBinary(
  path: string,
  platform: NodeJS.Platform,
): { shell: boolean } {
  const isShim = /\.(cmd|bat|ps1)$/i.test(path);
  return { shell: platform === "win32" && isShim };
}

/** Map a failed `claude --version` to a probe status from the child-process error `code`: a spawn
 *  failure (ENOENT) means the binary isn't really there; anything else (non-zero exit, timeout → null)
 *  means it's there but unusable. Pure + exported so the classification is unit-tested without spawning. */
export function classifyVersionError(code: unknown): CliProbeInput["version"] {
  return code === "ENOENT" ? { status: "spawnError" } : { status: "failed" };
}

/** Map a failed `claude auth status` to a probe status: only a clean exit code 1 means logged out; any
 *  other failure (ENOENT, timeout, odd exit) is "can't determine" — never cry wolf. Pure + tested. */
export function classifyAuthError(code: unknown): CliProbeInput["auth"] {
  return code === 1 ? { status: "loggedOut" } : { status: "unknown" };
}

async function runVersion(path: string): Promise<CliProbeInput["version"]> {
  try {
    const { stdout } = await execFileAsync(path, ["--version"], {
      encoding: "utf8",
      // Generous: a first exec of a Node CLI can be slow (cold cache, AV scan, a network-mounted
      // ~/.local), and a timeout here classifies as "failed" → unknown → spawning blocked, locking out a
      // CLI that actually works. The check is async, so a long wait never stalls the main process.
      timeout: 10_000,
      ...execOptionsForBinary(path, process.platform),
    });
    return { status: "ok", raw: stdout };
  } catch (err) {
    return classifyVersionError((err as { code?: unknown }).code);
  }
}

async function runAuth(path: string): Promise<CliProbeInput["auth"]> {
  try {
    await execFileAsync(path, ["auth", "status"], {
      encoding: "utf8",
      timeout: 5_000,
      ...execOptionsForBinary(path, process.platform),
    });
    return { status: "ok" }; // exit 0 → logged in
  } catch (err) {
    return classifyAuthError((err as { code?: unknown }).code);
  }
}

/** Run the real probes and classify. `activeConfigDir`/`recoveredConfigDir` come from the startup probe;
 *  `probeShell` gates the login-shell probe inside resolveClaudeBinary. */
export async function checkCliStatus(args: {
  overridePath: string | null;
  activeConfigDir: string;
  recoveredConfigDir: string | null;
  probeShell: boolean;
  now: number;
}): Promise<CliStatus> {
  const resolved = await resolveClaudeBinary(
    args.overridePath,
    args.probeShell,
  );
  const version =
    resolved.path && resolved.isRegularFile
      ? await runVersion(resolved.path)
      : { status: "spawnError" as const };
  const base: Omit<CliProbeInput, "auth"> = {
    path: resolved.path,
    source: resolved.source,
    isRegularFile: resolved.isRegularFile,
    duplicates: resolved.duplicates,
    version,
    floor: MIN_CLAUDE_VERSION,
    installMethod: installMethodForPath(resolved.path),
    configDir: {
      active: args.activeConfigDir,
      recovered: args.recoveredConfigDir,
    },
    now: args.now,
  };
  // Probe auth only once the binary is confirmed to be a current Claude Code: evaluate with auth unknown
  // first, and run `<bin> auth status` only when that already lands on "ready" (version ran, identifies as
  // Claude, meets the floor). For every other verdict auth can't change the outcome — so this skips the
  // extra child spawn and, crucially, never invokes an arbitrary on-PATH binary before we know it's Claude.
  const provisional = evaluateCliStatus({
    ...base,
    auth: { status: "unknown" },
  });
  const auth =
    provisional.kind === "ready" && resolved.path
      ? await runAuth(resolved.path)
      : { status: "unknown" as const };
  return evaluateCliStatus({ ...base, auth });
}

export interface CliStatusController {
  get(): CliStatus | null;
  recheck(): Promise<CliStatus>;
  setBinPath(path: string | null): Promise<CliStatus>;
  /** The resolved absolute binary path for spawns, or null. Always reflects the latest check. */
  resolvedPath(): string | null;
}

export interface ControllerDeps {
  settings: AppSettingsStore;
  activeConfigDir: string;
  recoveredConfigDir: string | null;
  /** Whether to probe the login shell when resolving the binary (index.ts passes `app.isPackaged`). */
  probeShell: boolean;
  now?: () => number;
}

/** Caches the verdict; recheck/setBinPath refresh it. The launch check is the first recheck(). */
export function createCliStatusController(
  deps: ControllerDeps,
): CliStatusController {
  const now = deps.now ?? ((): number => Date.now());
  let current: CliStatus | null = null;
  async function run(): Promise<CliStatus> {
    current = await checkCliStatus({
      overridePath: deps.settings.read().claudeBinPath ?? null,
      activeConfigDir: deps.activeConfigDir,
      recoveredConfigDir: deps.recoveredConfigDir,
      probeShell: deps.probeShell,
      now: now(),
    });
    return current;
  }
  return {
    get: () => current,
    recheck: run,
    setBinPath(path) {
      deps.settings.setClaudeBinPath(path);
      return run();
    },
    // Hand spawns an absolute path only when we resolved a usable Claude binary. For notFound/unknown the
    // "path" may be null, a shell-alias string, or a non-Claude binary — passing it to node-pty would spawn
    // a bogus file; null instead lets the spawn fall back to bare "claude" on the recovered PATH. Same
    // notFound/unknown predicate the renderer's spawnGate blocks on.
    resolvedPath: () =>
      current && current.kind !== "notFound" && current.kind !== "unknown"
        ? current.path
        : null,
  };
}
