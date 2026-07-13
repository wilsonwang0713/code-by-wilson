import { describe, it, expect } from "vitest";
import type { Provider } from "../../src/main/provider/types";
import type {
  PersistedSession,
  ProviderCapabilities,
  SessionCandidate,
} from "../../src/shared/types";
import { createMultiProvider } from "../../src/main/provider/multi";
import { hydrate } from "../../src/main/db/store";

const EMPTY_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  cacheCreation5mTokens: 0,
  cacheCreation1hTokens: 0,
};

function candidate(id: string): SessionCandidate {
  return { id, alive: false, cwd: "", transcriptMtimeMs: 1 };
}

function snapshot(id: string): PersistedSession {
  return {
    id,
    title: id,
    project: "p",
    cwd: "",
    state: "ended",
    management: "observed",
    model: "opus",
    lastActivityMs: 0,
    createdMs: 0,
    awaitingUser: false,
    transcriptMtimeMs: 1,
    usage: EMPTY_USAGE,
    contextTokens: 0,
  };
}

/** A fake provider that records which per-session reads reached it. */
function fakeProvider(
  id: string,
  ids: string[],
  capabilities: ProviderCapabilities,
): Provider & { calls: string[] } {
  const calls: string[] = [];
  const track =
    <T>(name: string, result: T) =>
    (sessionId: string): T => {
      calls.push(`${name}:${sessionId}`);
      return result;
    };
  return {
    id,
    capabilities,
    calls,
    listCandidates: () => ids.map(candidate),
    summarize: (c) => snapshot(c.id),
    restate: (_c, prev) => ({ ...prev }),
    readTranscript: track("readTranscript", { status: "absent" as const }),
    getToolResult: track("getToolResult", { found: false as const }),
    readSubagentTranscript: track("readSubagentTranscript", {
      status: "absent" as const,
    }),
    readTasks: track("readTasks", { status: "absent" as const }),
    readShells: track("readShells", { status: "absent" as const }),
    readShellOutput: track("readShellOutput", { status: "absent" as const }),
    readMonitors: track("readMonitors", { status: "absent" as const }),
    readMonitorOutput: track("readMonitorOutput", {
      status: "absent" as const,
    }),
    readMetrics: track("readMetrics", { status: "absent" as const }),
    resolveAdoptTarget: track("resolveAdoptTarget", null),
    resolveSessionCwd: track("resolveSessionCwd", null),
  };
}

const CLAUDE_CAPS = {
  canControl: true,
  hasRateLimits: true,
  hasSubagents: true,
};
const CODEX_CAPS = {
  canControl: false,
  hasRateLimits: false,
  hasSubagents: false,
};

describe("createMultiProvider", () => {
  it("concatenates every provider's candidates and serves the primary's capabilities", () => {
    const claude = fakeProvider("claude", ["a1", "a2"], CLAUDE_CAPS);
    const codex = fakeProvider("codex", ["b1"], CODEX_CAPS);
    const multi = createMultiProvider([claude, codex]);

    expect(multi.capabilities).toEqual(CLAUDE_CAPS);
    expect(multi.listCandidates().map((c) => c.id)).toEqual(["a1", "a2", "b1"]);
  });

  it("stamps summarize/restate snapshots with the owning provider's id", () => {
    const claude = fakeProvider("claude", ["a1"], CLAUDE_CAPS);
    const codex = fakeProvider("codex", ["b1"], CODEX_CAPS);
    const multi = createMultiProvider([claude, codex]);
    multi.listCandidates();

    expect(multi.summarize(candidate("a1")).providerId).toBe("claude");
    expect(multi.summarize(candidate("b1")).providerId).toBe("codex");
    // restate re-stamps too, so a snapshot reused across syncs keeps its ownership.
    expect(multi.restate(candidate("b1"), snapshot("b1")).providerId).toBe(
      "codex",
    );
  });

  it("dispatches per-session reads to the provider that discovered the id", () => {
    const claude = fakeProvider("claude", ["a1"], CLAUDE_CAPS);
    const codex = fakeProvider("codex", ["b1"], CODEX_CAPS);
    const multi = createMultiProvider([claude, codex]);
    multi.listCandidates();

    multi.readTranscript("b1");
    multi.readMetrics("b1");
    multi.resolveSessionCwd("b1");
    expect(codex.calls).toEqual([
      "readTranscript:b1",
      "readMetrics:b1",
      "resolveSessionCwd:b1",
    ]);
    expect(claude.calls).toEqual([]);

    multi.readTranscript("a1");
    expect(claude.calls).toEqual(["readTranscript:a1"]);
  });

  it("falls back to the primary for an id no discovery pass has claimed", () => {
    const claude = fakeProvider("claude", [], CLAUDE_CAPS);
    const codex = fakeProvider("codex", [], CODEX_CAPS);
    const multi = createMultiProvider([claude, codex]);

    multi.readTranscript("unknown");
    expect(claude.calls).toEqual(["readTranscript:unknown"]);
    expect(codex.calls).toEqual([]);
  });

  it("keeps a colliding id with its first claimant instead of double-listing it", () => {
    const claude = fakeProvider("claude", ["dup"], CLAUDE_CAPS);
    const codex = fakeProvider("codex", ["dup"], CODEX_CAPS);
    const multi = createMultiProvider([claude, codex]);

    expect(multi.listCandidates().map((c) => c.id)).toEqual(["dup"]);
    multi.readTranscript("dup");
    expect(claude.calls).toEqual(["readTranscript:dup"]);
    expect(codex.calls).toEqual([]);
  });
});

describe("hydrate provider plumbing", () => {
  it("passes providerId through and gates resumable on canControl", () => {
    const codexSession = hydrate({ ...snapshot("b1"), providerId: "codex" });
    expect(codexSession.providerId).toBe("codex");
    // A positive transcript mtime alone is not resumable — `claude --resume` can't read a rollout.
    expect(codexSession.resumable).toBe(false);

    const claudeSession = hydrate({ ...snapshot("a1"), providerId: "claude" });
    expect(claudeSession.resumable).toBe(true);
    // Absent providerId = a pre-field cached row, which was always Claude's.
    expect(hydrate(snapshot("a2")).resumable).toBe(true);
  });
});
