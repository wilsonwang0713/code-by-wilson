/**
 * Lazily-built, process-wide Shiki highlighter for transcript code blocks. Uses the JS regex engine
 * (no Oniguruma WASM) and a curated language set so the renderer bundle stays small. The langs below
 * mirror LOADED_LANGS in lang.ts — keep the two in sync. `forgiving: true` keeps a grammar the JS
 * engine can't fully handle from throwing; it degrades to partial/plain highlighting instead.
 */
import {
  createHighlighterCore,
  createJavaScriptRegexEngine,
} from "react-shiki/core";

export type HighlighterInstance = Awaited<
  ReturnType<typeof createHighlighterCore>
>;

let singleton: Promise<HighlighterInstance> | null = null;

export function getHighlighter(): Promise<HighlighterInstance> {
  singleton ??= createHighlighterCore({
    themes: [import("@shikijs/themes/vitesse-dark")],
    langs: [
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/jsx"),
      import("@shikijs/langs/json"),
      import("@shikijs/langs/bash"),
      import("@shikijs/langs/python"),
      import("@shikijs/langs/diff"),
      import("@shikijs/langs/markdown"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/html"),
      import("@shikijs/langs/sql"),
      import("@shikijs/langs/go"),
      import("@shikijs/langs/rust"),
      import("@shikijs/langs/yaml"),
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return singleton;
}
