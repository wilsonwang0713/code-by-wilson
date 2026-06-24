import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { normalizeModelId } from "@shared/models";
import type {
  WorkflowRunSummary,
  WorkflowRun,
  WorkflowPhase,
  WorkflowAgent,
  WorkflowPhaseStatus,
} from "@shared/types";
import { newestMtime } from "./dir-mtime";
import { num as fieldNum, parseJsonlRows, userText } from "./transcript-row";
import {
  parseWorkflowScript,
  bindLiveAgents,
  type WorkflowPlan,
} from "./workflow-script";

const RUN_FILE = /\.json$/;

/** A run record is a `.json` file directly under <session>/workflows/ (the scripts/ subdir is skipped). */
function isRunFile(name: string): boolean {
  return RUN_FILE.test(name);
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const int = (v: unknown): number => num(v) ?? 0;

/** projects/<proj>/<sid>.jsonl → projects/<proj>/<sid> (the session's artifacts dir). */
function sessionArtifactsDir(transcriptPath: string): string {
  return join(dirname(transcriptPath), basename(transcriptPath, ".jsonl"));
}

/** projects/<proj>/<sid>.jsonl → .../<sid>/workflows (the run-record dir). */
export function workflowsDirFor(transcriptPath: string): string {
  return join(sessionArtifactsDir(transcriptPath), "workflows");
}

/** projects/<proj>/<sid>.jsonl + runId → that run's record file. */
export function workflowRunFileFor(
  transcriptPath: string,
  runId: string,
): string {
  return join(workflowsDirFor(transcriptPath), `${runId}.json`);
}

/** projects/<proj>/<sid>.jsonl + runId + agentId → that workflow agent's own transcript file. */
export function workflowAgentFileFor(
  transcriptPath: string,
  runId: string,
  agentId: string,
): string {
  return join(
    sessionArtifactsDir(transcriptPath),
    "subagents",
    "workflows",
    runId,
    `agent-${agentId}.jsonl`,
  );
}

/** Newest mtime (ms) among a session's run records, or 0 when the dir is absent/empty. The readWorkflows
 *  change token: a run record being (re)written advances it. */
export function workflowsNewestMtime(dir: string): number {
  return newestMtime(dir, isRunFile);
}

/** The phase descriptors in declared order: from the record's `phases` when present, else distilled from
 *  the workflow_phase progress entries. Index is 1-based by declared position. */
function phaseDescriptors(
  raw: any,
): { index: number; title: string; detail?: string }[] {
  if (Array.isArray(raw?.phases) && raw.phases.length) {
    return raw.phases.map((p: any, i: number) => ({
      index: i + 1,
      title: str(p?.title) ?? `Phase ${i + 1}`,
      detail: str(p?.detail),
    }));
  }
  const progress = Array.isArray(raw?.workflowProgress)
    ? raw.workflowProgress
    : [];
  return progress
    .filter((e: any) => e?.type === "workflow_phase")
    .map((e: any) => ({ index: int(e.index), title: str(e.title) ?? "" }));
}

/** Project one workflow_agent progress entry into a WorkflowAgent. */
function toAgent(e: any): WorkflowAgent {
  return {
    id: str(e?.agentId) ?? "",
    index: int(e?.index),
    label: str(e?.label) ?? "",
    phaseIndex: int(e?.phaseIndex),
    phaseTitle: str(e?.phaseTitle) ?? "",
    model: str(e?.model) !== undefined ? normalizeModelId(e.model) : undefined,
    state: str(e?.state) ?? "queued",
    queuedMs: num(e?.queuedAt),
    startMs: num(e?.startedAt),
    lastProgressMs: num(e?.lastProgressAt),
    durationMs: int(e?.durationMs),
    tokens: int(e?.tokens),
    toolCalls: int(e?.toolCalls),
    lastToolName: str(e?.lastToolName),
    lastToolSummary: str(e?.lastToolSummary),
    promptPreview: str(e?.promptPreview),
    resultPreview: str(e?.resultPreview),
  };
}

/**
 * Derive each phase's status exactly from its agents. A phase is `pending` until one of its agents starts,
 * `running` while it has a started-but-not-all-done set, and `done` only when every present agent is done
 * AND the run is terminal or a later phase has visibly started (so a phase whose agents spawn in waves
 * isn't called done prematurely, and a not-yet-spawned phase reads pending, not vacuously done).
 */
export function derivePhaseStatuses(
  phases: { index: number; title: string; detail?: string }[],
  agents: WorkflowAgent[],
  runStatus: string,
): WorkflowPhase[] {
  const terminal = runStatus === "completed" || runStatus === "failed";
  const laterStarted = (idx: number): boolean =>
    agents.some((a) => a.phaseIndex > idx && a.startMs !== undefined);
  return phases.map((p) => {
    const mine = agents.filter((a) => a.phaseIndex === p.index);
    const started = mine.filter((a) => a.startMs !== undefined);
    const done = mine.filter((a) => a.state === "done");
    let status: WorkflowPhaseStatus;
    if (mine.length === 0 || started.length === 0) status = "pending";
    else if (done.length === mine.length && (terminal || laterStarted(p.index)))
      status = "done";
    else status = "running";
    return {
      index: p.index,
      title: p.title,
      detail: p.detail,
      status,
      agentsTotal: mine.length,
      agentsDone: done.length,
    };
  });
}

/** Project a parsed run record into the dock summary. */
export function toRunSummary(raw: any): WorkflowRunSummary {
  return {
    runId: str(raw?.runId) ?? "",
    workflowName: str(raw?.workflowName) ?? "",
    status: str(raw?.status) ?? "running",
    args: str(raw?.args),
    agentCount: int(raw?.agentCount),
    totalTokens: int(raw?.totalTokens),
    totalToolCalls: int(raw?.totalToolCalls),
    durationMs: int(raw?.durationMs),
    startMs: int(raw?.startTime),
    phaseCount: phaseDescriptors(raw).length,
    defaultModel:
      str(raw?.defaultModel) !== undefined
        ? normalizeModelId(raw.defaultModel)
        : undefined,
  };
}

/** Project a parsed run record into the full run for the drill surface. */
export function toWorkflowRun(raw: any): WorkflowRun {
  const summary = toRunSummary(raw);
  const progress = Array.isArray(raw?.workflowProgress)
    ? raw.workflowProgress
    : [];
  const agents = progress
    .filter((e: any) => e?.type === "workflow_agent")
    .map(toAgent);
  const phases = derivePhaseStatuses(
    phaseDescriptors(raw),
    agents,
    summary.status,
  );
  return {
    ...summary,
    phases,
    agents,
    summary: str(raw?.summary),
    logs: Array.isArray(raw?.logs)
      ? raw.logs.filter((x: unknown) => typeof x === "string")
      : [],
    result: raw?.result,
  };
}

/**
 * List one session's workflow runs from `<session>/workflows/`, newest first. A missing dir, the scripts/
 * subdir, and any malformed record are skipped — never fatal.
 */
export function listWorkflowRuns(dir: string): WorkflowRunSummary[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: WorkflowRunSummary[] = [];
  for (const name of names) {
    if (!isRunFile(name)) continue;
    try {
      out.push(toRunSummary(JSON.parse(readFileSync(join(dir, name), "utf8"))));
    } catch {
      // skip a malformed / half-written record
    }
  }
  out.sort((a, b) => b.startMs - a.startMs);
  return out;
}

// ─── Live (in-progress) runs ─────────────────────────────────────────────────────────────────────────
// The harness writes <session>/workflows/<runId>.json only once, at termination. While a run is live the
// only on-disk evidence is the persisted script under workflows/scripts/<name>-<runId>.js plus a journal
// and the agents' own transcripts under subagents/workflows/<runId>/. These reconstruct an in-progress run
// so it surfaces (status "running") before its terminal record exists. The terminal record, once written,
// wins — a live run is only ever synthesized for a runId with no record yet. The phase/label/model the
// record would carry per agent aren't on disk live, so live agents read phase-less.

/** A run script filename is `<name>-<runId>.js`; the runId is the only `wf_…` token, so the split is
 *  unambiguous even when the workflow name contains hyphens (e.g. "code-review"). */
const SCRIPT_NAME = /^(.+)-(wf_[0-9a-z-]+)\.js$/i;

/** A run script's filename → its workflow name and run id, or null when it doesn't match the pattern. */
export function parseScriptName(
  name: string,
): { runId: string; workflowName: string } | null {
  const m = SCRIPT_NAME.exec(name);
  return m ? { workflowName: m[1], runId: m[2] } : null;
}

/** projects/<proj>/<sid>.jsonl → .../<sid>/workflows/scripts (the persisted run scripts). */
export function workflowScriptsDirFor(transcriptPath: string): string {
  return join(workflowsDirFor(transcriptPath), "scripts");
}

/** projects/<proj>/<sid>.jsonl → .../<sid>/subagents/workflows (per-run agent dirs, each with a journal). */
export function workflowAgentsRootFor(transcriptPath: string): string {
  return join(sessionArtifactsDir(transcriptPath), "subagents", "workflows");
}

/** What scanning one agent's transcript rows yields for the live view. firstTs/lastTs are Infinity/-Infinity
 *  when no row carried a timestamp. */
interface AgentScan {
  tokens: number;
  toolCalls: number;
  firstTs: number;
  lastTs: number;
  model?: string;
  lastToolName?: string;
  promptPreview?: string;
}

/** Scan a workflow agent's transcript rows for the live-view fields: deduped tokens (cache excluded,
 *  counted once per assistant message id, mirroring the subagent scan), tool-use count, time bounds, the
 *  first reported model, the last tool name, and the opening user prompt. */
function scanAgentRows(rows: any[]): AgentScan {
  let tokens = 0;
  let toolCalls = 0;
  let firstTs = Infinity;
  let lastTs = -Infinity;
  let model: string | undefined;
  let lastToolName: string | undefined;
  let promptPreview: string | undefined;
  const counted = new Set<string>();
  for (const row of rows) {
    const ts =
      typeof row?.timestamp === "string" ? Date.parse(row.timestamp) : NaN;
    if (!Number.isNaN(ts)) {
      if (ts < firstTs) firstTs = ts;
      if (ts > lastTs) lastTs = ts;
    }
    const msg = row?.message;
    if (row?.type === "user" && promptPreview === undefined) {
      const text = userText(msg?.content ?? "").trim();
      if (text) promptPreview = text.slice(0, 280);
    }
    if (row?.type === "assistant") {
      if (!model && typeof msg?.model === "string") model = msg.model;
      const u = msg?.usage;
      if (u && typeof u === "object") {
        const id = typeof msg?.id === "string" ? msg.id : undefined;
        if (!id || !counted.has(id)) {
          if (id) counted.add(id);
          tokens += fieldNum(u.input_tokens) + fieldNum(u.output_tokens);
        }
      }
    }
    const content = msg?.content;
    if (Array.isArray(content))
      for (const b of content)
        if (b?.type === "tool_use") {
          toolCalls++;
          if (typeof b.name === "string") lastToolName = b.name;
        }
  }
  return {
    tokens,
    toolCalls,
    firstTs,
    lastTs,
    model,
    lastToolName,
    promptPreview,
  };
}

/** Parse a run's journal.jsonl into spawn order + each agent's recorded result. A `result` entry means
 *  that agent returned (done); an agent seen only via `started` is still running. Malformed lines skip. */
function parseJournal(text: string): {
  order: string[];
  resultOf: Map<string, unknown>;
} {
  const order: string[] = [];
  const seen = new Set<string>();
  const resultOf = new Map<string, unknown>();
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let row: any;
    try {
      row = JSON.parse(s);
    } catch {
      continue;
    }
    const agentId = typeof row?.agentId === "string" ? row.agentId : undefined;
    if (!agentId) continue;
    if (!seen.has(agentId)) {
      seen.add(agentId);
      order.push(agentId);
    }
    if (row?.type === "result") resultOf.set(agentId, row.result);
  }
  return { order, resultOf };
}

