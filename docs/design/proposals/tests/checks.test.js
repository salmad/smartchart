import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersIn, ruleChecks } from "../journey/checks.js";

const get = (s, id, style = "consulting") => ruleChecks(s, style, 1).find((c) => c.id === id);
const chart = (series, extra = {}) => ({ template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m by 2025", source: "Accounts", chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series, ...extra } });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] };

test("numbersIn ignores years", () => assert.deepEqual(numbersIn("£2.1m in 2022 to £9,400k, 4.5×"), [2.1, 9400, 4.5]));

test("R9: comparable series mixing marks, three units, bad stacking", () => {
  assert.equal(get(chart([REV, { ...REV, name: "Cost", color: "neutral", mark: "line" }]), "R9").ok, false);
  assert.equal(get(chart([REV, { ...REV, name: "Target", color: "neutral", mark: "line", dashed: true }]), "R9").ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "line", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9").ok, true);
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
});

test("R14: time runs oldest first; single-series bars sorted by value", () => {
  const s = chart([REV]); s.chart.categories = ["2025", "2024", "2023", "2022"];
  assert.equal(get(s, "R14").ok, false);
  const bars = chart([{ ...REV, values: [3, 9, 5, 1] }]); bars.chart.categories = ["North", "South", "East", "West"];
  assert.equal(get(bars, "R14").ok, false);
  bars.chart.series[0].values = [9, 5, 3, 1];
  assert.equal(get(bars, "R14").ok, true);
});
