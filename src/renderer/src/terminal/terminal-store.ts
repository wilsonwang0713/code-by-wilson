/// <reference lib="dom" />
import { FLOW, type TerminalApi } from '@shared/terminal'

/** The xterm surface the store and the view actually use. Declared structurally so a real
 *  `@xterm/xterm` Terminal satisfies it AND a test fake can stand in without loading xterm. */
export interface XtermLike {
  write(data: string, callback?: () => void): void
  onData(cb: (data: string) => void): { dispose(): void }
  dispose(): void
  open(element: HTMLElement): void
  focus(): void
  loadAddon(addon: unknown): void
  resize(cols: number, rows: number): void
  readonly cols: number
  readonly rows: number
}

/** The fit addon surface the view uses. Real `@xterm/addon-fit` FitAddon satisfies it. */
export interface FitLike {
  fit(): void
  proposeDimensions(): { cols: number; rows: number } | undefined
}

/** One live terminal: the xterm instance, its fit addon, and a persistent wrapper div that moves
 *  between containers on attach/detach. `opened` guards the one-time `term.open`. On process exit the
 *  buffer is kept (the dim '[process exited]' line marks the end), so no separate flag is needed. */
export interface TerminalHandle {
  term: XtermLike
  fit: FitLike
  wrapper: HTMLElement
  opened: boolean
  /** The keystroke→pty subscription, kept so `rename` can rebind it to a new id (a `/clear` rotation). */
  inputSub: { dispose(): void }
}

export interface TerminalStoreDeps {
  api: TerminalApi
  /** Build a fresh xterm + fit + wrapper. Injected so the store is testable without a real DOM. */
  createTerminal: () => { term: XtermLike; fit: FitLike; wrapper: HTMLElement }
}

export interface TerminalStore {
  /** Get-or-create the handle for `id`. Idempotent: the same xterm instance (and its scrollback)
   *  survives every tab switch until `dispose`. */
  create(id: string): TerminalHandle
  get(id: string): TerminalHandle | undefined
  /** Re-key a live terminal from `from` to `to` (a `/clear` rotation), so pushed output and the user's
   *  keystrokes follow the rotated session id onto the SAME xterm — no flicker, scrollback intact. No-op
   *  if `from` has no handle or `to` is already taken. */
  rename(from: string, to: string): void
  /** Close a terminal for good: dispose the xterm and forget the id. */
  dispose(id: string): void
}

/**
 * Holds every Managed terminal alive for the app's lifetime. A single multiplexed subscription to the
 * push channels routes each chunk to its handle by id — so output keeps filling a terminal's buffer
 * even while its DOM is detached (the basis of lossless tab switching). Each xterm write carries an ack
 * callback; when xterm finishes parsing, the consumed chars are credited back to the pty, batched into
 * FLOW.ackChars messages so it's not one IPC per write. This is VSCode's ack-on-xterm-parse loop,
 * scaled down.
 */
export function createTerminalStore({ api, createTerminal }: TerminalStoreDeps): TerminalStore {
  const handles = new Map<string, TerminalHandle>()
  const pendingAck = new Map<string, number>() // consumed-but-unsent ack chars, per id

  function ackConsumed(id: string, n: number): void {
    if (!handles.has(id)) return // terminal already disposed — drop the late ack, don't resurrect state
    let pending = (pendingAck.get(id) ?? 0) + n
    while (pending >= FLOW.ackChars) {
      api.ack(id, FLOW.ackChars)
      pending -= FLOW.ackChars
    }
    pendingAck.set(id, pending)
  }

  // Subscribe ONCE, at construction — the singleton is built at app startup — so the multiplexed
  // routing is live before any session spawns.
  api.onData((id, data) => {
    const h = handles.get(id)
    // No handle for this id (already disposed, or a stray after teardown): we can't render it, but the
    // manager already counted these chars as unacked, so ack them straight back. Dropping them silently
    // would leak flow-control credit and could wedge a paused pty (see FLOW's invariant).
    if (!h) {
      api.ack(id, data.length)
      return
    }
    h.term.write(data, () => ackConsumed(id, data.length))
  })
  api.onExit((id, code) => {
    const h = handles.get(id)
    if (!h) return
    // Keep the scrollback; just mark the end inline (dim).
    h.term.write(`\r\n\x1b[2m[process exited${code ? ` (${code})` : ''}]\x1b[0m\r\n`)
  })

  return {
    create(id) {
      const existing = handles.get(id)
      if (existing) return existing
      const { term, fit, wrapper } = createTerminal()
      const inputSub = term.onData((data) => api.write(id, data)) // user keystrokes → pty (independent of DOM attach)
      const handle: TerminalHandle = { term, fit, wrapper, opened: false, inputSub }
      handles.set(id, handle)
      return handle
    },
    get: (id) => handles.get(id),
    rename(from, to) {
      if (from === to) return
      const h = handles.get(from)
      if (!h || handles.has(to)) return // unknown source, or target already in use → no-op
      handles.delete(from)
      handles.set(to, h)
      const pend = pendingAck.get(from)
      pendingAck.delete(from)
      if (pend !== undefined) pendingAck.set(to, pend)
      // Rebind keystrokes to the new id; the old closure captured `from`.
      h.inputSub.dispose()
      h.inputSub = h.term.onData((data) => api.write(to, data))
    },
    dispose(id) {
      const h = handles.get(id)
      if (!h) return
      h.term.dispose()
      handles.delete(id)
      pendingAck.delete(id)
    },
  }
}
