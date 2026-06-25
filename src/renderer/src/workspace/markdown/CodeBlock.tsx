import { useEffect, useState } from "react";
import ShikiHighlighter from "react-shiki/core";
import { CopyButton } from "./CopyButton";
import { getHighlighter, type HighlighterInstance } from "./highlighter";

/**
 * One fenced code block. Highlights with the shared Shiki singleton on the sunken well background,
 * with a hover-revealed copy button (top-right). While the singleton is still loading it shows the
 * raw code in a plain pre, so first paint never blocks. The `[&_pre]:*` variants force the generated
 * Shiki <pre> onto our well background and padding regardless of the theme's own styling.
 */
const SURFACE =
  "group/code relative my-2.5 overflow-hidden rounded-lg border border-ink-800";
const PRE_RESET =
  "[&_pre]:!m-0 [&_pre]:!bg-well [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-relaxed";
const COPY =
  "absolute right-1.5 top-1.5 opacity-0 group-hover/code:opacity-100";

export function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [hl, setHl] = useState<HighlighterInstance | null>(null);

  useEffect(() => {
    let alive = true;
    void getHighlighter().then((h) => {
      if (alive) setHl(h);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={`${SURFACE} ${PRE_RESET}`}>
      <CopyButton text={code} label="Copy" className={COPY} />
      {hl ? (
        <ShikiHighlighter
          highlighter={hl}
          language={language}
          theme="vitesse-dark"
        >
          {code}
        </ShikiHighlighter>
      ) : (
        <pre className="overflow-x-auto bg-well p-3 font-mono text-[12px] leading-relaxed text-fg">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
