import type { IconName } from "../ui/icon-names";

/** Per-tool glyph for the transcript tool row. Only tools that reach the generic tool row are listed
 *  (Edit/Write render as diffs, Task/Agent as subagent dispatches). Unknown tools fall back to the
 *  terminal glyph. JSX-free so the node program (tests) can import it. */
const TOOL_ICONS: Record<string, IconName> = {
  Bash: "terminal",
  Read: "code",
  Grep: "search",
  Glob: "search",
  WebFetch: "globe",
  WebSearch: "globe",
};

export function toolIcon(name: string): IconName {
  return TOOL_ICONS[name] ?? "terminal";
}
