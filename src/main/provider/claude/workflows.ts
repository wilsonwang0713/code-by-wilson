import { readdirSync, readFileSync } from "node:fs";
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
