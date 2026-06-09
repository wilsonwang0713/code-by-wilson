import type { ModelId } from './models'
import type { Session } from './types'

/** Terminal IPC channels. `data` and `exit` are PUSH channels (main → renderer via webContents.send);
 *  the rest are renderer-initiated (invoke for a reply, send for fire-and-forget). */
export const TERMINAL = {
  spawn: 'terminal:spawn',
  write: 'terminal:write',
  resize: 'terminal:resize',
  ack: 'terminal:ack',
  kill: 'terminal:kill',
  pickDirectory: 'terminal:pick-directory',
  data: 'terminal:data',
  exit: 'terminal:exit',
} as const

/**
 * Renderer→pty backpressure tunables, mirroring VSCode's FlowControlConstants (scaled). The pty host
 * pauses node-pty once `highWaterChars` are in flight unacknowledged and resumes once the backlog
 * drains below `lowWaterChars`; the renderer acks consumed output in `ackChars` chunks (one IPC per
 * chunk, not per write), each ack tied to xterm finishing its write so credit reflects render speed.
 */
export const FLOW = { highWaterChars: 100_000, lowWaterChars: 5_000, ackChars: 5_000 } as const

export interface SpawnRequest {
  /** Absolute project directory the session runs in. */
  cwd: string
  model: ModelId
  /** Initial terminal size; the renderer's first fit corrects it. */
  cols: number
  rows: number
}

/**
 * The Managed-terminal control + push surface, exposed on `window.api.terminal`. Spawning returns an
 * optimistic Managed draft Session the renderer shows until discovery indexes the real process.
 */
export interface TerminalApi {
  spawn(req: SpawnRequest): Promise<Session>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  ack(id: string, charCount: number): void
  kill(id: string): void
  /** Open a native directory picker; resolves to the chosen path, or null if cancelled. */
  pickDirectory(): Promise<string | null>
  /** Subscribe to batched output for ANY Managed session (the chunk carries its id). Returns unsubscribe. */
  onData(cb: (id: string, data: string) => void): () => void
  /** Subscribe to process-exit for ANY Managed session. Returns unsubscribe. */
  onExit(cb: (id: string, exitCode: number) => void): () => void
}
