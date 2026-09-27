import { test } from "vitest";
import assert from "node:assert/strict";
import { annotationLabel, axisBreak, cagr, derivedFigures, fmt, shares, signed, waterfall } from "../../src/engine/slides/charts/chart-math";
import type { Annotation, Chart, Series } from "../../src/engine/types";

const label = (c: Chart, a: Annotation) => annotationLabel(c, a)?.text;

const years = ["2021", "2022", "2023", "2024", "2025"];
const REVENUE: Series = { name: "Revenue", mark: "bar", color: "focus", values: [10, 12, 15, 18, 20] };
const rev: Chart = { categories: years, format: "£{v}m", series: [REVENUE] };

test("formats: whole, one decimal, signed with a true minus", () => {
  assert.equal(fmt("£{v}m", 2), "£2m");
  assert.equal(fmt("£{v}m", 2.14), "£2.1m");
  assert.equal(fmt("£{v}m", -5), "−£5m");
  assert.equal(signed("£{v}m", 2.1), "+£2.1m");
  assert.equal(signed("£{v}m", -1.24), "−£1.2m");
});

test("CAGR over the periods between two categories", () => {
  assert.ok(Math.abs(cagr(10, 20, 4) - 0.18921) < 1e-4);
  assert.deepEqual(annotationLabel(rev, { type: "cagr", from: 0, to: 4 }), { value: 18.9, figure: "+19%", caption: "CAGR", text: "+19% CAGR", sign: 1 });
  assert.equal(label(rev, { type: "cagr", from: 0, to: 1 }), "+20% CAGR");
  assert.equal(label({ ...rev, series: [{ ...REVENUE, values: [100, 104, 1, 1, 1] }] }, { type: "cagr", from: 0, to: 1 }), "+4% CAGR");
  assert.equal(label({ ...rev, series: [{ ...REVENUE, values: [100, 104.5, 1, 1, 1] }] }, { type: "cagr", from: 0, to: 1 }), "+4.5% CAGR");
});

test("difference: absolute in the series format, pp for %, % change when relative", () => {
  assert.equal(label(rev, { type: "difference", from: 1, to: 4 }), "+£8m");
  assert.equal(label(rev, { type: "difference", from: 4, to: 0 }), "−£10m");
  const margin: Chart = { categories: ["a", "b"], format: "{v}%", series: [{ name: "M", mark: "bar", values: [12, 20] }] };
  assert.equal(label(margin, { type: "difference", from: 0, to: 1 }), "+8 pp");
  assert.equal(label(rev, { type: "difference", from: 0, to: 4, relative: true }), "+100%");
});

test("annotations read the stack totals when stacked and no series is named", () => {
  const c: Chart = { categories: ["a", "b"], format: "£{v}m", stacked: true, series: [{ name: "x", mark: "bar", values: [1, 2] }, { name: "y", mark: "bar", color: "focus", values: [1, 4] }] };
  assert.equal(label(c, { type: "difference", from: 0, to: 1 }), "+£4m");
  assert.equal(label(c, { type: "difference", from: 0, to: 1, series: 1 }), "+£3m");
});

test("target label", () => {
  assert.equal(label(rev, { type: "target", value: 25 }), "Target £25m");
  assert.equal(label(rev, { type: "target", value: 25, label: "Plan" }), "Plan £25m");
});

test("waterfall: running sums, computed totals, up and down", () => {
  const { steps, errors } = waterfall([{ label: "FY24", value: 100 }, { label: "Price", value: 12 }, { label: "Volume", value: -5 }, { label: "FY25", total: true }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(steps.map((s) => [s.kind, s.from, s.to]), [["total", 0, 100], ["up", 100, 112], ["down", 112, 107], ["total", 0, 107]]);
});

test("waterfall: a written total is checked within rounding", () => {
  assert.deepEqual(waterfall([{ label: "a", value: 10 }, { label: "b", value: 1.24 }, { label: "c", total: true, value: 11.2 }]).errors, []);
  const bad = waterfall([{ label: "a", value: 100 }, { label: "b", value: 21 }, { label: "c", total: true, value: 118 }]).errors;
  assert.equal(bad.length, 1);
  assert.match(bad[0], /chart\.items\[2\]\.value: 118, but the steps before it sum to 121/);
  assert.match(waterfall([{ label: "a" }, { label: "b", value: 1 }]).errors[0], /starting total/);
});

test("100% shares", () => {
  const c: Chart = { categories: ["a", "b"], series: [{ name: "x", mark: "bar", values: [1, 3] }, { name: "y", mark: "bar", values: [3, 1] }] };
  assert.deepEqual(shares(c), [[25, 75], [75, 25]]);
});

test("axis break only for one outlier bar with nothing above the cap", () => {
  const c = (v: number[], extra: Partial<Chart> = {}): Chart => ({ categories: v.map(String), format: "{v}", series: [{ name: "x", mark: "bar", values: v }], ...extra });
  assert.deepEqual(axisBreak(c([10, 12, 90])), { cap: 18, series: 0, index: 2 });
  assert.equal(axisBreak(c([10, 12, 25])), null);
  assert.equal(axisBreak(c([10, 12, 90], { stacked: true })), null);
  assert.equal(axisBreak(c([10, 12, 90], { annotations: [{ type: "target", value: 50 }] })), null);
  // Two bars are the comparison itself: cutting one would hide the ratio the slide is about.
  assert.equal(axisBreak(c([2.1, 5.4])), null);
  assert.equal(axisBreak({ categories: ["2023"], format: "{v}", series: [{ name: "a", mark: "bar", values: [2] }, { name: "b", mark: "bar", values: [9] }] }), null);
});

test("derived figures feed R11", () => {
  assert.deepEqual(derivedFigures({ ...rev, annotations: [{ type: "cagr", from: 0, to: 4 }] }), [18.9]);
  assert.deepEqual(derivedFigures({ kind: "waterfall", items: [{ label: "a", value: 100 }, { label: "b", value: -7 }, { label: "c", total: true }] }), [100, 7, 93]);
});
