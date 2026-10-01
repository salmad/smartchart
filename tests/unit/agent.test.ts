import { test } from "vitest";
import assert from "node:assert/strict";
import { runTurn } from "../../src/engine/agent/agent";
import type { AgentDeck, AgentSlide, MeasureFn } from "../../src/engine/agent/agent";
import type { ChatMessage } from "../../src/engine/agent/llm";
import type { Slide } from "../../src/engine/types";
import { fakeAgent, fakeJev, say, toolCall } from "./fakes";
import { must } from "./must";

const CHART: Slide = { template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m", source: "Company accounts",
  chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] }] } };
const noIssues = (): string[] => [];
const setup = (slides: AgentSlide[] = []) => {
  const deck: AgentDeck = { style: "consulting", theme: "ink", slides };
  const measure: MeasureFn = Object.assign(noIssues, { lines: 1 });
  return { deck, history: [] as ChatMessage[], working: new Set<string>(), measure, log: () => {} };
};
/** A title over 40 characters wraps to 3 lines. */
const wrapsLongTitles = (): MeasureFn => Object.assign((s: Slide) => (s.title.length > 40 ? ["title wraps to 3 lines (max 2); shorten it"] : []), { lines: 1 });
const text = (m: ChatMessage | undefined) => m?.content ?? "";
const reservedId = (messages: ChatMessage[]) => JSON.parse(text(messages.filter((m) => m.role === "tool").at(-1))).slideId;
const slideAt = (deck: AgentDeck, i: number) => must(deck.slides[i]?.slide, `slides[${i}].slide`);
const seriesOf = (s: Slide) => must(s.chart?.series, "chart.series");

test("new slide: PRE creates it, one GLM call writes it and ends the turn", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide: CHART, reply: "Added the revenue chart." })]);
  const r = await runTurn({ ...ctx, text: "Revenue £2.1m, 4.8, 7.2, 9.4 for 2022–25", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.95], template: ["chart", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  assert.equal(r.reply, "Added the revenue chart.");
  assert.equal(ctx.deck.slides.length, 1);
  assert.equal(seriesOf(slideAt(ctx.deck, 0))[0].mark, "bar");
  assert.equal(text(ctx.history.at(-1)), "Added the revenue chart.");
});

test("edit: PRE reads the selected slide; one patch changes only the title", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([(m) => {
    assert.ok(text(m.at(-1)).startsWith("Working slides"), "working block is last");
    assert.ok(text(m.at(-1)).includes("s_ab12"));
    return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in three years" }, reply: "Shortened the title." });
  }]);
  const r = await runTurn({ ...ctx, text: "Shorter title", selection: { slideId: "s_ab12" },
    models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  const after = slideAt(ctx.deck, 0);
  assert.equal(after.title, "Revenue grew [[4.5×]] in three years");
  assert.deepEqual({ ...after, title: null }, { ...CHART, title: null });
  assert.ok(ctx.working.has("s_ab12"));
});

test("edit_slide on an existing slide is refused", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("edit_slide", { slideId: "s_ab12", slide: CHART }), say("Done.")]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  const out = JSON.parse(text(ctx.history.find((m) => m.role === "tool")));
  assert.equal(out.applied, false);
  assert.ok(out.error.includes("patch_slide"));
});

test("a patch with a shape error applies nothing; the next step sees the old slide", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "chart.series[0].mark": "pie" } }), say("Could not.")]);
  await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  assert.equal(seriesOf(slideAt(ctx.deck, 0))[0].mark, "bar");
  assert.equal(JSON.parse(text(ctx.history.find((m) => m.role === "tool"))).applied, false);
});

test("over-long text is shortened by a small call, not another agent step", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  ctx.measure = wrapsLongTitles();
  const agentStep = fakeAgent([
    toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] from £2.1m to £9.4m over three straight years of growth" }, reply: "Done." }),
    (m) => { assert.ok(text(m[0]).startsWith("You shorten")); return say("Revenue grew [[4.5×]], £2.1m to £9.4m"); },
    say("Revenue grew [[4.5×]], £2.1m to £9.4m"),
  ]);
  const r = await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 2);
  assert.equal(r.reply, "Done.");
  assert.equal(slideAt(ctx.deck, 0).title, "Revenue grew [[4.5×]], £2.1m to £9.4m");
  assert.deepEqual(ctx.deck.slides[0].issues, []);
});

