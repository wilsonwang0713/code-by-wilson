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
  workflowScriptsDirFor,
  workflowAgentsRootFor,
  parseScriptName,
  buildLiveRun,
  listLiveRunSummaries,
  readLiveWorkflowRun,
  liveRunNewestMtime,
} from "../../../../src/main/provider/claude/workflows";
import { parseWorkflowScript } from "../../../../src/main/provider/claude/workflow-script";

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

  it("derives the live-run scripts dir and agents root from a transcript path", () => {
    const t = "/c/projects/p/sid.jsonl";
    expect(workflowScriptsDirFor(t)).toBe(
      "/c/projects/p/sid/workflows/scripts",
    );
    expect(workflowAgentsRootFor(t)).toBe(
      "/c/projects/p/sid/subagents/workflows",
    );
  });
});

describe("parseScriptName", () => {
  it("splits a hyphenated workflow name from its wf_ run id", () => {
    expect(parseScriptName("code-review-wf_1d3f16ba-b82.js")).toEqual({
      workflowName: "code-review",
      runId: "wf_1d3f16ba-b82",
    });
  });

  it("returns null for a non-script name", () => {
    expect(parseScriptName("journal.jsonl")).toBeNull();
    expect(parseScriptName("scripts")).toBeNull();
  });
});

describe("buildLiveRun", () => {
  const a1Rows = [
    {
      type: "user",
      timestamp: "2024-01-01T00:00:00.000Z",
      message: { content: "scope the diff" },
    },
    {
      type: "assistant",
      timestamp: "2024-01-01T00:00:01.000Z",
      message: {
        id: "m1",
        model: "claude-opus-4-8[1m]",
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: "tool_use", id: "t1", name: "Grep" }],
      },
    },
  ];
  const a2Rows = [
    {
      type: "user",
      timestamp: "2024-01-01T00:00:02.000Z",
      message: { content: "find bugs" },
    },
    {
      type: "assistant",
      timestamp: "2024-01-01T00:00:05.000Z",
      message: { id: "m2", usage: { input_tokens: 20, output_tokens: 0 } },
    },
  ];
  const journal = [
    JSON.stringify({ type: "started", agentId: "a1" }),
    JSON.stringify({ type: "started", agentId: "a2" }),
    JSON.stringify({ type: "result", agentId: "a1", result: { ok: true } }),
  ].join("\n");
  const rowsOf = new Map<string, any[]>([
    ["a1", a1Rows],
    ["a2", a2Rows],
  ]);

  it("reconstructs an in-progress run from the journal + agent rows", () => {
    const run = buildLiveRun("wf_x", "code-review", journal, rowsOf, 999, null);
    expect(run.status).toBe("running");
    expect(run.runId).toBe("wf_x");
    expect(run.workflowName).toBe("code-review");
    expect(run.phases).toEqual([]);
    expect(run.phaseCount).toBe(0);
    expect(run.agentCount).toBe(2);
    expect(run.totalTokens).toBe(35);
    expect(run.totalToolCalls).toBe(1);
    expect(run.startMs).toBe(Date.parse("2024-01-01T00:00:00.000Z"));
    expect(run.durationMs).toBe(5000);
  });

  it("derives per-agent state, tokens, model, and a phase-less label", () => {
    const run = buildLiveRun("wf_x", "code-review", journal, rowsOf, 999, null);
    const [a1, a2] = run.agents;
    expect(a1.id).toBe("a1");
    expect(a1.state).toBe("done"); // has a journal result
    expect(a1.label).toBe("agent 1");
    expect(a1.phaseIndex).toBe(0);
    expect(a1.tokens).toBe(15);
    expect(a1.toolCalls).toBe(1);
    expect(a1.lastToolName).toBe("Grep");
    expect(a1.model).toBe("opus");
    expect(a1.resultPreview).toContain("ok");
    expect(a2.state).toBe("running"); // started, no result
    expect(a2.tokens).toBe(20);
  });

  it("falls back to the script mtime and zero agents before anything starts", () => {
    const run = buildLiveRun("wf_y", "w", "", new Map(), 12345, null);
    expect(run.agents).toEqual([]);
    expect(run.agentCount).toBe(0);
    expect(run.startMs).toBe(12345);
    expect(run.durationMs).toBe(0);
    expect(run.status).toBe("running");
  });
});

