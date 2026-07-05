/** Shell-terminal IPC channels — a SEPARATE namespace from the Managed `terminal:*` channels.
 *  Sharing those would double-ack: the managed terminal-store acks any unknown-id chunk straight
 *  back (terminal-store.ts) to keep a paused pty from wedging, so shell chunks riding the same
 *  channel would be credited twice and corrupt the flow-control ledger. `data` and `exit` are PUSH
 *  channels (main → renderer via webContents.send); the rest are renderer-initiated. */
export const SHELL_TERMINAL = {
  spawn: "shellterm:spawn",
  write: "shellterm:write",
  resize: "shellterm:resize",
  ack: "shellterm:ack",
  kill: "shellterm:kill",
  data: "shellterm:data",
  exit: "shellterm:exit",
} as const;

/** Spawn a plain interactive shell. The renderer mints `id` (newSessionId()) and registers its
 *  router handler BEFORE invoking, so the very first pty bytes land on a live handler — the same
 *  race-free ordering the Managed spawn uses. `cwd` is a request; main resolves it leniently
 *  (file → dirname, invalid → home) and echoes the resolved dir back. */
export interface ShellSpawnRequest {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
}

/** `shell` is the resolved shell's basename (e.g. "zsh", "pwsh") — the tab's auto label. */
export interface ShellSpawnResult {
  cwd: string;
  shell: string;
}

/** The shell-terminal surface on `window.api.shellTerminal`. Same wire conventions as the Managed
 *  TerminalApi: write/resize/ack/kill are fire-and-forget sends; onData carries the cumulative
 *  output offset (unused here — no reattach — but kept so both surfaces share one push shape);
 *  the on* subscriptions return unsubscribe functions. */
export interface ShellTerminalApi {
  spawn(req: ShellSpawnRequest): Promise<ShellSpawnResult>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  ack(id: string, charCount: number): void;
  kill(id: string): void;
  onData(cb: (id: string, data: string, offset: number) => void): () => void;
  onExit(cb: (id: string, exitCode: number) => void): () => void;
}
