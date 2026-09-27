import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "../journey/agent.js";
import { fakeAgent, fakeJev, say, toolCall } from "./fakes.js";

const CHART = { template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m", source: "Company accounts",
  chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] }] } };
const setup = (slides = []) => {
  const measure = () => []; measure.lines = 1;
  return { deck: { style: "consulting", theme: "ink", slides }, history: [], working: new Set(), measure, log: () => {} };
};
const reservedId = (messages) => JSON.parse(messages.findLast((m) => m.role === "tool").content).slideId;

test("new slide: PRE creates it, one GLM call writes it and ends the turn", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide: CHART, reply: "Added the revenue chart." })]);
  const r = await runTurn({ ...ctx, text: "Revenue £2.1m, 4.8, 7.2, 9.4 for 2022–25", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.95], template: ["chart", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  assert.equal(r.reply, "Added the revenue chart.");
  assert.equal(ctx.deck.slides.length, 1);
  assert.equal(ctx.deck.slides[0].slide.chart.series[0].mark, "bar");
  assert.equal(ctx.history.at(-1).content, "Added the revenue chart.");
});

test("edit: PRE reads the selected slide; one patch changes only the title", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([(m) => {
    assert.ok(m.at(-1).content.startsWith("Working slides"), "working block is last");
    assert.ok(m.at(-1).content.includes("s_ab12"));
    return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in three years" }, reply: "Shortened the title." });
  }]);
  const r = await runTurn({ ...ctx, text: "Shorter title", selection: { slideId: "s_ab12" },
    models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  const after = ctx.deck.slides[0].slide;
  assert.equal(after.title, "Revenue grew [[4.5×]] in three years");
  assert.deepEqual({ ...after, title: null }, { ...CHART, title: null });
  assert.ok(ctx.working.has("s_ab12"));
});

test("edit_slide on an existing slide is refused", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("edit_slide", { slideId: "s_ab12", slide: CHART }), say("Done.")]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  const out = JSON.parse(ctx.history.find((m) => m.role === "tool").content);
  assert.equal(out.applied, false);
  assert.ok(out.error.includes("patch_slide"));
});

test("a patch with a shape error applies nothing; the next step sees the old slide", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "chart.series[0].mark": "pie" } }), say("Could not.")]);
  await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  assert.equal(ctx.deck.slides[0].slide.chart.series[0].mark, "bar");
  assert.equal(JSON.parse(ctx.history.find((m) => m.role === "tool").content).applied, false);
});

test("over-long text is shortened by a small call, not another agent step", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  ctx.measure = (s) => (s.title.length > 40 ? ["title wraps to 3 lines (max 2); shorten it"] : []); ctx.measure.lines = 1;
  const agentStep = fakeAgent([
    toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] from £2.1m to £9.4m over three straight years of growth" }, reply: "Done." }),
    (m) => { assert.ok(m[0].content.startsWith("You shorten")); return say("Revenue grew [[4.5×]], £2.1m to £9.4m"); },
    say("Revenue grew [[4.5×]], £2.1m to £9.4m"),
  ]);
  const r = await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 2);
  assert.equal(r.reply, "Done.");
  assert.equal(ctx.deck.slides[0].slide.title, "Revenue grew [[4.5×]], £2.1m to £9.4m");
  assert.deepEqual(ctx.deck.slides[0].issues, []);
});

test("a shortened text that drops a figure is rejected; the agent fixes it", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  ctx.measure = (s) => (s.title.length > 40 ? ["title wraps to 3 lines (max 2); shorten it"] : []); ctx.measure.lines = 1;
  const agentStep = fakeAgent([
    toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in 36 months across all of our customer segments" } }),
    say("Revenue grew [[4.5×]] across segments"), say("Revenue grew [[4.5×]] across segments"),
    (m) => { assert.ok(m.at(-1).content.includes("in 36 months across all")); return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in 36 months" } }); },
    say("Shortened."),
  ]);
  const r = await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  assert.equal(r.reply, "Shortened.");
  assert.equal(ctx.deck.slides[0].slide.title, "Revenue grew [[4.5×]] in 36 months");
  ctx.history.filter((m) => m.role === "tool" && m.content.includes("\"applied\"")).forEach((m) => assert.ok(!m.content.includes("\"chart\"")));
});