function previewOf(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text ? text.slice(0, 280) : undefined;
}

/** Build the live agents from spawn order + each agent's scanned rows + its journal result. State is "done"
 *  when the journal recorded a result, else "running". phaseIndex is 0 (phase-less): the agent→phase map
 *  only materializes in the terminal record, so live agents read ungrouped, labelled by spawn position. */
function buildLiveAgents(
  order: string[],
  resultOf: Map<string, unknown>,
  rowsOf: Map<string, any[]>,
): WorkflowAgent[] {
  return order.map((id, i) => {
    const scan = scanAgentRows(rowsOf.get(id) ?? []);
    const started = Number.isFinite(scan.firstTs);
    const durationMs =
      started && scan.lastTs >= scan.firstTs ? scan.lastTs - scan.firstTs : 0;
    return {
      id,
      index: i + 1,
      label: `agent ${i + 1}`,
      phaseIndex: 0,
      phaseTitle: "",
      model:
        scan.model !== undefined ? normalizeModelId(scan.model) : undefined,
      state: resultOf.has(id) ? "done" : "running",
      startMs: started ? scan.firstTs : undefined,
      lastProgressMs: Number.isFinite(scan.lastTs) ? scan.lastTs : undefined,
      durationMs,
      tokens: scan.tokens,
      toolCalls: scan.toolCalls,
      lastToolName: scan.lastToolName,
      promptPreview: scan.promptPreview,
      resultPreview: resultOf.has(id) ? previewOf(resultOf.get(id)) : undefined,
    };
  });
}

