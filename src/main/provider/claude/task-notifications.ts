// src/main/provider/claude/task-notifications.ts
// Shared readers for the harness's <task-notification> rows and the byte-bounded output tail. Used by
// both the shell and monitor reconstructors (both consume `any` transcript rows).

/** Read a single tag's text out of a <task-notification> body. */
export function tag(body: string, name: string): string | undefined {
  const m = body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : undefined;
}

/** The <task-notification> body a row carries, from either shape the CLI records it as. The real shape
 *  is an `attachment` row whose commandMode marks it a task-notification, with the body in
 *  `attachment.prompt`; a queue-operation row carries the same text as a string `content`. "" when the
 *  row is neither — so a notification is detected regardless of how the transcript framed it. */
export function notificationBody(row: any): string {
  const att = row?.attachment;
  if (
    att?.commandMode === "task-notification" &&
    typeof att.prompt === "string"
  )
    return att.prompt;
  if (row?.type === "queue-operation" && typeof row?.content === "string")
    return row.content;
  return "";
}

/** Default tail cap: the last 256 KB of a log. Bounds the IPC payload; the renderer labels the drop. */
const MAX_OUTPUT_BYTES = 256 * 1024;

/** Keep the last `maxBytes` bytes of `text`, reporting how many were dropped (0 when none). A multibyte
 *  char split at the cut is tolerated — the tail's first line is already partial when truncated. */
export function tailOutput(
  text: string,
  maxBytes = MAX_OUTPUT_BYTES,
): { text: string; truncatedBytes: number } {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return { text, truncatedBytes: 0 };
  const kept = buf.subarray(buf.length - maxBytes);
  return { text: kept.toString("utf8"), truncatedBytes: buf.length - maxBytes };
}
