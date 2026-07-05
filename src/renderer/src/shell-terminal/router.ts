import { FLOW } from "@shared/terminal";
import type { ShellTerminalApi } from "@shared/shell-terminal";

export interface ShellRouterHandlers {
  onData(data: string): void;
  onExit(exitCode: number): void;
}

export interface ShellRouter {
  /** Route this id's chunks/exit to `handlers`. Returns unregister. Register BEFORE spawning the
   *  pty (the renderer mints the id), so the very first bytes land on a live handler. */
  register(id: string, handlers: ShellRouterHandlers): () => void;
  /** Credit consumed output back to the pty, batched into FLOW.ackChars messages (one IPC per
   *  batch, not per write) — VSCode's ack-on-xterm-parse loop, same shape as terminal-store. */
  ackConsumed(id: string, charCount: number): void;
}

/**
 * ONE module-level subscription multiplexes shellterm data/exit to per-tab handlers by id. The
 * stray-id ack-back below must live in exactly one place: per-instance filtering would leave a
 * just-closed tab's in-flight chunks unacked, leaking flow-control credit — and a paused pty whose
 * credit never drains below the resume line wedges forever (FLOW's invariant).
 */
export function createShellRouter(
  api: Pick<ShellTerminalApi, "onData" | "onExit" | "ack">,
): ShellRouter {
  const handlers = new Map<string, ShellRouterHandlers>();
  const pendingAck = new Map<string, number>();

  api.onData((id, data) => {
    const h = handlers.get(id);
    if (!h) {
      api.ack(id, data.length);
      return;
    }
    h.onData(data);
  });
  api.onExit((id, code) => handlers.get(id)?.onExit(code));

  return {
    register(id, h) {
      handlers.set(id, h);
      return () => {
        if (handlers.get(id) === h) {
          handlers.delete(id);
          pendingAck.delete(id);
        }
      };
    },
    ackConsumed(id, charCount) {
      if (!handlers.has(id)) return; // tab closed — drop the late ack, don't resurrect state
      let pending = (pendingAck.get(id) ?? 0) + charCount;
      while (pending >= FLOW.ackChars) {
        api.ack(id, FLOW.ackChars);
        pending -= FLOW.ackChars;
      }
      pendingAck.set(id, pending);
    },
  };
}