/** Earliest parseable timestamp (ms) among rows, or Infinity when none — used to order the un-journaled
 *  agent tail by spawn time so the plan binding sees true spawn order. */
function firstTsOf(rows: any[]): number {
  let first = Infinity;
  for (const row of rows) {
    const ts =
      typeof row?.timestamp === "string" ? Date.parse(row.timestamp) : NaN;
    if (!Number.isNaN(ts) && ts < first) first = ts;
  }
  return first;
}

/** Build a full in-progress run from its name + journal + each agent's rows, binding to the parsed plan
 *  when possible. startMs is the earliest agent start (the script's mtime when none started yet);
 *  durationMs is the elapsed span to the last agent activity. Phases come from the plan: real per-phase
 *  status when bound, the declared strip (all pending) on fallback, empty when there's no plan. Pure. */
export function buildLiveRun(
  runId: string,
  workflowName: string,
  journalText: string,
  rowsOf: Map<string, any[]>,
  startFallbackMs: number,
  plan: WorkflowPlan | null,
): WorkflowRun {
  const { order, resultOf } = parseJournal(journalText);
  // Spawn order: journal `started` order first, then any agent with a transcript but no journal line yet,
  // those sorted by their own first timestamp (the journal lags behind live spawning).
  const journaled = new Set(order);
  const extra = [...rowsOf.keys()]
    .filter((id) => !journaled.has(id))
    .map((id) => ({ id, ts: firstTsOf(rowsOf.get(id) ?? []) }))
    .sort((a, b) => a.ts - b.ts)
    .map((x) => x.id);
  const ids = [...order, ...extra];

  const baseAgents = buildLiveAgents(ids, resultOf, rowsOf);
  const bound = bindLiveAgents(plan, baseAgents);
  const agents = bound ?? baseAgents;

  const phases =
    plan === null ? [] : derivePhaseStatuses(plan.phases, agents, "running");

  const starts = agents
    .map((a) => a.startMs)
    .filter((s): s is number => s !== undefined);
  const startMs = starts.length ? Math.min(...starts) : startFallbackMs;
  const ends = agents.map((a) => (a.startMs ?? startMs) + a.durationMs);
  const lastMs = ends.length ? Math.max(...ends) : startMs;
  return {
    runId,
    workflowName,
    status: "running",
    agentCount: agents.length,
    totalTokens: agents.reduce((n, a) => n + a.tokens, 0),
    totalToolCalls: agents.reduce((n, a) => n + a.toolCalls, 0),
    durationMs: Math.max(0, lastMs - startMs),
    startMs,
    phaseCount: phases.length,
    phases,
    agents,
    logs: [],
  };
}

