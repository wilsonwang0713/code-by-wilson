import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import {
  scanAllTranscripts,
  scanStep,
  type ScanTarget,
} from "../../src/main/analytics/scan";
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

/** Write a subagent transcript under projects/<proj>/<id>/subagents/agent-<agentId>.jsonl — where
 *  Claude actually stores subagent turns (never inline in the parent). */
function writeSubagentTranscript(
  home: string,
  proj: string,
  id: string,
  agentId: string,
  lines: unknown[],
): void {
  const dir = join(home, "projects", proj, id, "subagents");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `agent-${agentId}.jsonl`),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
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

  it("re-reads only the appended lines on a later pass (append-only), no double-count", () => {
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

    // The Session continues: a second turn is appended and the file's mtime bumps. The next scan ingests
    // only the new line; the first turn is neither dropped nor double-counted.
    writeTranscript(
      home,
      "-work-a",
      "sess-a",
      [
        assistantLine("a-1", "claude-opus-4-8", 500),
        assistantLine("a-2", "claude-opus-4-8", 400),
      ],
      ANCIENT + 1000,
    );
    scanAllTranscripts(db, home);
    const t = readTotals(db);
    expect(t.turns).toBe(2);
    expect(t.inputTokens).toBe(900); // 500 + 400, not 1400
  });

  it("ingests nothing from an empty home without throwing", () => {
    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, makeHome());
    expect(readTotals(db).turns).toBe(0);
  });

  it("counts subagent turns from subagents/agent-*.jsonl, attributed to the parent session", () => {
    const home = makeHome();
    // The parent transcript carries only its own turn — real subagent turns live in the sibling
    // subagents/ dir, never inline (current Claude transcripts have zero inline isSidechain rows).
    writeTranscript(
      home,
      "-work-p",
      "sess-p",
      [assistantLine("parent-1", "claude-opus-4-8", 100)],
      ANCIENT,
    );
    writeSubagentTranscript(home, "-work-p", "sess-p", "aaa", [
      { ...assistantLine("sub-1", "claude-haiku-4-5", 30), isSidechain: true },
      { ...assistantLine("sub-2", "claude-haiku-4-5", 70), isSidechain: true },
    ]);

    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, home);

    const t = readTotals(db);
    expect(t.turns).toBe(3); // 1 parent + 2 subagent turns
    expect(t.sessions).toBe(1); // subagents roll up under the parent, no phantom session
    expect(t.inputTokens).toBe(200); // 100 + 30 + 70
  });

  it("is idempotent across a re-scan that includes subagent turns", () => {
    const home = makeHome();
    writeTranscript(
      home,
      "-work-p",
      "sess-p",
      [assistantLine("parent-1", "claude-opus-4-8", 100)],
      ANCIENT,
    );
    writeSubagentTranscript(home, "-work-p", "sess-p", "aaa", [
      { ...assistantLine("sub-1", "claude-haiku-4-5", 30), isSidechain: true },
    ]);

    const db = openTestDb();
    migrateAnalytics(db);
    scanAllTranscripts(db, home);
    const first = readTotals(db);
    scanAllTranscripts(db, home); // re-run over unchanged parent + subagent files
    expect(readTotals(db)).toEqual(first);
  });
});

/** Write a minimal codex rollout (one model, cumulative snapshots) under its dated dir. */
function writeCodexRollout(
  home: string,
  uuid: string,
  snapshots: { input: number; output: number }[],
  mtimeMs: number,
): string {
  const dir = join(home, "sessions", "2026", "07", "10");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `rollout-2026-07-10T10-00-00-${uuid}.jsonl`);
  const rows = [
    {
      timestamp: "2026-07-10T10:00:00.000Z",
      type: "session_meta",
      payload: { session_id: uuid, cwd: "/work/codexproj" },
    },
    {
      timestamp: "2026-07-10T10:00:01.000Z",
      type: "turn_context",
      payload: { model: "gpt-5.6-sol" },
    },
    ...snapshots.map((s, i) => ({
      timestamp: `2026-07-10T10:00:${String(10 + i).padStart(2, "0")}.000Z`,
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: s.input,
            cached_input_tokens: 0,
            cache_write_input_tokens: 0,
            output_tokens: s.output,
          },
        },
      },
    })),
  ];
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
  return path;
}

const codexTarget = (
  path: string,
  mtimeMs: number,
  uuid: string,
): ScanTarget => ({
  path,
  mtimeMs,
  sessionId: uuid,
  keyPrefix: path
    .split("/")
    .pop()!
    .replace(/\.jsonl$/, ""),
  kind: "codex",
});

describe("codex backfill-then-recent walk contract", () => {
  it("old turns survive leaving the walk: the recent-window target list keeps history intact", () => {
    const codexHome = makeHome();
    const uuid = "cccc7777-7777-4777-8777-777777777777";
    const p = writeCodexRollout(
      codexHome,
      uuid,
      [{ input: 40, output: 4 }],
      ANCIENT,
    );
    const db = openTestDb();
    migrateAnalytics(db);
    // launch backfill: the full-sweep target list
    const full = [codexTarget(p, ANCIENT, uuid)];
    expect(scanStep(db, "", undefined, full).done).toBe(true);
    expect(readTotals(db).inputTokens).toBe(40);
    // steady state: the recent walk no longer lists the ancient file — its turns must persist
    // and the scan must still settle done with nothing pending
    const step = scanStep(db, "", undefined, []);
    expect(step.done).toBe(true);
    expect(step.wrote).toBe(false);
    expect(readTotals(db).inputTokens).toBe(40);
  });
});
