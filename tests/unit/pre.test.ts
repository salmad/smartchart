import { test } from "vitest";
import assert from "node:assert/strict";
import { firstCall, preStep, type PreDeck } from "../../src/engine/agent/pre";
import { fakeJev } from "./fakes";

const deck: PreDeck = { style: "consulting", slides: [{ id: "s_ab12", slide: { template: "chart", title: "Revenue grew" } }] };
const sel = { slideId: "s_ab12" };

test("one Jev call with intent, template, lead and position", async () => {
  const jev = fakeJev({ intent: ["new_slide", 0.92], template: ["table", 0.8], lead: ["value", 0.5], after: ["s_ab12", 0.7] });
  const pre = await preStep({ text: "Add our pricing table", deck, selection: sel, jev });
  assert.equal(jev.calls.length, 1);
  assert.deepEqual(Object.keys(jev.calls[0].questions), ["intent", "template", "lead", "after"]);
  assert.equal(pre.intent, "new_slide"); assert.equal(pre.template, "table"); assert.equal(pre.lead, null); assert.equal(pre.after, "s_ab12");
});

test("empty deck: no position question", async () => {
  const jev = fakeJev();
  await preStep({ text: "x", deck: { style: "pitch", slides: [] }, selection: null, jev });
  assert.equal("after" in jev.calls[0].questions, false);
});

test("firstCall acts only when sure and when it can", () => {
  const base = { p: 0.9, template: "table", lead: null, after: "end", probabilities: {} };
  assert.deepEqual(firstCall({ ...base, intent: "new_slide" }, sel, "Add a table", deck), { name: "create_slide", args: { about: "Add a table", after: "end", template: "table" } });
  assert.deepEqual(firstCall({ ...base, intent: "edit_selected" }, sel, "x", deck), { name: "read_slide", args: { slideId: "s_ab12" } });
  assert.deepEqual(firstCall({ ...base, intent: "change_template" }, sel, "as a table", deck), { name: "create_slide", args: { about: "as a table", replace: "s_ab12", template: "table" } });
  assert.equal(firstCall({ ...base, intent: "change_template", template: "chart" }, sel, "x", deck), null, "same template: let the agent decide");
  assert.equal(firstCall({ ...base, intent: "edit_selected" }, null, "x", deck), null, "nothing selected");
  assert.equal(firstCall({ ...base, intent: "new_slide", p: 0.69 }, sel, "x", deck), null);
  for (const intent of ["several_slides", "ask", "other"]) assert.equal(firstCall({ ...base, intent }, sel, "x", deck), null);
});
