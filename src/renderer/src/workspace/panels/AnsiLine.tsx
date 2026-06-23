import { ansiToSpans } from "./ansi-to-html";
import { ansiClass } from "./shell-view";
import { cx } from "../../ui/atoms";

/** Render one line's ANSI spans into colored <span>s. Shared by the shell log and the tool-result modal
 *  so a command's own colors come through identically in both. An empty line renders a single space so
 *  it still occupies a row. */
export function AnsiLine({ text }: { text: string }) {
  const spans = ansiToSpans(text);
  return (
    <div className="whitespace-pre-wrap break-words">
      {spans.length === 0
        ? " "
        : spans.map((s, i) => (
            <span
              key={i}
              className={cx(
                s.fg && ansiClass(s.fg, s.bright),
                s.bold && "font-semibold",
                s.dim && "opacity-60",
              )}
            >
              {s.text}
            </span>
          ))}
    </div>
  );
}
