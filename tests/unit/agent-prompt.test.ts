import { test } from "vitest";
import assert from "node:assert/strict";
import { TOOLS, agentSystem, workingBlock } from "../../src/engine/agent/agent-prompt";

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
  for (const id of ["chart", "table", "number", "steps", "cards"] as const) for (const style of ["consulting", "pitch"] as const) {
    const ex = JSON.parse(exampleFor(id, style));
    for (const k of ["takeaway", "notes", "kicker", "footnote", "source"]) assert.equal(ex[k], undefined, `${id} ${style} ${k}`);
    assert.equal(ex.chart?.annotations, undefined);
  }
});
