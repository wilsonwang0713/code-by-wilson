import { pathToFileURL } from "node:url";
import {
  OPEN_IN_FAILED_MESSAGE,
  type OpenInTarget,
  type OpenInResult,
} from "@shared/ipc";

/** The slice of Electron's `shell` openIn needs. Narrowed to an interface so tests can inject a spy. */
export interface OpenInShell {
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<string>;
}

export interface OpenInDeps {
  /** Resolve a session's working directory from its id, or null when none can be found. */
  resolveCwd: (id: string) => string | null;
  /** True when `path` is an existing directory. */
  statDir: (path: string) => boolean;
  shell: OpenInShell;
}

/** Build VS Code's "open this path" URL. `pathToFileURL` percent-encodes spaces and other unsafe chars;
 *  its pathname is the absolute path, and `vscode://file<absolutePath>` is the scheme VS Code registers. */
export function vscodeUrl(cwd: string): string {
  return `vscode://file${pathToFileURL(cwd).pathname}`;
}

/** Resolve the session's folder and open it in `target`. Never throws: every failure is an
 *  `{ ok: false, error }` the renderer can surface. The path is resolved and validated here, so the
 *  renderer never supplies or sees a filesystem path. */
export async function openInTarget(
  deps: OpenInDeps,
  id: string,
  target: OpenInTarget,
): Promise<OpenInResult> {
  const cwd = deps.resolveCwd(id);
  if (!cwd) return { ok: false, error: "No folder found for this session." };
  if (!deps.statDir(cwd))
    return { ok: false, error: "Folder no longer exists." };
  try {
    switch (target) {
      case "finder": {
        const err = await deps.shell.openPath(cwd);
        return err ? { ok: false, error: err } : { ok: true };
      }
      case "vscode": {
        await deps.shell.openExternal(vscodeUrl(cwd));
        return { ok: true };
      }
      default: {
        // Unreachable for a well-typed OpenInTarget; the `never` assignment makes a new target a compile
        // error here rather than a silent fall-through to one of the branches. At the IPC boundary, where
        // a buggy renderer could send anything, this turns a bad value into an honest failure.
        const unknown: never = target;
        return { ok: false, error: `Unknown target: ${String(unknown)}` };
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : OPEN_IN_FAILED_MESSAGE,
    };
  }
}
