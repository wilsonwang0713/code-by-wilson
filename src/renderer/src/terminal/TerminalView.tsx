import { useEffect, useRef } from "react";
import { terminalStore } from "./terminal-store-instance";

/**
 * Mounts a Managed session's kept-alive terminal into the workspace. The xterm instance lives in the
 * store across tab switches; this component only attaches its persistent wrapper into the container,
 * fits it, and reports the new size to the pty. On unmount it DETACHES the wrapper (never disposes), so
 * returning to the session restores its full scrollback — the whole point of the store.
 */
export function TerminalView({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = terminalStore.create(sessionId); // get-or-create: same instance + scrollback every time

    if (handle.wrapper.parentElement !== container) {
      container.appendChild(handle.wrapper);
    }
    if (!handle.opened) {
      handle.term.open(handle.wrapper); // one-time: build xterm's DOM inside its persistent wrapper
      handle.opened = true;
    }

    const sync = () => {
      handle.fit.fit();
      window.api.terminal.resize(sessionId, handle.term.cols, handle.term.rows);
    };
    sync();

    // The wrapper was just re-attached; the DOM viewport's scrollTop reset to 0 while xterm kept its
    // scroll position, so realign them before any wheel input reads the stale 0 and jumps to the top.
    //
    // But xterm rebuilds its scroll-area geometry on its OWN animation frame, and the fit above is a
    // no-op when the size is unchanged (the StructureDock pins the terminal to a fixed height across a
    // tab switch), so xterm never gets a resize to rebuild on. While detached the pty keeps streaming and
    // xterm records offsetHeight 0, leaving the scroll area too short. A single synchronous pin races
    // that rebuild: it's clamped against the stale area and xterm rounds it to a row above the prompt,
    // burying the bottom-most line. So capture the bottom intent NOW, kick the rebuild with an immediate
    // pin, then re-pin across the next two frames once the geometry is live and a tailing session lands
    // exactly on the prompt.
    const toBottom = handle.atBottom();
    const pin = () => handle.syncScroll(toBottom);
    pin();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(pin);
    });
    handle.term.focus();

    const ro = new ResizeObserver(sync);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      handle.wrapper.remove(); // detach, not dispose — the buffer goes back to living off-DOM in the store
    };
  }, [sessionId]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-well" />
  );
}
