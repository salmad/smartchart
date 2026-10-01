import { test } from "vitest";
import assert from "node:assert/strict";
import { autofix } from "../../src/engine/agent/autofix";
import type { Slide } from "../../src/engine/types";
import { must } from "./must";

const chartOf = (s: Slide) => must(s.chart, "chart");
const seriesOf = (s: Slide) => must(s.chart?.series, "chart.series");
const notesOf = (s: Slide) => must(s.notes, "notes");
const cardsOf = (s: Slide) => must(s.cards, "cards");
const rowsOf = (s: Slide) => must(s.table?.rows, "table.rows");
const columnsOf = (s: Slide) => must(s.table?.columns, "table.columns");

const chart = (c: object, extra: object = {}) => ({ template: "chart", title: "Revenue grew four times", chart: { categories: ["a", "b", "c"], format: "£{v}m", ...c }, ...extra });

test("trivia: Source prefix, consulting full stop, percent", () => {
  const { slide, fixes } = autofix({ template: "table", title: "Costs fell 20 percent.", source: "Source: ONS", table: { columns: [{ label: "A" }, { label: "B" }], rows: [{ cells: ["a", "1"] }] } }, "consulting");
  assert.equal(slide.title, "Costs fell 20%");
  assert.equal(slide.source, "ONS");
  assert.equal(fixes.length, 2);
});

test("bar series lose area and dashed", () => {
  const { slide, fixes } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", dashed: true, values: [1, 2, 3] }] }), "consulting");
  assert.equal(seriesOf(slide)[0].dashed, undefined);
  assert.ok(fixes[0].startsWith("chart.series[0]"));
});

test("stacking switches off without two bar series in one unit", () => {
  const { slide } = autofix(chart({ stacking: "stacked", series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", format: "{v}%", values: [1, 2, 3] }] }), "consulting");
  assert.equal(chartOf(slide).stacking, "none");
});

test("stacked auto is left for Jev", () => {
  const { slide } = autofix(chart({ stacking: "auto", series: [{ name: "A", mark: "auto", values: [1, 2, 3] }] }), "consulting");
  assert.equal(chartOf(slide).stacking, "auto");
});

test("note points are removed while note numbers on the chart are off", () => {
  const notes = { notes: [{ title: "x", point: { series: 0, index: 0 } }, { title: "y" }] };
  const { slide, fixes } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "bar", values: [1, 2, 3] }] }, structuredClone(notes)), "consulting");
  assert.equal(notesOf(slide)[0].point, undefined);
  assert.equal(fixes.filter((f) => f.startsWith("notes[0].point")).length, 1);
});

test("a second focus series goes back to neutral; missing colours default to neutral", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "C", mark: "bar", values: [1, 2, 3] }] }), "consulting");
  assert.deepEqual(seriesOf(slide).map((s) => s.color), ["focus", "neutral", "neutral"]);
});

test("focus auto leaves colours alone", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", values: [1, 2, 3] }] }, { focus: "auto" }), "consulting");
  assert.equal(seriesOf(slide)[0].color, undefined);
});

test("a Total row, or a row of column sums, becomes the total row", () => {
  const t = (rows: object[]) => ({ template: "table", title: "t", table: { columns: [{ label: "Item" }, { label: "£" }], rows } });
  assert.equal(rowsOf(autofix(t([{ cells: ["A", "10"] }, { cells: ["Total", "10"] }]), "consulting").slide)[1].style, "total");
  assert.equal(rowsOf(autofix(t([{ cells: ["A", "£1,000"] }, { cells: ["B", "(200)"] }, { cells: ["Net", "£800"] }]), "consulting").slide)[2].style, "total");
  assert.equal(rowsOf(autofix(t([{ cells: ["A", "10"] }, { cells: ["B", "7"] }]), "consulting").slide)[1].style, undefined);
});

test("legacy num flags are removed", () => {
  const { slide } = autofix({ template: "table", title: "t", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [{ cells: ["x", "1"] }] } }, "consulting");
  assert.equal("num" in columnsOf(slide)[1], false);
});

test("idempotent", () => {
  const once = autofix(chart({ stacking: "stacked", series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }] }), "consulting").slide;
  const twice = autofix(once, "consulting");
  assert.deepEqual(twice.slide, once);
  assert.deepEqual(twice.fixes, []);
});

