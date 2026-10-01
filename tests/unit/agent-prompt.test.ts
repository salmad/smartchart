import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { TOOLS, agentSystem, stateBlock, workingBlock } from "../../src/engine/agent/agent-prompt";

test("four tools; patch_slide takes a set and an optional reply", () => {
  assert.deepEqual(TOOLS.map((t) => t.function.name), ["create_slide", "edit_slide", "patch_slide", "read_slide"]);
  const p = TOOLS[2].function.parameters;
  assert.deepEqual(p.required, ["slideId", "set"]);
  assert.ok(p.properties.reply);
  assert.ok(TOOLS[1].function.parameters.properties.reply);
});

test("the system prompt states the patch rule, auto and the working block", () => {
  const s = agentSystem("consulting");
  for (const phrase of ["patch_slide", "never rewrite", "\"auto\"", "Working slides", "reply", "Start plain", "only when the user asked", "what to change next"]) assert.ok(s.includes(phrase), phrase);
});

test("working block: current JSON, open issues, failed checks", () => {
  const b = workingBlock([{ id: "s_ab12", slide: { template: "number", title: "T" }, issues: ["title: too long"], warnings: [], checks: [{ id: "J2", ok: false, msg: "Body supports the claim only partly" }, { id: "J1", ok: true, msg: "ok" }] }]);
  assert.ok(b.startsWith("Working slides"));
  assert.ok(b.includes('"title":"T"'));
  assert.ok(b.includes("title: too long"));
  assert.ok(b.includes("J2: Body supports the claim only partly"));
  assert.ok(!b.includes("J1"));
  assert.ok(workingBlock([]).includes("none yet"));
});

test("the example the agent copies is plain: no takeaway, notes, kicker, footnote, source or annotations", async () => {
  const { exampleFor } = await import("../../src/engine/agent/prompts");
  for (const id of ["chart", "pair", "table", "steps", "cards", "summary", "number", "quote"] as const) for (const style of ["consulting", "pitch"] as const) {
    const ex = JSON.parse(exampleFor(id, style));
    for (const k of ["takeaway", "notes", "kicker", "footnote", "source"]) assert.equal(ex[k], undefined, `${id} ${style} ${k}`);
    assert.equal(ex.chart?.annotations, undefined);
  }
});

test("nothing is archived: the big number and the quote reach the router, the prompt and create_slide", async () => {
  const { OFFERED, MENU, ARCHIVED, catalogue } = await import("../../src/engine/slides/schema");
  const { MENU_OPTIONS } = await import("../../src/engine/agent/prompts");
  assert.deepEqual(ARCHIVED, []);
  assert.deepEqual([...OFFERED].sort(), Object.keys(MENU).sort());
  for (const id of ["number", "quote"]) { assert.ok(id in MENU_OPTIONS); assert.match(catalogue(), new RegExp(`^${id}:`, "m")); }
  for (const style of ["consulting", "pitch"] as const) assert.match(agentSystem(style), /^- quote:/m);
});

test("the deck state names slides edited by hand since the last turn", () => {
  const block = stateBlock({ style: "consulting", theme: "ink", slides: [{ id: "s1", slide: { template: "section", title: "A" } }], selection: null, edited: ["s1"] });
  assert.match(block, /Edited by hand since the last turn: s1/);
  assert.doesNotMatch(stateBlock({ style: "consulting", theme: "ink", slides: [], selection: null }), /Edited by hand/);
});

test("agentSystem is unchanged by the split into sections", () => {
  expect(agentSystem("consulting")).toMatchSnapshot();
  expect(agentSystem("pitch")).toMatchSnapshot();
});
