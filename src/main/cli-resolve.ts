import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter as pathDelimiter, join as pathJoin } from "node:path";
import type { BinSource, InstallMethod } from "@shared/cli-status";
import { toPosixPath } from "@shared/platform";
import { resolveShellPath, probeShellEnvAsync } from "./terminal/shell-path";

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

/** Decide the absolute binary path + how we got it. Priority: override > env > shell > fallback. A real
 *  file always wins in that order, so a genuine binary (even the PATH-scan fallback) beats a shell hit that
 *  resolved to an alias/function rather than a file — without this, `claude` aliased in the user's rc would
 *  shadow the real install and read as notFound. Only when nothing resolves to a real file do we surface the
 *  shell hit (isRegularFile=false) so the UI can hint "alias/function only" instead of a bare "not found". */
export function pickBinary(i: PickBinaryInput): ResolvedBinary {
  const candidates: { path: string | null; source: BinSource }[] = [
    { path: i.overridePath, source: "override" },
    { path: i.envBin ?? null, source: "env" },
    { path: i.shellPath, source: "shell" },
    { path: i.fallbackPath, source: "fallback" },
  ];
  for (const c of candidates) {
    if (c.path && i.isFile(c.path)) {
      return {
        path: c.path,
        source: c.source,
        isRegularFile: true,
        duplicates: i.shellDuplicates,
      };
    }
  }
  // No candidate is a real file. Surface the shell hit if there was one (an alias/function-only install) as
  // isRegularFile=false, so the modal shows the alias hint rather than masking it as a bare "not found".
  if (i.shellPath) {
    return {
      path: i.shellPath,
      source: "shell",
      isRegularFile: false,
      duplicates: i.shellDuplicates,
    };
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
  const p = toPosixPath(path).toLowerCase();
  if (p.includes("/.local/bin/")) return "native";
  if (p.includes("/homebrew/") || p.includes("/cellar/")) return "homebrew";
  // "/npm" already matches the Windows global dir (…/appdata/roaming/npm/…), so no separate clause for it.
  if (p.includes("/node/") || p.includes("/.nvm/") || p.includes("/npm"))
    return "npm";
  return "unknown";
}

/** Candidate filenames for the claude binary on PATH. POSIX has the one; Windows resolves by PATHEXT,
 *  and we prefer a real `.exe` over the `.cmd`/`.ps1` npm shims (a shim can't be launched by CreateProcess
 *  without a shell — see the terminal launch layer). Pure + tested across platforms. */
export function claudeBinaryNames(
  platform: NodeJS.Platform,
  pathext?: string,
): string[] {
  if (platform !== "win32") return ["claude"];
  const order = [".exe", ".cmd", ".ps1"];
  const fromEnv = (pathext ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const exts = [...order, ...fromEnv.filter((e) => !order.includes(e))];
  return exts.map((e) => `claude${e}`);
}

/** Pure PATH scan: first dir (in PATH order) whose first matching candidate name (in `names` order) is a
 *  real file. Cross-OS via injected delimiter/join/isFile, so the Windows PATHEXT behavior is unit-tested
 *  on any host. */
export function scanPath(
  pathEnv: string,
  opts: {
    delimiter: string;
    names: string[];
    isFile: (p: string) => boolean;
    join: (dir: string, name: string) => string;
  },
): string | null {
  for (const dir of pathEnv.split(opts.delimiter)) {
    if (!dir) continue;
    for (const name of opts.names) {
      const candidate = opts.join(dir, name);
      if (opts.isFile(candidate)) return candidate;
    }
  }
  return null;
}

function isRegularFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Real wiring: resolve the binary from the persisted override, env, and (when packaged) one login-shell
 *  probe. `probeShell` mirrors index.ts's `app.isPackaged` gate — in dev the app already inherits the user's
 *  shell env, so PATH and `command -v` are authoritative and there's no reason to spawn an interactive
 *  login shell on every re-check. Untested. */
export async function resolveClaudeBinary(
  overridePath: string | null,
  probeShell: boolean,
): Promise<ResolvedBinary> {
  const env =
    probeShell && process.platform !== "win32"
      ? await probeShellEnvAsync(process.env.SHELL || "/bin/zsh")
      : null;
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
  return scanPath(pathEnv, {
    delimiter: pathDelimiter,
    names: claudeBinaryNames(process.platform, process.env.PATHEXT),
    isFile: isRegularFile,
    join: pathJoin,
  });
}