/** The summary projection of a full run (drop the drill-only phases/agents/output fields). */
function summaryOf(run: WorkflowRun): WorkflowRunSummary {
  return {
    runId: run.runId,
    workflowName: run.workflowName,
    status: run.status,
    args: run.args,
    agentCount: run.agentCount,
    totalTokens: run.totalTokens,
    totalToolCalls: run.totalToolCalls,
    durationMs: run.durationMs,
    startMs: run.startMs,
    phaseCount: run.phaseCount,
    defaultModel: run.defaultModel,
  };
}

/** Find the persisted script for a runId → its workflow name, mtime, and source, or null when none. */
function findScript(
  scriptsDir: string,
  runId: string,
): { workflowName: string; mtimeMs: number; source: string } | null {
  let names: string[];
  try {
    names = readdirSync(scriptsDir);
  } catch {
    return null;
  }
  for (const name of names) {
    const parsed = parseScriptName(name);
    if (parsed?.runId !== runId) continue;
    let mtimeMs = 0;
    let source = "";
    try {
      mtimeMs = statSync(join(scriptsDir, name)).mtimeMs;
      source = readFileSync(join(scriptsDir, name), "utf8");
    } catch {
      // 0 mtime / empty source are acceptable fallbacks.
    }
    return { workflowName: parsed.workflowName, mtimeMs, source };
  }
  return null;
}

