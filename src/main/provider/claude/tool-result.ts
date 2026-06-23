import type { ToolResultDetail } from "@shared/transcript";
import { toolResultText } from "./transcript-row";

/** The full invocation text for the modal's command bar: the most-telling input field, untruncated,
 *  else the pretty-printed input object. Lives in claude/ where no-unsafe-* is warn (transcript JSON
 *  is `any`). */
function primaryInputField(input: unknown): string {
  const obj =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  for (const key of ["command", "file_path", "path", "pattern", "url"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "";
  }
}

/**
 * Pull one tool call's full detail out of already-parsed transcript rows: its command (from the
 * tool_use block) and its output + error flag (from the matching tool_result, in a later user row).
 * `found: false` when no tool_use carries the id (a moved/rewritten transcript). A matched tool with no
 * result yet returns empty output, so a still-running call still opens. Pure — unit-tested without IO.
 */
export function extractToolResult(
  rows: any[],
  toolUseId: string,
): ToolResultDetail {
  let command: string | null = null;
  let output = "";
  let isError = false;
  for (const row of rows) {
    const content = row?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === "tool_use" && b?.id === toolUseId) {
        command = primaryInputField(b.input);
      } else if (b?.type === "tool_result" && b?.tool_use_id === toolUseId) {
        output = toolResultText(b.content);
        isError = b.is_error === true;
      }
    }
  }
  if (command === null) return { found: false };
  return { found: true, command, output, isError };
}
