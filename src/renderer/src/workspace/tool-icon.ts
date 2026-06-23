import type { IconName } from "../ui/icon-names";

/** Per-tool glyph for the transcript tool row and diff row. Task/Agent render as subagent dispatches
 *  and are not listed here. Unknown tools fall back to the terminal glyph. JSX-free so the node
 *  program (tests) can import it. */
const TOOL_ICONS: Record<string, IconName> = {
  Bash: "terminal",
  Read: "code",
  Edit: "pencil",
  Write: "pencil",
  MultiEdit: "pencil",
  Grep: "search",
  Glob: "search",
  WebFetch: "globe",
  WebSearch: "globe",
};

export function toolIcon(name: string): IconName {
  return TOOL_ICONS[name] ?? "terminal";
}
