export interface ChildEnvInput {
  /** The app's own env, normally `process.env`. */
  baseEnv: NodeJS.ProcessEnv;
  /** The resolved Claude config dir — the single source of truth the readers also use. */
  claudeDir: string;
  /** Corrected PATH for a packaged .app (so a Finder launch can find `claude`); null in dev to
   *  leave the inherited PATH untouched. */
  correctedPath: string | null;
}

/** Env for every spawned/resumed `claude` session. Pins CLAUDE_CONFIG_DIR to `claudeDir` so sessions
 *  write to the same dir the app reads from (no split brain), and overrides PATH only when a corrected
 *  one is supplied. Pure (no I/O), so it's unit-tested directly. */
export function buildChildEnv(i: ChildEnvInput): NodeJS.ProcessEnv {
  return {
    ...i.baseEnv,
    CLAUDE_CONFIG_DIR: i.claudeDir,
    ...(i.correctedPath !== null ? { PATH: i.correctedPath } : {}),
  };
}
