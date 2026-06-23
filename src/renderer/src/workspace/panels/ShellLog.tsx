import type { ShellOutput } from "@shared/types";
import { truncLabel } from "./shell-view";
import { AnsiLine } from "./AnsiLine";

/** A shell's full output: a source banner (live vs snapshot), an optional truncation note, then the log
 *  rendered with ANSI color. A pure renderer of the `output` it's handed (the poll lives in the hook). */
export function ShellLog({
  output,
}: {
  output: ShellOutput | null | undefined;
}) {
  // null = read and the shell has no captured output; undefined = the first poll is still in flight.
  // Both render a faint centered line rather than the log surface, so the banner below never has to
  // guess a source (the old `output?.source` mislabelled the in-flight state as "snapshot").
  if (output == null)
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-fg-faint">
        {output === null
          ? "No output captured for this shell."
          : "Reading output…"}
      </div>
    );
  const trunc = truncLabel(output.truncatedBytes);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-ink-850 px-4 py-1.5 text-[10px] uppercase tracking-wider">
        <span
          className={
            output.source === "live" ? "text-primary" : "text-fg-faint"
          }
        >
          {output.source === "live" ? "● live output" : "snapshot"}
        </span>
        {trunc && <span className="ml-auto text-accent">{trunc}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-well p-4 font-mono text-[11px] leading-relaxed text-fg-muted">
        {output.text.split("\n").map((line, i) => (
          <AnsiLine key={i} text={line} />
        ))}
      </div>
    </div>
  );
}
