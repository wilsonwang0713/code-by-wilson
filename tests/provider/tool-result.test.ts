import { describe, it, expect } from "vitest";
import { extractToolResult } from "../../src/main/provider/claude/tool-result";

const rows = (...r: object[]) => r;

describe("extractToolResult", () => {
  const transcript = rows(
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "Bash",
            input: { command: "pnpm test" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "ok\npassed" },
        ],
      },
    },
  );

  it("returns the full command, output, and status by id", () => {
    expect(extractToolResult(transcript, "t1")).toEqual({
      found: true,
      command: "pnpm test",
      output: "ok\npassed",
      status: "ok",
    });
  });

  it("reports found:false for an unknown id", () => {
    expect(extractToolResult(transcript, "nope")).toEqual({ found: false });
  });

  it("returns found:true, status pending, empty output for a tool with no result yet", () => {
    const pending = rows({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "t9",
            name: "Bash",
            input: { command: "sleep 9" },
          },
        ],
      },
    });
    expect(extractToolResult(pending, "t9")).toEqual({
      found: true,
      command: "sleep 9",
      output: "",
      status: "pending",
    });
  });

  it("surfaces an error result", () => {
    const failed = rows(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "t2",
              name: "Bash",
              input: { command: "false" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t2",
              is_error: true,
              content: "boom",
            },
          ],
        },
      },
    );
    expect(extractToolResult(failed, "t2")).toEqual({
      found: true,
      command: "false",
      output: "boom",
      status: "error",
    });
  });

  it("falls back to the file_path / pattern / url field for non-Bash tools", () => {
    const read = rows({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "r1",
            name: "Read",
            input: { file_path: "src/a.ts" },
          },
        ],
      },
    });
    expect(extractToolResult(read, "r1")).toMatchObject({
      found: true,
      command: "src/a.ts",
    });
  });

  it("uses the query field for a WebSearch (shares the row's telling-field list)", () => {
    const search = rows({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "q1",
            name: "WebSearch",
            input: { query: "electron native rebuild" },
          },
        ],
      },
    });
    expect(extractToolResult(search, "q1")).toMatchObject({
      found: true,
      command: "electron native rebuild",
    });
  });

  it("falls back to pretty JSON for a tool with no telling field", () => {
    const structured = rows({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "s1",
            name: "TodoWrite",
            input: { todos: [{ content: "ship it", status: "pending" }] },
          },
        ],
      },
    });
    const r = extractToolResult(structured, "s1");
    expect(r.found).toBe(true);
    expect(r.found && r.command.startsWith("{")).toBe(true);
    expect(r.found && r.command).toContain("todos");
  });
});
