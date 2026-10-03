import { test } from "vitest";
import assert from "node:assert/strict";
import { judgmentChecks, numbersIn, nudge, ruleChecks, withNudge } from "../../src/engine/agent/checks";
import type { JevFn, JevQuestion, JevResult } from "../../src/engine/agent/llm";
import type { Chart, Series, Slide, Style } from "../../src/engine/types";

type ChartSlide = Slide & { chart: Chart & { categories: string[]; series: Series[] } };

const get = (s: Slide, id: string, style: Style = "consulting") => ruleChecks(s, style, 1).find((c) => c.id === id);
const chart = (series: Series[], extra: Partial<Chart> = {}): ChartSlide => ({ template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m by 2025", source: "Accounts", chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series, ...extra } });
const REV: Series = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] };

test("numbersIn ignores years", () => assert.deepEqual(numbersIn("£2.1m in 2022 to £9,400k, 4.5×"), [2.1, 9400, 4.5]));
test("numbersIn: a year before a comma is still a year", () => assert.deepEqual(numbersIn("£120m by 2030, £20m ahead"), [120, 20]));

test("R9: comparable series mixing marks, three units, bad stacking", () => {
  assert.equal(get(chart([REV, { ...REV, name: "Cost", color: "neutral", mark: "line" }]), "R9")?.ok, false);
  assert.equal(get(chart([REV, { ...REV, name: "Target", color: "neutral", mark: "line", dashed: true }]), "R9")?.ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "line", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9")?.ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "bar", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9")?.ok, false, "bars in two units");
});

test("R10: four cards warn in consulting; framed and pitch exempt", () => {
  const cards = (n: number, extra: Partial<Slide> = {}): Slide => ({ template: "cards", title: "Four levers move the margin by a third", cards: Array.from({ length: n }, (_, i) => ({ icon: "zap", title: `L${i}`, text: "x" })), ...extra });
  assert.equal(get(cards(4), "R10")?.ok, false);
  assert.equal(get(cards(3), "R10")?.ok, true);
  assert.equal(get(cards(4), "R10", "pitch"), undefined);
});

test("R10: notes are 3 or none in both styles; 2 suggests deleting them", () => {
  const notes = (n: number) => ({ ...chart([REV]), notes: Array.from({ length: n }, (_, i) => ({ title: `N${i}` })) });
  for (const style of ["consulting", "pitch"] as const) {
    assert.equal(get(notes(3), "R10", style)?.ok, true);
    assert.match(get(notes(2), "R10", style)?.msg ?? "", /delete the notes, or add a third/);
    assert.equal(get(notes(2), "R10", style)?.ok, false);
    assert.equal(get(notes(4), "R10", style)?.ok, false);
  }
  assert.equal(get(chart([REV]), "R10"), undefined);
});

test("R11: title figures on the slide or derived", () => {
  assert.equal(get(chart([REV]), "R11")?.ok, true); // 2.1 and 9.4 in the data; 4.5 ≈ 9.4 / 2.1
  const s = chart([REV]); s.title = "Revenue reached £12m by 2025";
  assert.equal(get(s, "R11")?.ok, false);
});

test("R11: a year range's shorthand end is not a headline figure", () => {
  const s = chart([REV]); s.title = "Revenue grew 4.5× across the 2019–20 rules and the 2021–2023 period";
  assert.equal(get(s, "R11")?.ok, true);
  s.title = "Revenue reached £20m across the 2019–20 rules";
  assert.equal(get(s, "R11")?.ok, false);
});

test("R12: consulting title with figures on the slide carries a figure", () => {
  const s = chart([REV]); s.title = "Revenue grew strongly as churn fell";
  assert.equal(get(s, "R12")?.ok, false);
});

