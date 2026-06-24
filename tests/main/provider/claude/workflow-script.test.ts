import { describe, it, expect } from "vitest";
import { parseWorkflowScript } from "../../../../src/main/provider/claude/workflow-script";

// Mirrors the real demo-orchestration script: ESM export + top-level await + return,
// a parallel fan-out, a pipeline over a const literal array, and a final single agent.
const DEMO = `export const meta = {
  name: 'demo',
  phases: [
    { title: 'Scan', detail: '2 scouts' },
    { title: 'Analyze', detail: 'pipeline' },
    { title: 'Verify', detail: '2 verifiers' },
    { title: 'Synthesize', detail: '1 agent' },
  ],
}
const scouts = (await parallel([
  () => agent('a', { label: 'scout:alpha', phase: 'Scan' }),
  () => agent('b', { label: 'scout:beta', phase: 'Scan' }),
])).filter(Boolean)
const items = ['item-1', 'item-2']
const analyzed = (await pipeline(
  items,
  (item) => agent('s1', { label: \`analyze-s1:\${item}\`, phase: 'Analyze' }),
  (p, item) => agent('s2', { label: \`analyze-s2:\${item}\`, phase: 'Analyze' }),
)).filter(Boolean)
const verdicts = (await parallel([
  () => agent('a', { label: 'verify:a', phase: 'Verify' }),
  () => agent('b', { label: 'verify:b', phase: 'Verify' }),
])).filter(Boolean)
const summary = await agent('done', { label: 'synthesize', phase: 'Synthesize' })
return { ok: true }
`;

// A dynamic workflow (map + loop): structure isn't statically enumerable.
const DYNAMIC = `export const meta = { name: 'dyn', phases: [ { title: 'Find' } ] }
const DIMS = [1, 2, 3]
const found = await parallel(DIMS.map((d) => () => agent('p', { label: 'find', phase: 'Find' })))
while (found.length < 3) {
  await agent('more', { label: 'more', phase: 'Find' })
}
return found
`;

describe("parseWorkflowScript", () => {
  it("extracts phases and the expanded declared agents from a static script", () => {
    const plan = parseWorkflowScript(DEMO);
    expect(plan).not.toBeNull();
    expect(plan!.enumerable).toBe(true);
    expect(plan!.phases.map((p) => p.title)).toEqual([
      "Scan",
      "Analyze",
      "Verify",
      "Synthesize",
    ]);
    expect(plan!.phases[0]).toEqual({
      index: 1,
      title: "Scan",
      detail: "2 scouts",
    });
    // 2 scouts + (2 items x 2 stages) + 2 verifiers + 1 synth = 9
    expect(plan!.declaredAgents).toHaveLength(9);
    expect(plan!.declaredAgents[0]).toEqual({
      label: "scout:alpha",
      phaseTitle: "Scan",
    });
    expect(plan!.declaredAgents[1]).toEqual({
      label: "scout:beta",
      phaseTitle: "Scan",
    });
    expect(plan!.declaredAgents.slice(2, 6).map((a) => a.phaseTitle)).toEqual([
      "Analyze",
      "Analyze",
      "Analyze",
      "Analyze",
    ]);
    expect(plan!.declaredAgents[2].label).toBe("analyze-s1:${item}"); // template kept as static text
    expect(plan!.declaredAgents[8]).toEqual({
      label: "synthesize",
      phaseTitle: "Synthesize",
    });
  });

  it("marks a map/loop workflow non-enumerable but still reads its phases", () => {
    const plan = parseWorkflowScript(DYNAMIC);
    expect(plan).not.toBeNull();
    expect(plan!.enumerable).toBe(false);
    expect(plan!.phases.map((p) => p.title)).toEqual(["Find"]);
  });

  it("returns null on an unparseable script", () => {
    expect(parseWorkflowScript("this is { not valid")).toBeNull();
  });
});