test("a sure new slide that ends on a clean write needs no reply call", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide: { ...CHART, footnote: "Illustrative figures" } })]);
  const r = await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  assert.equal(r.reply, "Added a chart slide. The figures are illustrative and marked in the footnote. Showing Revenue as bars; ask if you want it the other way. What would you like to change next?");
});

test("an unsure request still ends with the agent's own reply", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("create_slide", { about: "x", template: "chart" }), (m) => toolCall("edit_slide", { slideId: reservedId(m), slide: CHART }), say("Here it is.")]);
  const r = await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.5], template: ["chart", 0.9] }) } });
  assert.equal(r.modelCalls, 3);
  assert.equal(r.reply, "Here it is.");
  assert.equal(ctx.deck.slides.length, 2);
});

test("after a turn the history drops template cards, examples and whole-slide JSON", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide: CHART, reply: "Done." })]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9] }) } });
  const text = JSON.stringify(ctx.history);
  assert.ok(!text.includes("\\\"card\\\"") && !text.includes("\\\"example\\\""), "no card or example left");
  assert.ok(!text.includes("9.4]"), "no slide data left");
  assert.ok(text.includes("(written)"));
});

test("patch_slide without slideId uses the one working slide; the working set starts with the selection", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }, { id: "s_cd34", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  ctx.working.add("s_cd34");
  const agentStep = fakeAgent([(m) => { assert.ok(!m.at(-1).content.includes("s_cd34")); return toolCall("patch_slide", { set: { title: "Revenue grew [[4.5×]]" }, reply: "Done." }); }]);
  await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(ctx.deck.slides[0].slide.title, "Revenue grew [[4.5×]]");
});

test("auto choices are resolved by Jev in the write path", async () => {
  const ctx = setup();
  const slide = { ...CHART, focus: "auto", chart: { ...CHART.chart, series: [{ name: "Revenue", mark: "auto", values: [2.1, 4.8, 7.2, 9.4] }] } };
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide, reply: "Done." })]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9], mark0: ["line", 0.8], focus: ["item0", 0.9] }) } });
  const s = ctx.deck.slides[0].slide;
  assert.equal(s.chart.series[0].mark, "line");
  assert.equal(s.chart.series[0].color, "focus");
  assert.equal(s.focus, undefined);
});

test("PRE unsure: the agent starts with no tool results", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => { assert.equal(m.filter((x) => x.role === "tool").length, 0); return say("Which figures should I use?"); }]);
  const r = await runTurn({ ...ctx, text: "hmm", selection: null, models: { agentStep, jev: fakeJev({ intent: ["ask", 0.5] }) } });
  assert.equal(r.reply, "Which figures should I use?");
});

test("edit_slide without an id writes the one reserved slide", async () => {
  const ctx = setup();
  const { slideId, ...noId } = { slideId: null, slide: CHART, reply: "Done." };
  const agentStep = fakeAgent([toolCall("edit_slide", noId)]);
  const r = await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9] }) } });
  assert.equal(r.reply, "Done.");
  assert.equal(ctx.deck.slides.length, 1);
});

test("a series added by a patch takes the mark of a series in the same unit", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "chart.series[1]": { name: "Costs", mark: "line", values: [1, 2, 3, 4] } }, reply: "Added." })]);
  await runTurn({ ...ctx, text: "Add costs 1, 2, 3, 4", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(ctx.deck.slides[0].slide.chart.series[1].mark, "bar");
});

test("building a new slide hides the selected slide unless it was read this turn", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([
    toolCall("create_slide", { about: "plan", template: "steps" }),
    (m) => { assert.ok(!m.at(-1).content.includes("s_ab12"), "old slide not in the working block"); return say("Which steps?"); },
  ]);
  await runTurn({ ...ctx, text: "a plan", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["ask", 0.5] }) } });
});

test("a patch path missing its object prefix is completed when unambiguous", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "series[0].name": "Sales" }, reply: "Renamed." })]);
  await runTurn({ ...ctx, text: "rename the series to Sales", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(ctx.deck.slides[0].slide.chart.series[0].name, "Sales");
  assert.ok(!("series" in ctx.deck.slides[0].slide));
});
