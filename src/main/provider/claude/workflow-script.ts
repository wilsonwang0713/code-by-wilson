import { parse } from "acorn";
import type { WorkflowAgent } from "@shared/types";

/** One declared agent from a script's `agent(prompt, { label, phase })` call site. */
export interface DeclaredAgent {
  label: string;
  phaseTitle: string;
}

/** The statically-recovered plan of a workflow run, from its persisted script. */
export interface WorkflowPlan {
  /** From `meta.phases`, 1-based by declared position. */
  phases: { index: number; title: string; detail?: string }[];
  /** Declared agents in declared order (parallel/pipeline expanded). */
  declaredAgents: DeclaredAgent[];
  /** False when the script has non-static fan-out (map/loop/dynamic array) — caller must fall back. */
  enumerable: boolean;
}

type Node = any;

/** Depth-first walk over an acorn AST, visiting every child node with the ancestor stack. */
function walk(
  node: Node,
  visit: (n: Node, stack: Node[]) => void,
  stack: Node[] = [],
): void {
  if (!node || typeof node.type !== "string") return;
  visit(node, stack);
  const next = [...stack, node];
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit, next);
    } else {
      walk(child, visit, next);
    }
  }
}

/** A property key, whether written `label:` (Identifier) or `'label':` (Literal). */
function keyOf(prop: Node): string | undefined {
  return prop?.key?.name ?? prop?.key?.value;
}

/** Reconstruct a string Literal or TemplateLiteral to its static text; other nodes → undefined.
 *  A `${expr}` keeps its identifier name (`analyze-s1:${item}`) or `${…}` for a complex expression. */
function staticString(node: Node): string | undefined {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral") {
    let out = "";
    node.quasis.forEach((q: Node, i: number) => {
      out += q.value?.cooked ?? "";
      if (i < node.expressions.length) {
        const e = node.expressions[i];
        out += "${" + (e?.type === "Identifier" ? e.name : "…") + "}";
      }
    });
    return out;
  }
  return undefined;
}

/** From an `agent(prompt, { label, phase })` call → its declared label + phase, best-effort. */
function agentOpts(call: Node): DeclaredAgent {
  let label = "";
  let phaseTitle = "";
  const opts = call.arguments?.[1];
  if (opts?.type === "ObjectExpression") {
    for (const p of opts.properties) {
      const k = keyOf(p);
      if (k === "label") label = staticString(p.value) ?? "";
      else if (k === "phase") phaseTitle = staticString(p.value) ?? "";
    }
  }
  return { label, phaseTitle };
}

function isCallTo(node: Node, name: string): boolean {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    node.callee.name === name
  );
}

/** Every `agent()` CallExpression within a subtree (e.g., an arrow-fn thunk). */
function agentCallsIn(node: Node): Node[] {
  const out: Node[] = [];
  walk(node, (n) => {
    if (isCallTo(n, "agent")) out.push(n);
  });
  return out;
}

/** `meta.phases` → ordered phase descriptors, or [] when absent. */
function extractPhases(program: Node): WorkflowPlan["phases"] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let metaObj: Node = undefined;
  walk(program, (n) => {
    if (metaObj) return;
    if (
      n.type === "VariableDeclarator" &&
      n.id?.name === "meta" &&
      n.init?.type === "ObjectExpression"
    )
      metaObj = n.init;
  });
  if (!metaObj) return [];
  const phasesProp = metaObj.properties.find(
    (p: Node) => keyOf(p) === "phases",
  );
  if (phasesProp?.value?.type !== "ArrayExpression") return [];
  return phasesProp.value.elements.map((el: Node, i: number) => {
    const phase: { index: number; title: string; detail?: string } = {
      index: i + 1,
      title: `Phase ${i + 1}`,
    };
    if (el?.type === "ObjectExpression") {
      for (const p of el.properties) {
        const k = keyOf(p);
        if (k === "title") phase.title = staticString(p.value) ?? phase.title;
        else if (k === "detail") {
          const d = staticString(p.value);
          if (d) phase.detail = d;
        }
      }
    }
    return phase;
  });
}

// Scans only top-level declarations on purpose — persisted workflow scripts are flat; a nested const array reads as non-resolvable and falls back.
/** Top-level `const <id> = [ … ]` → id → element count, so `pipeline(items, …)` can resolve `items`. */
function constArrayLengths(program: Node): Map<string, number> {
  const out = new Map<string, number>();
  for (const stmt of program.body ?? []) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const d of stmt.declarations) {
      if (d.id?.type === "Identifier" && d.init?.type === "ArrayExpression")
        out.set(d.id.name, d.init.elements.length);
    }
  }
  return out;
}

