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
      timeout: 5_000,
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
    });
    return { status: "ok" }; // exit 0 → logged in
  } catch (err) {
    return classifyAuthError((err as { code?: unknown }).code);
  }
}

/** Run the real probes and classify. `activeConfigDir`/`recoveredConfigDir` come from the startup probe. */
export async function checkCliStatus(args: {
  overridePath: string | null;
  activeConfigDir: string;
  recoveredConfigDir: string | null;
  now: number;
}): Promise<CliStatus> {
  const resolved = await resolveClaudeBinary(args.overridePath);
  const version =
    resolved.path && resolved.isRegularFile
      ? await runVersion(resolved.path)
      : { status: "spawnError" as const };
  const auth =
    version.status === "ok"
      ? await runAuth(resolved.path as string)
      : { status: "unknown" as const };
  return evaluateCliStatus({
    path: resolved.path,
    source: resolved.source,
    isRegularFile: resolved.isRegularFile,
    duplicates: resolved.duplicates,
    version,
    auth,
    floor: MIN_CLAUDE_VERSION,
    installMethod: installMethodForPath(resolved.path),
    configDir: {
      active: args.activeConfigDir,
      recovered: args.recoveredConfigDir,
    },
    now: args.now,
  });
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
    resolvedPath: () => current?.path ?? null,
  };
}