test("focus written inside the chart moves to the slide", () => {
  const { slide, fixes } = autofix({ template: "chart", title: "T", focus: undefined, chart: { focus: "auto", categories: ["a"], series: [{ name: "x", mark: "bar", values: [1] }] } }, "consulting");
  assert.equal(slide.focus, "auto");
  assert.ok(!("focus" in chartOf(slide)));
  assert.ok(fixes.some((f) => f.startsWith("focus: moved")));
});

test("cards with no lead get auto icons", () => {
  const { slide } = autofix({ template: "cards", title: "T", cards: [{ title: "A", text: "a" }, { title: "B", text: "b" }] }, "consulting");
  assert.deepEqual(cardsOf(slide).map((c) => c.icon), ["auto", "auto"]);
});

test("cards: unknown icon goes to auto, stray label goes, pitch bullets become text", () => {
  const { slide } = autofix({ template: "cards", title: "T", cards: [{ icon: "seedling", label: "x", title: "A", bullets: ["One", "Two"] }] }, "pitch");
  assert.deepEqual(cardsOf(slide)[0], { icon: "auto", title: "A", text: "One. Two" });
});

test("a chart with items or rows but no kind gets its kind", () => {
  const wf = autofix({ template: "chart", title: "ARR grows", chart: { format: "£{v}m", items: [{ label: "a", value: 1 }, { label: "b", value: 2 }, { label: "c", total: true }] } }, "consulting");
  assert.equal(chartOf(wf.slide).kind, "waterfall");
  assert.ok(wf.fixes.some((f) => f.startsWith("chart.kind")));
  const tl = autofix({ template: "chart", title: "Plan", chart: { periods: ["Q1", "Q2", "Q3"], rows: [{ label: "a", start: 0, end: 1 }, { label: "b", start: 1, end: 2 }] } }, "consulting");
  assert.equal(chartOf(tl.slide).kind, "timeline");
  assert.equal(chartOf(autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }] }), "consulting").slide).kind, undefined);
  assert.equal(chartOf(autofix({ template: "chart", title: "Why", chart: { ranking: [{ label: "a", value: 2 }, { label: "b", value: 1 }] } }, "consulting").slide).kind, "ranked");
  assert.equal(chartOf(autofix({ template: "chart", title: "Map", chart: { axes: { x: "a", y: "b" }, points: [{ label: "a", x: 1, y: 2 }, { label: "b", x: 3, y: 4 }] } }, "consulting").slide).kind, "matrix");
});

test("chart fields at the top level move into chart", () => {
  const { slide, fixes } = autofix({ template: "chart", title: "Book grows", categories: ["a", "b"], annotations: [{ type: "cagr", from: 0, to: 1 }],
    chart: { format: "£{v}m", series: [{ name: "Book", mark: "bar", color: "focus", values: [1, 2] }] } }, "consulting");
  assert.deepEqual(chartOf(slide).categories, ["a", "b"]);
  assert.equal(must(chartOf(slide).annotations, "annotations").length, 1);
  assert.equal("categories" in slide, false);
  assert.equal(fixes.filter((f) => f.endsWith("moved into chart")).length, 2);
});

test("a flat line in the bar unit becomes a target; idempotent", () => {
  const s = chart({ series: [{ name: "Book", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "Plan (£100m)", mark: "line", color: "neutral", dashed: true, values: [100, 100, 100] }] });
  const once = autofix(s, "consulting");
  assert.equal(seriesOf(once.slide).length, 1);
  assert.deepEqual(chartOf(once.slide).annotations, [{ type: "target", value: 100, label: "Plan" }]);
  assert.deepEqual(autofix(once.slide, "consulting").slide, once.slide);
  const gaps = autofix(chart({ series: [{ name: "Book", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "Plan", mark: "line", values: [null, null, 100] }] }), "consulting");
  assert.deepEqual(chartOf(gaps.slide).annotations, [{ type: "target", value: 100, label: "Plan" }]);
  // A flat line in another unit, or a sloped one, stays a series.
  const pct = chart({ series: [{ name: "Book", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "M", mark: "line", format: "{v}%", values: [5, 5, 5] }] });
  assert.equal(seriesOf(autofix(pct, "consulting").slide).length, 2);
});

test("with auto marks, a plan written only at its year still becomes a target", () => {
  const s = chart({ series: [{ name: "Book", mark: "auto", color: "focus", values: [1, 2, 3] }, { name: "Plan", mark: "auto", values: [null, null, 100] }] });
  const { slide } = autofix(s, "consulting");
  assert.equal(seriesOf(slide).length, 1);
  assert.deepEqual(chartOf(slide).annotations, [{ type: "target", value: 100, label: "Plan" }]);
});