/** Read a live run's journal + each agent transcript from subagents/workflows/<runId>/. Empty when the dir
 *  is absent — a just-started run with only a script reconstructs to zero agents, which is correct. */
function readLiveRunSources(
  agentsRoot: string,
  runId: string,
): { journalText: string; rowsOf: Map<string, any[]> } {
  const dir = join(agentsRoot, runId);
  const rowsOf = new Map<string, any[]>();
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return { journalText: "", rowsOf };
  }
  let journalText = "";
  try {
    journalText = readFileSync(join(dir, "journal.jsonl"), "utf8");
  } catch {
    // No journal yet; agents may still exist.
  }
  for (const name of names) {
    if (!name.startsWith("agent-") || !name.endsWith(".jsonl")) continue;
    const id = name.slice("agent-".length, -".jsonl".length);
    try {
      rowsOf.set(id, parseJsonlRows(readFileSync(join(dir, name), "utf8")));
    } catch {
      rowsOf.set(id, []);
    }
  }
  return { journalText, rowsOf };
}

/** Reconstruct one in-progress run, or null when no script names that runId. */
export function readLiveWorkflowRun(
  scriptsDir: string,
  agentsRoot: string,
  runId: string,
): WorkflowRun | null {
  const script = findScript(scriptsDir, runId);
  if (script === null) return null;
  const { journalText, rowsOf } = readLiveRunSources(agentsRoot, runId);
  const plan = parseWorkflowScript(script.source);
  return buildLiveRun(
    runId,
    script.workflowName,
    journalText,
    rowsOf,
    script.mtimeMs,
    plan,
  );
}

/** Summaries of every in-progress run (a persisted script with no terminal record), reconstructed from its
 *  journal + agents. Runs whose id is in `terminal` are skipped — the terminal record wins. */
export function listLiveRunSummaries(
  scriptsDir: string,
  agentsRoot: string,
  terminal: Set<string>,
): WorkflowRunSummary[] {
  let names: string[];
  try {
    names = readdirSync(scriptsDir);
  } catch {
    return [];
  }
  const out: WorkflowRunSummary[] = [];
  for (const name of names) {
    const parsed = parseScriptName(name);
    if (parsed === null || terminal.has(parsed.runId)) continue;
    const run = readLiveWorkflowRun(scriptsDir, agentsRoot, parsed.runId);
    if (run !== null) out.push(summaryOf(run));
  }
  return out;
}

/** Newest mtime (ms) of one live run's evidence: its script plus its journal + agent transcripts. The
 *  readWorkflowRun change token for a run with no terminal record yet — journal growth advances it. */
export function liveRunNewestMtime(
  scriptsDir: string,
  agentsRoot: string,
  runId: string,
): number {
  const script = findScript(scriptsDir, runId);
  const scriptMtime = script?.mtimeMs ?? 0;
  const m = newestMtime(join(agentsRoot, runId), (n) => n.endsWith(".jsonl"));
  return Math.max(scriptMtime, m);
}

/** Newest mtime (ms) across all live-run evidence: every persisted script and every run's journal + agent
 *  transcripts. Folded into readWorkflows' change token so a live run's progress re-triggers the poll. */
export function liveWorkflowsNewestMtime(
  scriptsDir: string,
  agentsRoot: string,
): number {
  let newest = newestMtime(scriptsDir, (n) => n.endsWith(".js"));
  let runDirs: string[];
  try {
    runDirs = readdirSync(agentsRoot);
  } catch {
    return newest;
  }
  for (const runId of runDirs) {
    const m = newestMtime(join(agentsRoot, runId), (n) => n.endsWith(".jsonl"));
    if (m > newest) newest = m;
  }
  return newest;
}
