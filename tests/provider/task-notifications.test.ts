import { describe, it, expect } from "vitest";
import {
  notificationBody,
  tag,
  tailOutput,
} from "../../src/main/provider/claude/task-notifications";

describe("notificationBody", () => {
  it("reads the attachment-shaped task-notification prompt", () => {
    const row = {
      type: "attachment",
      attachment: {
        commandMode: "task-notification",
        prompt: "<task-notification>x</task-notification>",
      },
    };
    expect(notificationBody(row)).toBe(
      "<task-notification>x</task-notification>",
    );
  });
  it("reads the legacy queue-operation string content", () => {
    const row = {
      type: "queue-operation",
      content: "<task-notification>y</task-notification>",
    };
    expect(notificationBody(row)).toBe(
      "<task-notification>y</task-notification>",
    );
  });
  it("is empty for any other row", () => {
    expect(notificationBody({ type: "user", message: { content: "hi" } })).toBe(
      "",
    );
  });
});

describe("tag", () => {
  it("reads a single tag's trimmed text", () => {
    expect(tag("<status> completed </status>", "status")).toBe("completed");
  });
  it("is undefined when the tag is absent", () => {
    expect(tag("<status>x</status>", "output-file")).toBeUndefined();
  });
});

describe("tailOutput", () => {
  it("returns the text unchanged when under the byte cap", () => {
    expect(tailOutput("hello", 1024)).toEqual({
      text: "hello",
      truncatedBytes: 0,
    });
  });
  it("keeps the last maxBytes and reports the dropped count", () => {
    expect(tailOutput("abcdefghij", 4)).toEqual({
      text: "ghij",
      truncatedBytes: 6,
    });
  });
});
