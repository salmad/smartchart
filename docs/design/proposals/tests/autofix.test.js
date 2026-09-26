import { test } from "node:test";
import assert from "node:assert/strict";
import { autofix } from "../journey/autofix.js";

const chart = (c, extra = {}) => ({ template: "chart", title: "Revenue grew four times", chart: { categories: ["a", "b", "c"], format: "£{v}m", ...c }, ...extra });

test("trivia: Source prefix, consulting full stop, percent", () => {
  const { slide, fixes } = autofix({ template: "number", title: "Costs fell 20 percent.", source: "Source: ONS", number: { value: "20%", caption: "x" }, body: ["y"] }, "consulting");
  assert.equal(slide.title, "Costs fell 20%");
  assert.equal(slide.source, "ONS");
  assert.equal(fixes.length, 2);
});

test("bar series lose area and dashed", () => {
  const { slide, fixes } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", dashed: true, values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.series[0].dashed, undefined);
  assert.ok(fixes[0].startsWith("chart.series[0]"));
});

test("stacking switches off without two bar series in one unit", () => {
  const { slide } = autofix(chart({ stacked: true, series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", format: "{v}%", values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.stacked, false);
});

test("stacked auto is left for Jev", () => {
  const { slide } = autofix(chart({ stacked: "auto", series: [{ name: "A", mark: "auto", values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.stacked, "auto");
});

test("note points go when every series is a line, or when they point past the data", () => {
  const notes = { notes: [{ title: "x", point: { series: 1, index: 0 } }, { title: "y", point: { series: 0, index: 5 } }] };
  const mixed = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", format: "{v}%", values: [1, 2, 3] }] }, structuredClone(notes)), "consulting");
  assert.deepEqual(mixed.slide.notes[0].point, { series: 1, index: 0 }, "a line over bars keeps its point");
  assert.equal(mixed.slide.notes[1].point, undefined);
  const lines = autofix(chart({ series: [{ name: "A", mark: "line", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", values: [1, 2, 3] }] }, structuredClone(notes)), "consulting");
  assert.equal(lines.slide.notes[0].point, undefined);
  assert.equal(lines.fixes.filter((f) => f.startsWith("notes[")).length, 2);
});

test("a second focus series goes back to neutral; missing colours default to neutral", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "C", mark: "bar", values: [1, 2, 3] }] }), "consulting");
  assert.deepEqual(slide.chart.series.map((s) => s.color), ["focus", "neutral", "neutral"]);
});

test("focus auto leaves colours alone", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", values: [1, 2, 3] }] }, { focus: "auto" }), "consulting");
  assert.equal(slide.chart.series[0].color, undefined);
});

test("a Total row, or a row of column sums, becomes the total row", () => {
  const t = (rows) => ({ template: "table", title: "t", table: { columns: [{ label: "Item" }, { label: "£" }], rows } });
  assert.equal(autofix(t([{ cells: ["A", "10"] }, { cells: ["Total", "10"] }]), "consulting").slide.table.rows[1].style, "total");
  assert.equal(autofix(t([{ cells: ["A", "£1,000"] }, { cells: ["B", "(200)"] }, { cells: ["Net", "£800"] }]), "consulting").slide.table.rows[2].style, "total");
  assert.equal(autofix(t([{ cells: ["A", "10"] }, { cells: ["B", "7"] }]), "consulting").slide.table.rows[1].style, undefined);
});

test("legacy num flags are removed", () => {
  const { slide } = autofix({ template: "table", title: "t", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [{ cells: ["x", "1"] }] } }, "consulting");
  assert.equal(slide.table.columns[1].num, undefined);
});

test("idempotent", () => {
  const once = autofix(chart({ stacked: true, series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }] }), "consulting").slide;
  const twice = autofix(once, "consulting");
  assert.deepEqual(twice.slide, once);
  assert.deepEqual(twice.fixes, []);
});
