import { describe, it, expect, vi } from "vitest";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { IPC } from "@shared/ipc";
import type { StatsTotals } from "@shared/stats";
import type { Provider } from "../src/main/provider/types";

// Capture the handlers registerIpc registers, without a real Electron ipcMain (same shape as ipc.test.ts).
const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (...a: unknown[]) => unknown>(),
}));
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: (...a: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
}));

import { registerIpc } from "../src/main/ipc";
import { migrate } from "../src/main/db/store";
import { migrateAnalytics, upsertTurns } from "../src/main/db/analytics";
import { openTestDb } from "./helpers/sqlite";
import { tempHomes } from "./helpers/temp-home";

const makeHome = tempHomes("cbw-stats-ipc-");

const provider: Provider = {
  id: "fake",
  capabilities: {
    canControl: false,
    hasRateLimits: false,
    hasSubagents: false,
  },
  listCandidates: () => [],
  summarize: (c) => ({
    id: c.id,
    title: "t",
    project: "p",
    state: "idle",
    management: "observed",
    model: "opus",
    lastActivityMs: 0,
    awaitingUser: false,
    transcriptMtimeMs: 0,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
    contextTokens: 0,
  }),
  restate: (_c, prev) => prev,
  readTranscript: () => ({ status: "absent" }),
  readTasks: () => ({ status: "absent" }),
  readMetrics: () => ({ status: "absent" }),
  resolveAdoptTarget: () => null,
};

describe("registerIpc stats:read", () => {
  it("scans the claude dir and returns the aggregated totals", () => {
    const home = makeHome();
    const dir = join(home, "projects", "-work-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "sess-1.jsonl"),
      JSON.stringify({
        type: "assistant",
        cwd: "/work/proj",
        message: {
          role: "assistant",
          id: "m1",
          model: "claude-opus-4-8",
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      }) + "\n",
    );

    const db = openTestDb();
    migrate(db);
    const analyticsDb = openTestDb();
    migrateAnalytics(analyticsDb);
    registerIpc({ db, provider, analyticsDb, claudeDir: home });

    const totals = handlers.get(IPC.readStats)!() as StatsTotals;
    expect(totals.sessions).toBe(1);
    expect(totals.turns).toBe(1);
    expect(totals.inputTokens).toBe(1_000_000);
    expect(totals.equivApiValueUsd).toBeCloseTo(5); // opus $5/M input
  });

  it("swallows a scan failure and serves last-known totals", () => {
    const home = makeHome();
    // A self-referential projects symlink makes the directory walk throw (ELOOP) — a real read failure,
    // not an empty home. The handler must catch it and serve the last-known totals, never reject.
    symlinkSync(join(home, "projects"), join(home, "projects"));

    const analyticsDb = openTestDb();
    migrateAnalytics(analyticsDb);
    upsertTurns(analyticsDb, [
      {
        messageId: "seed",
        sessionId: "s",
        ts: 0,
        modelRaw: "claude-opus-4-8",
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
        cwd: "/w",
        project: "w",
      },
    ]);

    const db = openTestDb();
    migrate(db);
    registerIpc({ db, provider, analyticsDb, claudeDir: home });

    let totals: StatsTotals | undefined;
    expect(() => {
      totals = handlers.get(IPC.readStats)!() as StatsTotals;
    }).not.toThrow();
    expect(totals?.turns).toBe(1); // last-known seeded total survives; scan failure swallowed
    expect(totals?.inputTokens).toBe(1_000_000);
  });

  it("returns zeroed totals when no analytics db is wired in", () => {
    const db = openTestDb();
    migrate(db);
    registerIpc({ db, provider });
    expect(handlers.get(IPC.readStats)!()).toEqual({
      sessions: 0,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      equivApiValueUsd: 0,
    });
  });
});
