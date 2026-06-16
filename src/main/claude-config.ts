import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Resolve the Claude config dir: an explicit override, else `CLAUDE_CONFIG_DIR`, else a dir recovered
 *  from the login shell (a Finder-launched .app doesn't inherit a rc-set CLAUDE_CONFIG_DIR), else
 *  `~/.claude`. The single place this decision lives so the provider and settings manager never disagree. */
export function resolveClaudeDir(
  override?: string,
  recovered?: string | null,
): string {
  return (
    override ??
    process.env.CLAUDE_CONFIG_DIR ??
    (recovered || undefined) ??
    join(homedir(), ".claude")
  );
}

/** Read a file, returning null only when it is genuinely absent (ENOENT). Any other error — a real read
 *  failure (EACCES, EISDIR, ENOTDIR) — surfaces, so it can never masquerade as "the file isn't there". */
export function readTextOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