/** Resolve a `parallel`/`pipeline` array argument to its length, or null when not statically known. */
function arrayLen(arg: Node, consts: Map<string, number>): number | null {
  if (arg?.type === "ArrayExpression") return arg.elements.length;
  if (arg?.type === "Identifier" && consts.has(arg.name))
    return consts.get(arg.name)!;
  return null;
}

/** Expand the declared agents in declared order; set enumerable=false on any dynamic fan-out. */
function collectDeclaredAgents(program: Node): {
  declaredAgents: DeclaredAgent[];
  enumerable: boolean;
} {
  const consts = constArrayLengths(program);
  let enumerable = true;

  // Any orchestration call inside a loop or an array .map/.flatMap callback is dynamic.
  const isLoop = (n: Node): boolean =>
    n.type === "ForStatement" ||
    n.type === "ForOfStatement" ||
    n.type === "ForInStatement" ||
    n.type === "WhileStatement" ||
    n.type === "DoWhileStatement";
  const isMapCall = (n: Node): boolean =>
    n.type === "CallExpression" &&
    n.callee?.type === "MemberExpression" &&
    (n.callee.property?.name === "map" ||
      n.callee.property?.name === "flatMap" ||
      n.callee.property?.value === "map" ||
      n.callee.property?.value === "flatMap");
  walk(program, (n, stack) => {
    if (
      isCallTo(n, "agent") ||
      isCallTo(n, "parallel") ||
      isCallTo(n, "pipeline")
    ) {
      if (stack.some((s) => isLoop(s) || isMapCall(s))) enumerable = false;
    }
  });

  // Collect orchestration calls in source order; expand; dedup agents already consumed by a parent.
  const calls: Node[] = [];
  walk(program, (n) => {
    if (
      isCallTo(n, "agent") ||
      isCallTo(n, "parallel") ||
      isCallTo(n, "pipeline")
    )
      calls.push(n);
  });
  calls.sort((a, b) => a.start - b.start);

  const declaredAgents: DeclaredAgent[] = [];
  const consumed = new Set<Node>();
  for (const call of calls) {
    if (consumed.has(call)) continue;
    const name = call.callee.name;
    if (name === "parallel") {
      const arr = call.arguments?.[0];
      if (arr?.type !== "ArrayExpression") {
        enumerable = false;
        for (const a of agentCallsIn(call)) consumed.add(a);
        continue;
      }
      for (const el of arr.elements) {
        for (const a of agentCallsIn(el)) {
          consumed.add(a);
          declaredAgents.push(agentOpts(a));
        }
      }
    } else if (name === "pipeline") {
      const len = arrayLen(call.arguments?.[0], consts);
      const stages = (call.arguments ?? []).slice(1);
      for (const s of stages) for (const a of agentCallsIn(s)) consumed.add(a);
      if (len === null) {
        enumerable = false;
        continue;
      }
      // Stage-major: stage 1 for every item, then stage 2 for every item, …
      for (const stage of stages) {
        const inner = agentCallsIn(stage);
        const opts = inner.length
          ? agentOpts(inner[0])
          : { label: "", phaseTitle: "" };
        for (let i = 0; i < len; i++) declaredAgents.push({ ...opts });
      }
    } else {
      // bare agent()
      declaredAgents.push(agentOpts(call));
    }
  }
  return { declaredAgents, enumerable };
}

/** Fill live agents (in spawn order) into the plan: declared label, phase title, and phase index per
 *  agent. Returns null — caller falls back to generic agents — when the plan is absent, non-enumerable,
 *  or there are more live agents than the plan declared (the static count was wrong: dynamic fan-out).
 *  An agent whose declared phase isn't in `meta.phases` stays unbound rather than breaking the rest. */
export function bindLiveAgents(
  plan: WorkflowPlan | null,
  liveAgents: WorkflowAgent[],
): WorkflowAgent[] | null {
  if (!plan || !plan.enumerable) return null;
  if (liveAgents.length > plan.declaredAgents.length) return null;
  const indexByTitle = new Map(plan.phases.map((p) => [p.title, p.index]));
  return liveAgents.map((a, i) => {
    const d = plan.declaredAgents[i];
    const phaseIndex = indexByTitle.get(d.phaseTitle);
    if (phaseIndex === undefined) return a; // declared phase not in meta.phases → leave unbound
    return {
      ...a,
      label: d.label || a.label,
      phaseTitle: d.phaseTitle,
      phaseIndex,
    };
  });
}

/** Parse a persisted workflow script into its plan, or null when acorn can't parse it. The persisted
 *  file mixes ESM (`export const meta`) with a top-level `await` and `return` (the harness wraps the body),
 *  so the permissive flags below are required. */
export function parseWorkflowScript(source: string): WorkflowPlan | null {
  let program: Node;
  try {
    program = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
    });
  } catch {
    return null;
  }
  const phases = extractPhases(program);
  const { declaredAgents, enumerable } = collectDeclaredAgents(program);
  return { phases, declaredAgents, enumerable };
}
