import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { scanAllTranscripts } from "../../src/main/analytics/scan";
import { migrateAnalytics, readTotals } from "../../src/main/db/analytics";
import { openTestDb } from "../helpers/sqlite";
import { tempHomes } from "../helpers/temp-home";

const makeHome = tempHomes("cbw-scan-");

/** Write a transcript JSONL of arbitrary lines under projects/<proj>/<id>.jsonl with an explicit mtime. */
function writeTranscript(
  home: string,
  proj: string,
  id: string,
  lines: unknown[],
  mtimeMs: number,
): void {
  const dir = join(home, "projects", proj);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.jsonl`);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
}

const assistantLine = (id: string, model: string, input: number) => ({
  type: "assistant",
  cwd: "/work/proj",
  gitBranch: "main",
  timestamp: "2020-01-01T00:00:00.000Z",
  message: {
    role: "assistant",
    id,
    model,
    usage: {
      input_tokens: input,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    content: [{ type: "text", text: "ok" }],
  },
});

const ANCIENT = 1_000_000_000_000; // year 2001, far outside any recency window

describe("scanAllTranscripts (real disk walk, scratch analytics db)", () => {
  it("ingests every transcript including ancient ones, excludes synthetic, includes sidechain", () => {
    const home = makeHome();
    // An ancient transcript the live index would prune: must still be ingested.
    writeTranscript(
      home,
      "-work-old",
      "sess-old",
      [
        { type: "user", message: { role: "user", content: "hi" } },
        assistantLine("old-1", "claude-opus-4-8", 100),
      ],
      ANCIENT,
    );
    // A second session with a synthetic placeholder (skipped) and a sidechain turn (counted).
    writeTranscript(
      home,
      "-work-new",
      "sess-new",
      [
        {
          type: "assistant",
          message: {
            role: "assistant",
            id: "syn",
            model: "<synthetic>",
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        },
        {
          ...assistantLine("side-1", "claude-sonnet-4-6", 200),
          isSidechain: true,
        },
      ],
      ANCIENT,
    );

    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, home);

    const t = readTotals(db);
    expect(t.sessions).toBe(2); // both sessions contributed a real turn
    expect(t.turns).toBe(2); // synthetic excluded; sidechain included
    expect(t.inputTokens).toBe(300);
  });

  it("is idempotent: a second scan does not double-count", () => {
    const home = makeHome();
    writeTranscript(
      home,
      "-work-a",
      "sess-a",
      [assistantLine("a-1", "claude-opus-4-8", 500)],
      ANCIENT,
    );

    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, home);
    const first = readTotals(db);
    scanAllTranscripts(db, home); // re-run over unchanged files
    expect(readTotals(db)).toEqual(first);
  });

  it("re-reads a changed transcript and updates in place (last-write-wins, no double-count)", () => {
    const home = makeHome();
    writeTranscript(
      home,
      "-work-a",
      "sess-a",
      [assistantLine("a-1", "claude-opus-4-8", 500)],
      ANCIENT,
    );

    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, home);
    expect(readTotals(db).inputTokens).toBe(500);

    // Same session + same message id, but the turn now reports more tokens. A re-scan must rewrite the
    // row, not add a second one.
    writeTranscript(
      home,
      "-work-a",
      "sess-a",
      [assistantLine("a-1", "claude-opus-4-8", 900)],
      ANCIENT + 1000,
    );
    scanAllTranscripts(db, home);
    const t = readTotals(db);
    expect(t.turns).toBe(1);
    expect(t.inputTokens).toBe(900); // updated, not 1400
  });

  it("ingests nothing from an empty home without throwing", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, makeHome());
    expect(readTotals(db).turns).toBe(0);
  });
});
