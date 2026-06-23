import type { ToolResultDetail } from "@shared/transcript";
import { toolResultText, tellingField } from "./transcript-row";

/** The full invocation text for the modal's command bar: the most-telling input field, untruncated,
 *  else the pretty-printed input object. Shares the field list with the row's input summary
 *  (see tellingField) so the row and the command bar can't name a tool by different fields. Lives in
 *  claude/ where no-unsafe-* is warn (transcript JSON is `any`). */
function primaryInputField(input: unknown): string {
  const obj =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const field = tellingField(obj);
  if (field !== null) return field;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "";
  }
}

/**
 * Pull one tool call's full detail out of already-parsed transcript rows: its command (from the
 * tool_use block) and its output + status (from the matching tool_result, in a later user row).
 * `found: false` when no tool_use carries the id (a moved/rewritten transcript). A matched tool whose
 * result hasn't landed yet is `status: "pending"` with empty output, so a still-running call still opens
 * — and the modal can tell that apart from a finished call with no output. Read fresh on every fetch, so
 * the status is the on-disk truth, not the (possibly stale) row event. Pure — unit-tested without IO.
 */
export function extractToolResult(
  rows: any[],
  toolUseId: string,
): ToolResultDetail {
  let command: string | null = null;
  let output = "";
  let status: "ok" | "error" | "pending" = "pending";
  for (const row of rows) {
    const content = row?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === "tool_use" && b?.id === toolUseId) {
        command = primaryInputField(b.input);
      } else if (b?.type === "tool_result" && b?.tool_use_id === toolUseId) {
        output = toolResultText(b.content);
        status = b.is_error === true ? "error" : "ok";
      }
    }
  }
  if (command === null) return { found: false };
  return { found: true, command, output, status };
}
