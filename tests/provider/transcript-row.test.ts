import { describe, it, expect } from "vitest";
import {
  parseJsonlRows,
  toolResultText,
} from "../../src/main/provider/claude/transcript-row";

describe("toolResultText", () => {
  it("passes a string result through unchanged", () => {
    expect(toolResultText("line one\nline two")).toBe("line one\nline two");
  });
  it("joins text blocks of an array result on newline", () => {
    expect(
      toolResultText([
        { type: "text", text: "a" },
        { type: "image" },
        { type: "text", text: "b" },
      ]),
    ).toBe("a\nb");
  });
  it("returns empty string for a non-string, non-array result", () => {
    expect(toolResultText(undefined)).toBe("");
    expect(toolResultText(42)).toBe("");
  });
});

describe("parseJsonlRows", () => {
  it("parses each non-blank line and skips unparseable ones", () => {
    const jsonl = ['{"a":1}', "", "  ", "not json", '{"b":2}'].join("\n");
    expect(parseJsonlRows(jsonl)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("returns [] for empty input", () => {
    expect(parseJsonlRows("")).toEqual([]);
  });

  it("tolerates a half-written trailing line", () => {
    const jsonl = '{"ok":true}\n{"partial":';
    expect(parseJsonlRows(jsonl)).toEqual([{ ok: true }]);
  });
});
