import { test } from "vitest";
import assert from "node:assert/strict";
import { numbersIn, ruleChecks } from "../../src/engine/agent/checks.js";

const get = (s, id, style = "consulting") => ruleChecks(s, style, 1).find((c) => c.id === id);
const chart = (series, extra = {}) => ({ template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m by 2025", source: "Accounts", chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series, ...extra } });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] };

test("numbersIn ignores years", () => assert.deepEqual(numbersIn("£2.1m in 2022 to £9,400k, 4.5×"), [2.1, 9400, 4.5]));
test("numbersIn: a year before a comma is still a year", () => assert.deepEqual(numbersIn("£120m by 2030, £20m ahead"), [120, 20]));

test("R9: comparable series mixing marks, three units, bad stacking", () => {
  assert.equal(get(chart([REV, { ...REV, name: "Cost", color: "neutral", mark: "line" }]), "R9").ok, false);
  assert.equal(get(chart([REV, { ...REV, name: "Target", color: "neutral", mark: "line", dashed: true }]), "R9").ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "line", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9").ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "bar", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9").ok, false, "bars in two units");
});

test("R10: four cards warn in consulting; framed and pitch exempt", () => {
  const cards = (n, extra = {}) => ({ template: "cards", title: "Four levers move the margin by a third", cards: Array.from({ length: n }, (_, i) => ({ icon: "zap", title: `L${i}`, text: "x" })), ...extra });
  assert.equal(get(cards(4), "R10").ok, false);
  assert.equal(get(cards(3), "R10").ok, true);
  assert.equal(get(cards(4), "R10", "pitch"), undefined);
});

test("R11: title figures on the slide or derived", () => {
  assert.equal(get(chart([REV]), "R11").ok, true); // 2.1 and 9.4 in the data; 4.5 ≈ 9.4 / 2.1
  const s = chart([REV]); s.title = "Revenue reached £12m by 2025";
  assert.equal(get(s, "R11").ok, false);
});

test("R12: consulting title with figures on the slide carries a figure", () => {
  const s = chart([REV]); s.title = "Revenue grew strongly as churn fell";
  assert.equal(get(s, "R12").ok, false);
});

test("R13: one unit and precision per column; no false precision", () => {
  const t = (cells) => ({ template: "table", title: "Plan A leads with 61% margin", source: "x", table: { columns: [{ label: "Plan" }, { label: "Margin" }], rows: cells.map((c, i) => ({ cells: [`P${i}`, c] })) } });
  assert.equal(get(t(["42%", "61%"]), "R13").ok, true);
  assert.equal(get(t(["42%", "61.5%"]), "R13").ok, false);
  assert.equal(get(t(["42%", "£61"]), "R13").ok, false);
  assert.equal(get(t(["9,837,221", "61"]), "R13").ok, false);
  const byRow = { template: "table", title: "Revenue grew 4× as churn fell to 3%", source: "x", table: { columns: [{ label: "Metric" }, { label: "2022" }, { label: "2025" }],
    rows: [{ cells: ["Revenue", "£2.1m", "£9.4m"] }, { cells: ["Churn", "8%", "3%"] }] } };
  assert.equal(get(byRow, "R13").ok, true, "rows are the metrics: units hold per row");
});

test("R14: time runs oldest first; single-series bars sorted by value", () => {
  const s = chart([REV]); s.chart.categories = ["2025", "2024", "2023", "2022"];
  assert.equal(get(s, "R14").ok, false);
  const bars = chart([{ ...REV, values: [3, 9, 5, 1] }]); bars.chart.categories = ["North", "South", "East", "West"];
  assert.equal(get(bars, "R14").ok, false);
  bars.chart.series[0].values = [9, 5, 3, 1];
  assert.equal(get(bars, "R14").ok, true);
});

test("R11 accepts figures code computed: a CAGR, a waterfall total, a 100% share", () => {
  const cagr = { ...chart([{ ...REV, values: [10, 12, 15, 20] }], { annotations: [{ type: "cagr", from: 0, to: 3 }] }), title: "Revenue grows [[26% a year]] to £20m" };
  assert.equal(get(cagr, "R11").ok, true);
  assert.equal(get({ ...cagr, title: "Revenue grows [[31% a year]] to £20m" }, "R11").ok, false);
  const wf = { template: "chart", title: "ARR reaches £17.5m; [[new]] adds £6.2m", source: "Model", chart: { kind: "waterfall", format: "£{v}m",
    items: [{ label: "FY25", value: 9.8 }, { label: "New", value: 6.2, focus: true }, { label: "Churn", value: -1.4 }, { label: "Price", value: 2.9 }, { label: "FY26", total: true }] } };
  assert.equal(get(wf, "R11").ok, true);
  const mix = { ...chart([{ ...REV, color: "neutral", values: [7, 12, 20, 30] }, { ...REV, name: "Card", values: [3, 8, 18, 34] }], { stacked: "100" }), title: "[[Card]] rises from 30% to 53%" };
  assert.equal(get(mix, "R11").ok, true);
});

test("focus counts per chart kind; a timeline carries no figure rules", () => {
  const tl = { template: "chart", title: "The [[pilot]] is the critical path for the whole launch", chart: { kind: "timeline", periods: ["Q1", "Q2", "Q3"], rows: [{ label: "Build", start: 0, end: 1 }, { label: "Pilot", start: 1, end: 2, focus: true }] } };
  assert.equal(get(tl, "R4").ok, true);
  for (const id of ["R5", "R8", "R12", "R14"]) assert.equal(get(tl, id), undefined, id);
});
