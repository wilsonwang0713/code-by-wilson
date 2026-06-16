import { execFileSync } from "node:child_process";
import type { CliStatus } from "@shared/cli-status";
import {
  evaluateCliStatus,
  MIN_CLAUDE_VERSION,
  type CliProbeInput,
} from "./cli-status";
import { installMethodForPath, resolveClaudeBinary } from "./cli-resolve";
import type { AppSettingsStore } from "./app-settings";

function runVersion(path: string): CliProbeInput["version"] {
  try {
    const out = execFileSync(path, ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { status: "ok", raw: out };
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ENOENT"
      ? { status: "spawnError" }
      : { status: "failed" };
  }
}

function runAuth(path: string): CliProbeInput["auth"] {
  try {
    execFileSync(path, ["auth", "status"], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return { status: "ok" }; // exit 0 → logged in
  } catch (err) {
    // Only a clean exit 1 means logged out; any other failure is "can't determine" (never cry wolf).
    return (err as { status?: number }).status === 1
      ? { status: "loggedOut" }
      : { status: "unknown" };
  }
}

/** Run the real probes and classify. `activeConfigDir`/`recoveredConfigDir` come from the startup probe. */
export function checkCliStatus(args: {
  overridePath: string | null;
  activeConfigDir: string;
  recoveredConfigDir: string | null;
  now: number;
}): CliStatus {
  const resolved = resolveClaudeBinary(args.overridePath);
  const version =
    resolved.path && resolved.isRegularFile
      ? runVersion(resolved.path)
      : { status: "spawnError" as const };
  const auth =
    version.status === "ok"
      ? runAuth(resolved.path as string)
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
  recheck(): CliStatus;
  setBinPath(path: string | null): CliStatus;
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
  function run(): CliStatus {
    current = checkCliStatus({
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
