import { describe, it, expect } from "vitest";
import { planFileScan } from "../../src/main/analytics/incremental";

/** Join lines into JSONL content with a trailing newline (how a real Transcript on disk looks). */
const file = (...lines: string[]): string => lines.join("\n") + "\n";

describe("planFileScan", () => {
  it("cold (no prior state): parses every complete line from zero", () => {
    const plan = planFileScan(file("a", "b", "c"), undefined);
    expect(plan).toEqual({ jsonl: "a\nb\nc", startLine: 0, lines: 3 });
  });

  it("grown: parses only the lines appended past the stored count", () => {
    const plan = planFileScan(file("a", "b", "c", "d"), { mtime: 1, lines: 2 });
    expect(plan).toEqual({ jsonl: "c\nd", startLine: 2, lines: 4 });
  });

  it("unchanged complete-line count: no-op (null)", () => {
    expect(planFileScan(file("a", "b"), { mtime: 1, lines: 2 })).toBeNull();
  });

  it("shrank (truncated/rotated): re-reads from zero", () => {
    const plan = planFileScan(file("x"), { mtime: 1, lines: 3 });
    expect(plan).toEqual({ jsonl: "x", startLine: 0, lines: 1 });
  });

  it("ignores a partial trailing line with no newline until it lands", () => {
    // "a\nb" — only "a" is newline-terminated; "b" is a half-written append, not yet a complete line.
    const first = planFileScan("a\nb", undefined);
    expect(first).toEqual({ jsonl: "a", startLine: 0, lines: 1 });
    // Once "b" is terminated and "c" appended, the next pass picks up b and c from line 1.
    const next = planFileScan(file("a", "b", "c"), { mtime: 1, lines: 1 });
    expect(next).toEqual({ jsonl: "b\nc", startLine: 1, lines: 3 });
  });

  it("empty file: a from-zero plan of zero lines (never null on a cold read)", () => {
    expect(planFileScan("", undefined)).toEqual({
      jsonl: "",
      startLine: 0,
      lines: 0,
    });
  });
});
