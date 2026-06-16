import { describe, it, expect } from "vitest";
import {
  ansiToSpans,
  type AnsiSpan,
} from "../../src/renderer/src/workspace/panels/ansi-to-html";

describe("ansiToSpans", () => {
  it("passes plain text through as one unstyled span", () => {
    expect(ansiToSpans("hello world")).toEqual<AnsiSpan[]>([
      { text: "hello world" },
    ]);
  });

  it("returns no spans for empty input", () => {
    expect(ansiToSpans("")).toEqual([]);
  });

  it("applies a foreground color then resets", () => {
    expect(ansiToSpans("\x1b[31mred\x1b[0m plain")).toEqual<AnsiSpan[]>([
      { text: "red", fg: "red" },
      { text: " plain" },
    ]);
  });

  it("combines bold and color from one SGR with multiple codes", () => {
    expect(ansiToSpans("\x1b[1;32mok\x1b[0m")).toEqual<AnsiSpan[]>([
      { text: "ok", fg: "green", bold: true },
    ]);
  });

  it("maps bright colors (90-97) to the base color with bright set", () => {
    expect(ansiToSpans("\x1b[91merr\x1b[0m")).toEqual<AnsiSpan[]>([
      { text: "err", fg: "red", bright: true },
    ]);
  });

  it("strips non-SGR CSI sequences (cursor moves, clears) without dropping text", () => {
    expect(ansiToSpans("before\x1b[2K\x1b[1Gafter")).toEqual<AnsiSpan[]>([
      { text: "beforeafter" },
    ]);
  });

  it("treats a bare reset (ESC[m) like ESC[0m", () => {
    expect(ansiToSpans("\x1b[33mwarn\x1b[m end")).toEqual<AnsiSpan[]>([
      { text: "warn", fg: "yellow" },
      { text: " end" },
    ]);
  });
});
