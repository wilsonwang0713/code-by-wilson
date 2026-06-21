import { statSync } from "node:fs";

/** True when `path` is an existing directory. Every stat failure (missing, not a dir, EACCES) collapses to
 *  `false` — the single "not a usable directory" answer the terminal spawn guard and the Open-in handler
 *  both want, so neither has to re-derive it. */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
