import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import type { FitLike, XtermLike } from "./terminal-store";
import { viewportScrollTop } from "./viewport-scroll";

/** xterm options tuned for the Claude TUI: generous scrollback, a dark theme matching the app's ink
 *  palette, a monospace stack, and a steady cursor. convertEol stays off — the TUI emits its own.
 *  customGlyphs + rescaleOverlappingGlyphs only take effect under a GPU renderer (see attachWebgl) —
 *  they let xterm draw block/box/quadrant art as vector shapes instead of leaning on font coverage,
 *  which is what fixes the Claude Code mascot. */
const OPTIONS = {
  scrollback: 5000,
  fontFamily:
    '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: 12,
  cursorBlink: true,
  customGlyphs: true, // draw block/box/powerline glyphs in the atlas, font-independent (default true; inert on the DOM renderer)
  rescaleOverlappingGlyphs: true, // shrink oversized fallback glyphs so they don't bleed into the next cell
  theme: { background: "#080808", foreground: "#ededee", cursor: "#2dd4bf" },
} as const;

/** Load the WebGL renderer onto an opened terminal — the renderer VSCode uses, and the one that makes
 *  customGlyphs actually fire (the DOM renderer ignores it). On context loss we dispose the addon, which
 *  reverts xterm to its built-in DOM renderer; if WebGL is unavailable at all (software GL, headless) the
 *  load throws and we keep the DOM renderer. Either way the terminal stays functional. */
function attachWebgl(term: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch {
    // No WebGL — keep the DOM renderer. Block/box art degrades to font rendering; nothing breaks.
  }
}

/** Fade the viewport scrollbar in while the user scrolls, out after a short idle beat. The thumb is
 *  transparent at rest (see index.css); toggling `is-scrolling` reveals it. Pure visual sugar, so it
 *  silently no-ops if the viewport isn't there. Lives in this seam alongside the WebGL wiring because
 *  it needs the post-open DOM. Returns a teardown that drops the listener and any pending idle timer,
 *  run from the wrapped `term.dispose` so a disposed terminal doesn't leave a timer holding the
 *  detached viewport alive. */
function attachScrollbarAutohide(parent: HTMLElement): () => void {
  const viewport = parent.querySelector(".xterm-viewport");
  if (!(viewport instanceof HTMLElement)) return () => {};
  let idle: ReturnType<typeof setTimeout> | undefined;
  const onScroll = () => {
    viewport.classList.add("is-scrolling");
    clearTimeout(idle);
    idle = setTimeout(() => viewport.classList.remove("is-scrolling"), 900);
  };
  viewport.addEventListener("scroll", onScroll);
  return () => {
    viewport.removeEventListener("scroll", onScroll);
    clearTimeout(idle);
  };
}

/**
 * Build a real xterm Terminal + FitAddon and a detached wrapper div the terminal lives in. The wrapper
 * is what moves between workspace containers on attach/detach, so the rendered DOM and buffer persist
 * across tab switches. Renderer-only (imports xterm + its CSS); kept out of the store so unit tests
 * never load the DOM-bound library.
 */
export function createXterm(): {
  term: XtermLike;
  fit: FitLike;
  wrapper: HTMLElement;
  syncScroll: () => void;
} {
  const term = new Terminal(OPTIONS);
  const fit = new FitAddon();
  term.loadAddon(fit);
  // The WebGL addon needs the canvas, which only exists after the view calls term.open(). Wrap open so
  // the renderer attaches itself right after — keeping all GPU-renderer wiring in this seam, with the
  // view and store untouched. open() is called once (guarded by handle.opened in the view).
  const open = term.open.bind(term);
  let disposeAutohide: () => void = () => {};
  term.open = (parent: HTMLElement) => {
    open(parent);
    attachWebgl(term);
    disposeAutohide = attachScrollbarAutohide(parent);
  };
  // Wrap dispose the same way as open: tear down the scroll listener/timer the autohide attached.
  // (xterm disposes loadAddon'd addons like WebGL itself; this raw DOM listener it doesn't know about.)
  const dispose = term.dispose.bind(term);
  term.dispose = () => {
    disposeAutohide();
    dispose();
  };
  const wrapper = document.createElement("div");
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  // Re-attaching the wrapper on a tab switch resets the DOM viewport's scrollTop to 0 while xterm keeps
  // its scroll position, so the first wheel tick would otherwise read the stale 0 and jump to the top
  // (round(0/rowHeight) - viewportY lines up). Re-derive scrollTop from the live buffer's viewportY to
  // close that gap. No-ops before open() (no viewport yet) and on the DOM-renderer fallback if the
  // element is missing; harmless on a fresh terminal (viewportY 0 → scrollTop 0).
  const syncScroll = () => {
    const viewport = wrapper.querySelector(".xterm-viewport");
    if (!(viewport instanceof HTMLElement)) return;
    const buf = term.buffer.active;
    viewport.scrollTop = viewportScrollTop(
      buf.viewportY,
      buf.length,
      viewport.scrollHeight,
    );
  };
  return { term: term, fit, wrapper, syncScroll };
}
