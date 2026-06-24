import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  toRunSummary,
  toWorkflowRun,
  derivePhaseStatuses,
  listWorkflowRuns,
  workflowsDirFor,
  workflowAgentFileFor,
} from "../../../../src/main/provider/claude/workflows";

const RECORD = {
  runId: "wf_test",
  workflowName: "code-review",
  status: "completed",
  args: "xhigh",
  agentCount: 3,
  totalTokens: 100,
  totalToolCalls: 9,
  durationMs: 12345,
  startTime: 1700000000000,
  defaultModel: "claude-opus-4-8[1m]",
  summary: "a summary",
  logs: ["one", "two"],
  result: { findings: [] },
  phases: [
    { title: "Scope", detail: "pin the diff" },
    { title: "Find", detail: "one per angle" },
  ],
  workflowProgress: [
    { type: "workflow_phase", index: 1, title: "Scope" },
    { type: "workflow_phase", index: 2, title: "Find" },
    {
      type: "workflow_agent",
      index: 1,
      label: "scope",
      phaseIndex: 1,
      phaseTitle: "Scope",
      agentId: "a1",
      model: "claude-opus-4-8[1m]",
      state: "done",
      queuedAt: 1700000000000,
      startedAt: 1700000001000,
      durationMs: 1000,
      tokens: 40,
      toolCalls: 3,
      lastToolName: "StructuredOutput",
    },
    {
      type: "workflow_agent",
      index: 2,
      label: "angle-A",
      phaseIndex: 2,
      phaseTitle: "Find",
      agentId: "a2",
      state: "done",
      startedAt: 1700000002000,
      durationMs: 2000,
      tokens: 60,
      toolCalls: 6,
    },
  ],
};

describe("toRunSummary", () => {
  it("projects header fields and normalizes the model", () => {
    const s = toRunSummary(RECORD);
    expect(s.runId).toBe("wf_test");
    expect(s.workflowName).toBe("code-review");
    expect(s.status).toBe("completed");
    expect(s.args).toBe("xhigh");
    expect(s.agentCount).toBe(3);
    expect(s.startMs).toBe(1700000000000);
    expect(s.phaseCount).toBe(2);
    expect(s.defaultModel).toBe("opus");
  });

  it("defaults missing numbers to 0 and missing status to running", () => {
    const s = toRunSummary({ runId: "x", workflowName: "w" });
    expect(s.agentCount).toBe(0);
    expect(s.totalTokens).toBe(0);
    expect(s.startMs).toBe(0);
    expect(s.status).toBe("running");
    expect(s.defaultModel).toBeUndefined();
  });
});

describe("toWorkflowRun", () => {
  it("builds phases with status and the agents array", () => {
    const run = toWorkflowRun(RECORD);
    expect(run.agents.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(run.agents[0].model).toBe("opus");
    expect(run.phases.map((p) => [p.title, p.status])).toEqual([
      ["Scope", "done"],
      ["Find", "done"],
    ]);
    expect(run.logs).toEqual(["one", "two"]);
    expect(run.summary).toBe("a summary");
    expect(run.result).toEqual({ findings: [] });
  });
});

describe("derivePhaseStatuses", () => {
  const phases = [
    { index: 1, title: "Scope" },
    { index: 2, title: "Find" },
    { index: 3, title: "Verify" },
  ];
  const agent = (over: Record<string, unknown>) => ({
    id: "x",
    index: 0,
    label: "",
    phaseIndex: 1,
    phaseTitle: "",
    state: "done",
    durationMs: 0,
    tokens: 0,
    toolCalls: 0,
    ...over,
  });

  it("marks a not-yet-spawned phase pending, not vacuously done", () => {
    // Scope done; Find running (one started, one queued); Verify has no agents yet.
    const agents = [
      agent({ phaseIndex: 1, state: "done", startMs: 1 }),
      agent({ phaseIndex: 2, state: "done", startMs: 2 }),
      agent({ phaseIndex: 2, state: "queued", startMs: undefined }),
    ];
    const out = derivePhaseStatuses(phases, agents, "running");
    expect(out.map((p) => p.status)).toEqual(["done", "running", "pending"]);
  });

  it("keeps a fully-done phase running until a later phase starts (live)", () => {
    // Find's only present agents are done, but no Verify agent has started and the run is live.
    const agents = [
      agent({ phaseIndex: 1, state: "done", startMs: 1 }),
      agent({ phaseIndex: 2, state: "done", startMs: 2 }),
    ];
    const out = derivePhaseStatuses(phases, agents, "running");
    expect(out[1].status).toBe("running");
  });

  it("marks every all-done phase done when the run is terminal", () => {
    const agents = [
      agent({ phaseIndex: 1, state: "done", startMs: 1 }),
      agent({ phaseIndex: 2, state: "done", startMs: 2 }),
    ];
    const out = derivePhaseStatuses(phases, agents, "completed");
    expect(out.map((p) => p.status)).toEqual(["done", "done", "pending"]);
  });
});

describe("listWorkflowRuns", () => {
  it("reads run records, skips malformed and the scripts dir, newest first", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-"));
    mkdirSync(join(dir, "scripts"));
    writeFileSync(join(dir, "scripts", "code-review-wf_a.js"), "// not json");
    writeFileSync(
      join(dir, "wf_old.json"),
      JSON.stringify({ ...RECORD, runId: "wf_old", startTime: 1000 }),
    );
    writeFileSync(
      join(dir, "wf_new.json"),
      JSON.stringify({ ...RECORD, runId: "wf_new", startTime: 2000 }),
    );
    writeFileSync(join(dir, "wf_bad.json"), "{ not valid json");
    const runs = listWorkflowRuns(dir);
    expect(runs.map((r) => r.runId)).toEqual(["wf_new", "wf_old"]);
  });
});

describe("path helpers", () => {
  it("derives the workflows dir and an agent file from a transcript path", () => {
    const t = "/c/projects/p/sid.jsonl";
    expect(workflowsDirFor(t)).toBe("/c/projects/p/sid/workflows");
    expect(workflowAgentFileFor(t, "wf_1", "a9")).toBe(
      "/c/projects/p/sid/subagents/workflows/wf_1/agent-a9.jsonl",
    );
  });
});