describe("live run IO", () => {
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "wf-live-"));
    const scriptsDir = join(root, "workflows", "scripts");
    const agentsRoot = join(root, "subagents", "workflows");
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(
      join(scriptsDir, "code-review-wf_live.js"),
      "export const meta = {}",
    );
    const runDir = join(agentsRoot, "wf_live");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "journal.jsonl"),
      JSON.stringify({ type: "started", agentId: "a1" }),
    );
    writeFileSync(
      join(runDir, "agent-a1.jsonl"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2024-01-01T00:00:01.000Z",
        message: { id: "m1", usage: { input_tokens: 3, output_tokens: 2 } },
      }),
    );
    return { scriptsDir, agentsRoot };
  }

  it("reconstructs a run that has a script but no terminal record", () => {
    const { scriptsDir, agentsRoot } = fixture();
    const run = readLiveWorkflowRun(scriptsDir, agentsRoot, "wf_live");
    expect(run?.status).toBe("running");
    expect(run?.workflowName).toBe("code-review");
    expect(run?.agents.map((a) => a.id)).toEqual(["a1"]);
    expect(run?.agents[0].state).toBe("running");
    expect(run?.totalTokens).toBe(5);
    expect(
      liveRunNewestMtime(scriptsDir, agentsRoot, "wf_live"),
    ).toBeGreaterThan(0);
  });

  it("lists live summaries and lets a terminal record win", () => {
    const { scriptsDir, agentsRoot } = fixture();
    expect(
      listLiveRunSummaries(scriptsDir, agentsRoot, new Set()).map(
        (r) => r.runId,
      ),
    ).toEqual(["wf_live"]);
    // Once the terminal record exists, the live summary is suppressed.
    expect(
      listLiveRunSummaries(scriptsDir, agentsRoot, new Set(["wf_live"])),
    ).toEqual([]);
  });

  it("returns null for a run id no script names", () => {
    const { scriptsDir, agentsRoot } = fixture();
    expect(readLiveWorkflowRun(scriptsDir, agentsRoot, "wf_absent")).toBeNull();
    expect(liveRunNewestMtime(scriptsDir, agentsRoot, "wf_absent")).toBe(0);
  });
});

describe("buildLiveRun with a plan", () => {
  const SCRIPT = `export const meta = { name: 'demo', phases: [ { title: 'Scan' }, { title: 'Verify' } ] }
const s = (await parallel([
  () => agent('a', { label: 'scout:alpha', phase: 'Scan' }),
  () => agent('b', { label: 'scout:beta', phase: 'Scan' }),
])).filter(Boolean)
const v = await agent('c', { label: 'verify:a', phase: 'Verify' })
return { s }
`;
  const journal = [
    JSON.stringify({ type: "started", agentId: "a1" }),
    JSON.stringify({ type: "started", agentId: "a2" }),
    JSON.stringify({ type: "result", agentId: "a1", result: "alpha" }),
  ].join("\n");
  const rows = (ts: string) => [
    {
      type: "assistant",
      timestamp: ts,
      message: { id: "m", usage: { input_tokens: 1, output_tokens: 1 } },
    },
  ];
  const rowsOf = new Map<string, any[]>([
    ["a1", rows("2024-01-01T00:00:00.000Z")],
    ["a2", rows("2024-01-01T00:00:01.000Z")],
  ]);

  it("binds agents to declared phases/labels and derives phase status", () => {
    const plan = parseWorkflowScript(SCRIPT);
    const run = buildLiveRun("wf_x", "demo", journal, rowsOf, 0, plan);
    expect(run.phases.map((p) => p.title)).toEqual(["Scan", "Verify"]);
    expect(run.agents.map((a) => [a.label, a.phaseIndex])).toEqual([
      ["scout:alpha", 1],
      ["scout:beta", 1],
    ]);
    // Scan has 2 of 2 started, a1 done; with a later phase not yet started and run live, Scan reads running.
    expect(run.phases[0].agentsTotal).toBe(2);
    expect(run.phases[1].status).toBe("pending");
  });

  it("falls back to empty phases and generic labels when plan is null", () => {
    const run = buildLiveRun("wf_x", "demo", journal, rowsOf, 0, null);
    expect(run.phases).toEqual([]);
    expect(run.agents[0].label).toBe("agent 1");
  });
});