test("a shortened text that drops a figure is rejected; the agent fixes it", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  ctx.measure = wrapsLongTitles();
  const agentStep = fakeAgent([
    toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in 36 months across all of our customer segments" } }),
    say("Revenue grew [[4.5×]] across segments"), say("Revenue grew [[4.5×]] across segments"),
    (m) => { assert.ok(text(m.at(-1)).includes("in 36 months across all")); return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in 36 months" } }); },
    say("Shortened."),
  ]);
  const r = await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  assert.equal(r.reply, "Shortened.");
  assert.equal(slideAt(ctx.deck, 0).title, "Revenue grew [[4.5×]] in 36 months");
  ctx.history.filter((m) => m.role === "tool" && text(m).includes("\"applied\"")).forEach((m) => assert.ok(!text(m).includes("\"chart\"")));
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
  const agentStep = fakeAgent([(m) => { assert.ok(!text(m.at(-1)).includes("s_cd34")); return toolCall("patch_slide", { set: { title: "Revenue grew [[4.5×]]" }, reply: "Done." }); }]);
  await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(slideAt(ctx.deck, 0).title, "Revenue grew [[4.5×]]");
});

test("auto choices are resolved by Jev in the write path", async () => {
  const ctx = setup();
  const slide: Slide = { ...CHART, focus: "auto", chart: { ...CHART.chart, series: [{ name: "Revenue", mark: "auto", values: [2.1, 4.8, 7.2, 9.4] }] } };
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide, reply: "Done." })]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9], mark0: ["line", 0.8], focus: ["item0", 0.9] }) } });
  const s = slideAt(ctx.deck, 0);
  assert.equal(seriesOf(s)[0].mark, "line");
  assert.equal(seriesOf(s)[0].color, "focus");
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
  assert.equal(seriesOf(slideAt(ctx.deck, 0))[1].mark, "bar");
});

test("building a new slide hides the selected slide unless it was read this turn", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([
    toolCall("create_slide", { about: "plan", template: "steps" }),
    (m) => { assert.ok(!text(m.at(-1)).includes("s_ab12"), "old slide not in the working block"); return say("Which steps?"); },
  ]);
  await runTurn({ ...ctx, text: "a plan", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["ask", 0.5] }) } });
});

test("a patch path missing its object prefix is completed when unambiguous", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "series[0].name": "Sales" }, reply: "Renamed." })]);
  await runTurn({ ...ctx, text: "rename the series to Sales", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(seriesOf(slideAt(ctx.deck, 0))[0].name, "Sales");
  assert.ok(!("series" in slideAt(ctx.deck, 0)));
});

test("a template change the user did not ask for is refused: the agent asks, and the slide keeps its template", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("create_slide", { about: "x", replace: "s_ab12", template: "table" }), say("Should I switch it to a table?\n1. Switch it to a table\n2. Keep the chart")]);
  const r = await runTurn({ ...ctx, text: "remove the 2022 bar", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  const out = JSON.parse(text(ctx.history.filter((m) => m.role === "tool").at(-1)));
  assert.equal(out.confirm, "template");
  assert.match(out.error, /needs the user's go-ahead/);
  assert.equal(slideAt(ctx.deck, 0).template, "chart");
  assert.match(r.reply, /1\. Switch/);
});

test("a template change the user asked for goes ahead", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([say("Switched.")]);
  await runTurn({ ...ctx, text: "show this as a table", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["change_template", 0.9], template: ["table", 0.9] }) } });
  const out = JSON.parse(text(ctx.history.find((m) => m.role === "tool")));
  assert.equal(out.confirm, undefined);
  assert.equal(out.template, "table");
});

