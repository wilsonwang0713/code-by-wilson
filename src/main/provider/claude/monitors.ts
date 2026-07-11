// src/main/provider/claude/monitors.ts
import type { Monitor, MonitorStatus } from "@shared/types";
import { notificationBody, tag } from "./task-notifications";

/** Reconstruction output: the renderer-facing monitor plus the absolute `.output` path (captured from the
 *  terminal "stream ended" notification) the provider reads on drill. "" until a terminal notification
 *  lands — stripped before the list crosses IPC. */
export interface MonitorRecord extends Monitor {
  outputFile: string;
}

/** The renderer-facing view of a reconstructed monitor: every field except the server-only `.output`
 *  path, which never crosses IPC (the log is read separately via readMonitorOutput). */
export function toMonitor(record: MonitorRecord): Monitor {
  const monitor: Partial<MonitorRecord> = { ...record };
  delete monitor.outputFile;
  return monitor as Monitor;
}

/** A Monitor tool_use, keyed by its tool_use id. */
interface MonitorUse {
  command: string;
  description?: string;
}

/** Map a terminal notification's <status> to a MonitorStatus. An unknown value reads as completed — the
 *  stream ended either way. */
function toStatus(raw: string | undefined): MonitorStatus {
  return raw === "failed"
    ? "failed"
    : raw === "killed"
      ? "killed"
      : raw === "stopped"
        ? "stopped"
        : "completed";
}

/**
 * Reconstruct the monitor list from the main transcript rows. Pure: same rows, same output. A monitor is
 * discriminated by a start tool_result whose `toolUseResult` carries `taskId` + `persistent` AND whose
 * tool_use_id is a known Monitor tool_use — so a Bash background shell (`backgroundTaskId`) or a subagent
 * dispatch (Agent/Task) can never appear. Status/duration/output-path come from the terminal <status>
 * notification; a monitor with no terminal notification stays running. Ordered by start time.
 */
export function reconstructMonitors(rows: any[]): MonitorRecord[] {
  const monitorUses = new Map<string, MonitorUse>();
  // First pass: index Monitor tool_uses (the command source + the scope guard).
  for (const row of rows) {
    const content = row?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type !== "tool_use" || typeof b.id !== "string") continue;
      if (b.name === "Monitor" && typeof b.input?.command === "string") {
        const use: MonitorUse = { command: b.input.command };
        if (typeof b.input.description === "string" && b.input.description)
          use.description = b.input.description;
        monitorUses.set(b.id, use);
      }
    }
  }

  // Second pass: every Monitor start becomes a record (running until a terminal notification updates it).
  const byId = new Map<string, MonitorRecord>();
  for (const row of rows) {
    const tur = row?.toolUseResult;
    if (typeof tur?.taskId !== "string" || tur.persistent === undefined)
      continue;
    const content = row?.message?.content;
    const result = Array.isArray(content)
      ? content.find((b) => b?.type === "tool_result")
      : undefined;
    const tuid = result?.tool_use_id;
    const use = typeof tuid === "string" ? monitorUses.get(tuid) : undefined;
    if (!use) continue; // not a Monitor-originated task (shell/subagent guard)
    if (byId.has(tur.taskId)) continue; // first start wins (duplicate rows)
    const startMs = Date.parse(row?.timestamp);
    const rec: MonitorRecord = {
      id: tur.taskId,
      command: use.command,
      status: "running",
      persistent: Boolean(tur.persistent),
      timeoutMs: typeof tur.timeoutMs === "number" ? tur.timeoutMs : 0,
      outputFile: "",
    };
    if (use.description) rec.description = use.description;
    if (Number.isFinite(startMs)) rec.startMs = startMs;
    byId.set(tur.taskId, rec);
  }

  // Third pass: the terminal notification (the one carrying <status>) sets status + duration + output
  // path, scoped to known ids. The first terminal notification wins — later duplicates are ignored, so a
  // repeated terminal notification can't re-stamp the duration. Event notifications (no <status>) are
  // skipped here; their bodies feed stitchMonitorEvents instead.
  for (const row of rows) {
    const body = notificationBody(row);
    if (!body.includes("<task-notification>")) continue;
    const id = tag(body, "task-id");
    if (!id) continue;
    const rec = byId.get(id);
    if (!rec || rec.status !== "running") continue; // unknown id, or already terminal
    const status = tag(body, "status");
    if (!status) continue; // an event notification, not the terminal one
    rec.status = toStatus(status);
    const out = tag(body, "output-file");
    if (out) rec.outputFile = out;
    const endMs = Date.parse(row?.timestamp);
    if (Number.isFinite(endMs) && rec.startMs !== undefined)
      rec.durationMs = endMs - rec.startMs;
  }

  return [...byId.values()].sort(
    (a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity),
  );
}

/** Stitch a monitor's streamed output from its event notifications, in transcript order — the fallback
 *  when the `.output` file is gone (ephemeral tmp) or not yet known (still running). Drops an event equal
 *  to the immediately preceding one, since the transcript repeats event bodies verbatim. */
export function stitchMonitorEvents(rows: any[], monitorId: string): string {
  const events: string[] = [];
  for (const row of rows) {
    const body = notificationBody(row);
    if (!body.includes("<task-notification>")) continue;
    if (tag(body, "task-id") !== monitorId) continue;
    const event = tag(body, "event");
    if (event === undefined) continue; // terminal / non-event notification
    if (events.length > 0 && events[events.length - 1] === event) continue;
    events.push(event);
  }
  return events.join("\n");
}