test("R13: one unit and precision per column; no false precision", () => {
  const t = (cells: string[]): Slide => ({ template: "table", title: "Plan A leads with 61% margin", source: "x", table: { columns: [{ label: "Plan" }, { label: "Margin" }], rows: cells.map((c, i) => ({ cells: [`P${i}`, c] })) } });
  assert.equal(get(t(["42%", "61%"]), "R13")?.ok, true);
  assert.equal(get(t(["42%", "61.5%"]), "R13")?.ok, false);
  assert.equal(get(t(["42%", "£61"]), "R13")?.ok, false);
  assert.equal(get(t(["9,837,221", "61"]), "R13")?.ok, false);
  const byRow: Slide = { template: "table", title: "Revenue grew 4× as churn fell to 3%", source: "x", table: { columns: [{ label: "Metric" }, { label: "2022" }, { label: "2025" }],
    rows: [{ cells: ["Revenue", "£2.1m", "£9.4m"] }, { cells: ["Churn", "8%", "3%"] }] } };
  assert.equal(get(byRow, "R13")?.ok, true, "rows are the metrics: units hold per row");
});

test("R14: time runs oldest first; single-series bars sorted by value", () => {
  const s = chart([REV]); s.chart.categories = ["2025", "2024", "2023", "2022"];
  assert.equal(get(s, "R14")?.ok, false);
  const bars = chart([{ ...REV, values: [3, 9, 5, 1] }]); bars.chart.categories = ["North", "South", "East", "West"];
  assert.equal(get(bars, "R14")?.ok, false);
  bars.chart.series[0].values = [9, 5, 3, 1];
  assert.equal(get(bars, "R14")?.ok, true);
});

test("R11 accepts figures code computed: a CAGR, a waterfall total, a 100% share", () => {
  const cagr = { ...chart([{ ...REV, values: [10, 12, 15, 20] }], { annotations: [{ type: "cagr", from: 0, to: 3 }] }), title: "Revenue grows [[26% a year]] to £20m" };
  assert.equal(get(cagr, "R11")?.ok, true);
  assert.equal(get({ ...cagr, title: "Revenue grows [[31% a year]] to £20m" }, "R11")?.ok, false);
  const wf: Slide = { template: "chart", title: "ARR reaches £17.5m; [[new]] adds £6.2m", source: "Model", chart: { kind: "waterfall", format: "£{v}m",
    items: [{ label: "FY25", value: 9.8 }, { label: "New", value: 6.2, focus: true }, { label: "Churn", value: -1.4 }, { label: "Price", value: 2.9 }, { label: "FY26", total: true }] } };
  assert.equal(get(wf, "R11")?.ok, true);
  const mix = { ...chart([{ ...REV, color: "neutral", values: [7, 12, 20, 30] }, { ...REV, name: "Card", values: [3, 8, 18, 34] }], { stacking: "percent" }), title: "[[Card]] rises from 30% to 53%" };
  assert.equal(get(mix, "R11")?.ok, true);
});

test("focus counts per chart kind; a timeline carries no figure rules", () => {
  const tl: Slide = { template: "chart", title: "The [[pilot]] is the critical path for the whole launch", chart: { kind: "timeline", periods: ["Q1", "Q2", "Q3"], rows: [{ label: "Build", start: 0, end: 1 }, { label: "Pilot", start: 1, end: 2, focus: true }] } };
  assert.equal(get(tl, "R4")?.ok, true);
  for (const id of ["R5", "R8", "R12", "R14"]) assert.equal(get(tl, id), undefined, id);
});

test("nudge: judgment first, a rule that repeats it left out, at most two, never the passes or a Jev failure", () => {
  const J1 = { id: "J1", ok: false, msg: "Title reads like a topic label" }, R2 = { id: "R2", ok: false, msg: "Title has 3 words; action titles state a so-what" };
  const R8 = { id: "R8", ok: false, msg: "Figures have no source" }, R11 = { id: "R11", ok: false, msg: "Headline figure 12 is not on the slide" };
  assert.equal(nudge([R8, R2, J1, R11]), "Worth a look: title reads like a topic label, and figures have no source.");
  assert.equal(nudge([{ id: "J", ok: false, msg: "judgment checks failed: down" }, { ...R8, ok: true }]), "");
});

test("withNudge: before the closing question, else at the end", () => {
  assert.equal(withNudge("Added it. Want a takeaway?", "Worth a look: x."), "Added it. Worth a look: x. Want a takeaway?");
  assert.equal(withNudge("Added it.", "Worth a look: x."), "Added it. Worth a look: x.");
  assert.equal(withNudge("Added it.", ""), "Added it.");
});