test("after the agent asked, the user's answer lets the template change through on the next turn", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const ask = fakeAgent([toolCall("create_slide", { about: "x", replace: "s_ab12", template: "table" }), say("1. Switch it to a table\n2. Keep the chart")]);
  await runTurn({ ...ctx, text: "tidy this up", selection: { slideId: "s_ab12" }, models: { agentStep: ask, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  const yes = fakeAgent([toolCall("create_slide", { about: "x", replace: "s_ab12", template: "table" }), say("Switching.")]);
  await runTurn({ ...ctx, text: "1", selection: { slideId: "s_ab12" }, models: { agentStep: yes, jev: fakeJev({ intent: ["other", 0.6] }) } });
  const out = JSON.parse(text(ctx.history.filter((m) => m.role === "tool").at(-1)));
  assert.equal(out.confirm, undefined);
  assert.equal(out.template, "table");
});

test("create_slide offers every template, the big number and the quote included", async () => {
  const { TOOLS } = await import("../../src/engine/agent/agent-prompt");
  const create = JSON.stringify(TOOLS.find((t) => t.function.name === "create_slide"));
  for (const id of ["number", "quote", "pair", "summary"]) assert.ok(create.includes(`"${id}"`), id);
});

test("a cover or section the user did not ask for is refused: decks open on content", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([toolCall("create_slide", { about: "Q3 review", template: "cover" }), say("Ok.")]);
  await runTurn({ ...ctx, text: "Turn this into slides for the exec team. Revenue grew from £4.2m to £5.1m.", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["several_slides", 0.9] }) } });
  const out = JSON.parse(text(ctx.history.find((m) => m.role === "tool")));
  assert.match(out.error, /did not ask for a cover/);
  assert.equal(ctx.deck.slides.length, 0);
});

test("a cover the user asked for is made", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([toolCall("create_slide", { about: "Q3 review", template: "cover" }), say("Ok.")]);
  await runTurn({ ...ctx, text: "Add a cover slide: Q3 review", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["other", 0.5] }) } });
  const out = JSON.parse(text(ctx.history.find((m) => m.role === "tool")));
  assert.equal(out.template, "cover");
});

test("several slides: a reply on the first write does not end the turn while reserved slides are unwritten", async () => {
  const ctx = setup();
  const ids = (m: ChatMessage[]) => m.filter((x) => x.role === "tool").map((x) => JSON.parse(text(x)).slideId).filter(Boolean);
  const agentStep = fakeAgent([
    toolCall("create_slide", { about: "revenue", template: "chart" }),
    toolCall("create_slide", { about: "margin", template: "chart" }),
    (m) => toolCall("edit_slide", { slideId: ids(m)[0], slide: CHART, reply: "Done." }),
    (m) => { assert.match(text(m.filter((x) => x.role === "tool").at(-1)), /Still to write/); return toolCall("edit_slide", { slideId: ids(m)[1], slide: CHART, reply: "Both done." }); },
  ]);
  const r = await runTurn({ ...ctx, text: "Turn this into slides: revenue and margin", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["several_slides", 0.9] }) } });
  assert.equal(ctx.deck.slides.length, 2);
  assert.equal(r.reply, "Both done.");
});

test("attached files: the writer reads them in full, Jev routes on the brief, and words in a file are not the user's ask", async () => {
  const ctx = setup();
  const doc = "Board report. Revenue by segment, stacked by region. " + "Detail. ".repeat(4000);
  const full = `Make the revenue slide\n\n<file name="report.pdf">\n${doc}\n</file>`;
  const jev = fakeJev({ intent: ["new_slide", 0.95], template: ["chart", 0.9] });
  const agentStep = fakeAgent([(m) => {
    assert.ok(m.some((x) => x.role === "user" && text(x).includes(doc)), "the writer gets the whole file");
    const two: Slide = { ...CHART, chart: { ...must(CHART.chart, "chart"), series: [{ name: "UK", mark: "bar", values: [1, 2, 3, 4] }, { name: "EU", mark: "bar", values: [1, 1, 2, 2] }], stacking: "auto" } };
    return toolCall("edit_slide", { slideId: reservedId(m), slide: two, reply: "Done." });
  }]);
  await runTurn({ ...ctx, text: full, ask: "Make the revenue slide", brief: "Make the revenue slide\n\nAttached report.pdf, starting: Board report.", selection: null, models: { agentStep, jev } });
  assert.ok(jev.calls.every((c) => !c.state.includes("Detail. Detail. Detail.")), "Jev never gets the whole file");
  assert.ok(jev.calls[0].state.includes("Attached report.pdf"));
});
