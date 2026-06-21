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

/** Build VS Code's "open this path" URL: `vscode://file<absolutePath>` is the scheme VS Code registers.
 *  We encode segment by segment (spaces, `#`, `?`, unicode all become safe) and keep `/` literal. We avoid
 *  `pathToFileURL` on purpose: it resolves a drive-less path against the process's current drive on Windows,
 *  so the same input would yield a different URL depending on the host. This keeps `vscodeUrl` a pure
 *  function of its argument. A leading Windows drive letter's colon is restored — VS Code wants it raw. */
export function vscodeUrl(cwd: string): string {
  const path = cwd
    .replace(/\\/g, "/")
    .split("/")
    .map(encodeURIComponent)
    .join("/")
    .replace(/^\/?([A-Za-z])%3A\//, "/$1:/");
  return `vscode://file${path.startsWith("/") ? path : `/${path}`}`;
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
