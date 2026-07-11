// tests/provider/monitors.test.ts
import { describe, it, expect } from "vitest";
import {
  reconstructMonitors,
  stitchMonitorEvents,
  toMonitor,
} from "../../src/main/provider/claude/monitors";

const TASKS = "/tmp/claude/proj/sess/tasks";

/** A Monitor tool_use (assistant row). */
const monitorUse = (
  tuid: string,
  command: string,
  opts: { description?: string } = {},
) => ({
  type: "assistant",
  timestamp: "2026-06-11T00:00:00.000Z",
  message: {
    id: `m-${tuid}`,
    content: [
      {
        type: "tool_use",
        id: tuid,
        name: "Monitor",
        input: { command, ...opts },
      },
    ],
  },
});

/** The Monitor start tool_result (user row): toolUseResult carries taskId/timeoutMs/persistent. */
const startResult = (
  tuid: string,
  taskId: string,
  ts: string,
  extra: Record<string, unknown> = {},
) => ({
  type: "user",
  timestamp: ts,
  message: {
    content: [
      {
        type: "tool_result",
        tool_use_id: tuid,
        content: `Monitor started (task ${taskId}, timeout 300000ms). You will be notified on each event.`,
      },
    ],
  },
  toolUseResult: { taskId, timeoutMs: 300000, persistent: false, ...extra },
});

/** An event notification (attachment shape): summary + <event>, NO <status>. */
const eventNotification = (id: string, ts: string, event: string) => ({
  type: "attachment",
  timestamp: ts,
  attachment: {
    commandMode: "task-notification",
    type: "queued_command",
    prompt: `<task-notification>\n<task-id>${id}</task-id>\n<summary>Monitor event: "watch"</summary>\n<event>${event}</event>\n</task-notification>`,
  },
});

/** The terminal "stream ended" notification: <status> + <output-file> + <tool-use-id>. */
const terminalNotification = (
  id: string,
  tuid: string,
  ts: string,
  status = "completed",
  outputFile = `${TASKS}/${id}.output`,
) => ({
  type: "attachment",
  timestamp: ts,
  attachment: {
    commandMode: "task-notification",
    type: "queued_command",
    prompt: `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>${tuid}</tool-use-id>\n<output-file>${outputFile}</output-file>\n<status>${status}</status>\n<summary>Monitor "watch" stream ended</summary>\n</task-notification>`,
  },
});

describe("reconstructMonitors", () => {
  it("detects a running monitor (start, no terminal notification yet)", () => {
    const rows = [
      monitorUse("t1", "until … done", { description: "poll CI" }),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
      eventNotification("b1", "2026-06-11T00:00:05.000Z", "draft: success"),
    ];
    expect(reconstructMonitors(rows)).toEqual([
      {
        id: "b1",
        command: "until … done",
        description: "poll CI",
        status: "running",
        persistent: false,
        timeoutMs: 300000,
        startMs: Date.parse("2026-06-11T00:00:01.000Z"),
        outputFile: "",
      },
    ]);
  });

  it("derives completed + duration + output-file from the terminal notification", () => {
    const rows = [
      monitorUse("t1", "c"),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
      terminalNotification("b1", "t1", "2026-06-11T00:00:13.000Z"),
    ];
    const [m] = reconstructMonitors(rows);
    expect(m.status).toBe("completed");
    expect(m.durationMs).toBe(12_000);
    expect(m.outputFile).toBe(`${TASKS}/b1.output`);
  });

  it("maps failed / killed / stopped statuses", () => {
    for (const status of ["failed", "killed", "stopped"] as const) {
      const rows = [
        monitorUse("t1", "c"),
        startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
        terminalNotification("b1", "t1", "2026-06-11T00:00:03.000Z", status),
      ];
      expect(reconstructMonitors(rows)[0].status).toBe(status);
    }
  });

  it("captures a persistent monitor (timeoutMs 0)", () => {
    const rows = [
      monitorUse("t1", "c"),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z", {
        persistent: true,
        timeoutMs: 0,
      }),
    ];
    const [m] = reconstructMonitors(rows);
    expect(m.persistent).toBe(true);
    expect(m.timeoutMs).toBe(0);
    expect(m.status).toBe("running");
  });

  it("is idempotent across duplicate terminal notifications (first wins for duration)", () => {
    const rows = [
      monitorUse("t1", "c"),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
      terminalNotification("b1", "t1", "2026-06-11T00:00:05.000Z"),
      terminalNotification("b1", "t1", "2026-06-11T00:00:09.000Z"),
    ];
    expect(reconstructMonitors(rows)[0].durationMs).toBe(4_000);
  });

  it("never treats a Bash background shell as a monitor", () => {
    const rows = [
      {
        type: "assistant",
        timestamp: "2026-06-11T00:00:00.000Z",
        message: {
          id: "m1",
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Bash",
              input: { command: "pnpm dev", run_in_background: true },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-06-11T00:00:01.000Z",
        message: {
          content: [{ type: "tool_result", tool_use_id: "t1", content: "…" }],
        },
        toolUseResult: { backgroundTaskId: "bg1" },
      },
    ];
    expect(reconstructMonitors(rows)).toEqual([]);
  });

  it("never treats a subagent dispatch as a monitor", () => {
    const rows = [
      {
        type: "assistant",
        timestamp: "2026-06-11T00:00:00.000Z",
        message: {
          id: "m1",
          content: [
            {
              type: "tool_use",
              id: "a1",
              name: "Task",
              input: { description: "explore" },
            },
          ],
        },
      },
    ];
    expect(reconstructMonitors(rows)).toEqual([]);
  });

  it("orders monitors by start time", () => {
    const rows = [
      monitorUse("t1", "first"),
      monitorUse("t2", "second"),
      startResult("t2", "b2", "2026-06-11T00:00:05.000Z"),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
    ];
    expect(reconstructMonitors(rows).map((m) => m.id)).toEqual(["b1", "b2"]);
  });
});

describe("stitchMonitorEvents", () => {
  it("concatenates event bodies in order and collapses a consecutive duplicate", () => {
    const rows = [
      monitorUse("t1", "c"),
      startResult("t1", "b1", "2026-06-11T00:00:01.000Z"),
      eventNotification("b1", "2026-06-11T00:00:02.000Z", "draft: success"),
      eventNotification(
        "b1",
        "2026-06-11T00:00:03.000Z",
        "RUN_COMPLETED: success",
      ),
      eventNotification(
        "b1",
        "2026-06-11T00:00:04.000Z",
        "RUN_COMPLETED: success",
      ),
      eventNotification("b9", "2026-06-11T00:00:05.000Z", "other monitor"),
    ];
    expect(stitchMonitorEvents(rows, "b1")).toBe(
      "draft: success\nRUN_COMPLETED: success",
    );
  });
});

describe("toMonitor", () => {
  it("strips the server-only outputFile", () => {
    const rec = {
      id: "b1",
      command: "c",
      status: "completed" as const,
      persistent: false,
      timeoutMs: 0,
      outputFile: "/tmp/b1.output",
    };
    expect("outputFile" in toMonitor(rec)).toBe(false);
  });
});
