import { describe, it, expect, vi } from "vitest";
import { IPC } from "@shared/ipc";
import type { Provider } from "../src/main/provider/types";
import {
  migrateAnalytics,
  upsertTurns,
  hasAnyTurns,
  readProcessedFiles,
  upsertProcessedFile,
  type AnalyticsTurn,
} from "../src/main/db/analytics";
import { openTestDb } from "./helpers/sqlite";

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

const provider = {
  id: "fake",
  capabilities: {
    canControl: false,
    hasRateLimits: false,
    hasSubagents: false,
  },
  listCandidates: () => [],
  summarize: () => {
    throw new Error("unused");
  },
  restate: (_c: unknown, prev: unknown) => prev,
  readTranscript: () => ({ status: "absent" }),
  readSubagentTranscript: () => ({ status: "absent" }),
  readTasks: () => ({ status: "absent" }),
  readShells: () => ({ status: "absent" }),
  readShellOutput: () => ({ status: "absent" }),
  readMetrics: () => ({ status: "absent" }),
  resolveAdoptTarget: () => null,
} as unknown as Provider;

const turn = (over: Partial<AnalyticsTurn> = {}): AnalyticsTurn => ({
  messageId: "msg-1",
  sessionId: "sess-1",
  ts: 1000,
  modelRaw: "claude-opus-4-8",
  usage: {
    inputTokens: 1,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  },
  cwd: "/work/proj",
  project: "proj",
  branch: "main",
  ...over,
});

describe("registerIpc analytics:reset", () => {
  it("clears turns and high-water marks, returning ok", () => {
    const db = openTestDb();
    const analyticsDb = openTestDb();
    migrateAnalytics(analyticsDb);
    upsertTurns(analyticsDb, [turn()]);
    upsertProcessedFile(analyticsDb, "/a.jsonl", 1, 1);

    registerIpc({ db, provider, analyticsDb });
    const res = handlers.get(IPC.resetAnalytics)!(null) as { ok: boolean };

    expect(res.ok).toBe(true);
    expect(hasAnyTurns(analyticsDb)).toBe(false);
    expect(readProcessedFiles(analyticsDb).size).toBe(0);
  });

  it("returns ok:false when no analytics store is wired", () => {
    const db = openTestDb();
    registerIpc({ db, provider }); // analyticsDb omitted
    const res = handlers.get(IPC.resetAnalytics)!(null) as { ok: boolean };
    expect(res.ok).toBe(false);
  });
});
