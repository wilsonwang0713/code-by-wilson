import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import type { BinSource, InstallMethod } from "@shared/cli-status";
import { resolveShellPath, probeShellEnv } from "./terminal/shell-path";

export interface ResolvedBinary {
  path: string | null;
  source: BinSource | null;
  isRegularFile: boolean;
  duplicates: string[];
}

export interface PickBinaryInput {
  overridePath: string | null; // persisted app setting
  envBin: string | undefined; // CBW_CLAUDE_BIN
  shellPath: string | null; // command -v claude (first hit)
  shellDuplicates: string[];
  fallbackPath: string | null; // first claude found scanning shellPath dirs
  isFile: (p: string) => boolean; // injected fs check
}

/** Decide the absolute binary path + how we got it. Priority: override > env > shell > fallback. */
export function pickBinary(i: PickBinaryInput): ResolvedBinary {
  const candidates: { path: string | null; source: BinSource }[] = [
    { path: i.overridePath, source: "override" },
    { path: i.envBin ?? null, source: "env" },
    { path: i.shellPath, source: "shell" },
    { path: i.fallbackPath, source: "fallback" },
  ];
  for (const c of candidates) {
    if (!c.path) continue;
    // override/env/fallback must be a real file to win; shell wins even if not a file so an
    // alias/function surfaces as isRegularFile=false (→ notFound with an alias hint).
    const isFile = i.isFile(c.path);
    if (c.source === "shell" || isFile) {
      return {
        path: c.path,
        source: c.source,
        isRegularFile: isFile,
        duplicates: i.shellDuplicates,
      };
    }
  }
  return {
    path: null,
    source: null,
    isRegularFile: false,
    duplicates: i.shellDuplicates,
  };
}

/** Best-effort install method from the resolved path. */
export function installMethodForPath(path: string | null): InstallMethod {
  if (!path) return "unknown";
  if (path.includes("/.local/bin/")) return "native";
  if (path.includes("/homebrew/") || path.includes("/Cellar/"))
    return "homebrew";
  if (
    path.includes("/node/") ||
    path.includes("/.nvm/") ||
    path.includes("/npm")
  )
    return "npm";
  return "unknown";
}

function isRegularFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Real wiring: resolve the binary from the persisted override, env, and one login-shell probe. Untested. */
export function resolveClaudeBinary(
  overridePath: string | null,
): ResolvedBinary {
  const shell = process.env.SHELL || "/bin/zsh";
  const env = probeShellEnv(shell);
  return pickBinary({
    overridePath,
    envBin: process.env.CBW_CLAUDE_BIN,
    shellPath: env?.claudePath ?? null,
    shellDuplicates: env?.duplicates ?? [],
    fallbackPath: scanFallback(
      resolveShellPath({
        platform: process.platform,
        shell: process.env.SHELL,
        home: homedir(),
        currentPath: process.env.PATH,
        probe: () => env?.path ?? null,
      }),
    ),
    isFile: isRegularFile,
  });
}

function scanFallback(pathEnv: string): string | null {
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = `${dir}/claude`;
    if (isRegularFile(candidate)) return candidate;
  }
  return null;
}