test("R8: in consulting, any figure claim says where it comes from, in a source or a footnote", () => {
  const steps = (extra: Partial<Slide>): Slide => ({ template: "steps", title: "The book reaches £10m in 18 months and a warehouse line by month 12", steps: [{ when: "0–6 mo", title: "Build", text: "Cards live." }, { when: "6–18 mo", title: "Prove", text: "Book to £10m." }], ...extra });
  assert.equal(get(steps({}), "R8")?.ok, false);
  assert.match(get(steps({}), "R8")?.msg ?? "", /no source or footnote/);
  assert.equal(get(steps({ footnote: "Base case." }), "R8")?.ok, true);
  assert.equal(get(steps({ source: "Acme model." }), "R8")?.ok, true);
  // No figure, no claim to source; step times are not figures.
  assert.equal(get({ ...steps({}), title: "The plan builds, proves, then scales the book", steps: [{ when: "0–6 mo", title: "Build", text: "Cards live." }, { when: "Year 2", title: "Scale", text: "Direct mail." }] }, "R8"), undefined);
  assert.equal(get(steps({}), "R8", "pitch"), undefined);
});

test("R8 reaches the slides without a title and the two-chart slide; a quote names its speaker", () => {
  const num: Slide = { template: "number", number: { value: "£1.4bn", caption: "of SME spend goes on personal cards." } } as Slide;
  assert.equal(get(num, "R8")?.ok, false);
  assert.equal(get({ ...num, source: "BoE survey." }, "R8")?.ok, true);
  assert.equal(get({ template: "quote", quote: "We spent £40k a month.", who: "Founder" } as Slide, "R8"), undefined);
  const pair: Slide = { template: "pair", title: "The market grows a third while Acme takes a share of it", halves: [
    { caption: "Market · £bn", chart: { categories: ["a", "b"], series: [{ name: "M", mark: "bar", values: [1, 2] }] } },
    { caption: "Share · %", chart: { categories: ["a", "b"], series: [{ name: "S", mark: "bar", values: [1, 2] }] } }] };
  assert.equal(get(pair, "R8")?.ok, false);
});

// J9: a stub Jev that records the questions and answers J9 with the given probabilities.
const judge = async (s: Slide, style: Style, j9?: Record<string, number>) => {
  let asked: Record<string, JevQuestion> = {};
  const jev: JevFn = async (_state, qs) => { asked = qs; const r: JevResult = { _ms: 0 } as JevResult; if (j9) r.J9 = { choice: "", p: 0, probabilities: j9 }; return r; };
  const { checks } = await judgmentChecks(s, style, jev);
  return { asked, j9: checks.find((c) => c.id === "J9") };
};
const marks: Slide = { template: "table", title: "Acme is the only provider with [[fast approval]] and high limits", table: { columns: [{ label: "Provider" }, { label: "Fast" }], rows: [{ cells: ["Acme", "Yes"], focus: true }, { cells: ["Bank", "No"] }] } };

test("J9: asked for tables only, with keep and marks", async () => {
  assert.deepEqual(Object.keys((await judge(marks, "consulting")).asked.J9.options), ["keep", "marks"]);
  assert.ok((await judge(marks, "pitch")).asked.J9);
  const cards: Slide = { template: "cards", title: "Three reasons Acme [[wins]] on speed", cards: [{ title: "Fast", text: "Minutes." }, { title: "Big", text: "£250k." }] };
  assert.equal((await judge(cards, "consulting")).asked.J9, undefined);
});

test("J9: fails at p ≥ 0.7 toward marks", async () => {
  const { j9 } = await judge(marks, "consulting", { keep: 0.15, marks: 0.85 });
  assert.equal(j9?.ok, false);
  assert.match(j9?.msg ?? "", /read faster as marks/);
  assert.equal((await judge(marks, "consulting", { keep: 0.4, marks: 0.6 })).j9?.ok, true);
});

test("nudge picks a failed J9 like any judgment check", () => {
  assert.equal(nudge([{ id: "J9", ok: false, msg: "Judgements in words may read faster as marks (✓ ✗ or Harvey balls)" }]), "Worth a look: judgements in words may read faster as marks (✓ ✗ or Harvey balls).");
});
