import { test } from "node:test";
import assert from "node:assert/strict";
import { CHART_GUIDE, describe, upgrade, validate } from "../v5/schema.js";
import { EXAMPLES, stressFor } from "../v5/examples.js";

const chart = (c, extra = {}) => ({ template: "chart", title: "Revenue grew four times while the margin tripled", chart: c, ...extra });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 9.4] };
const MARGIN = { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31] };
const cats = ["2023", "2024", "2025"];
const errs = (s, style = "consulting") => validate(s, style).errors;

test("bars with a line in another unit are valid", () => {
  assert.deepEqual(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN] })), []);
});

test("chart.type and series.line no longer exist", () => {
  const e = errs(chart({ type: "bars", categories: cats, series: [{ ...REV, line: false }] }));
  assert.ok(e.some((x) => x.startsWith("chart.type: not a field")));
  assert.ok(e.some((x) => x.startsWith("chart.series[0].line: not a field")));
});

test("mark is required and takes bar, line or auto", () => {
  const { mark, ...noMark } = REV;
  assert.ok(errs(chart({ categories: cats, series: [noMark] })).some((x) => x.startsWith("chart.series[0].mark: required")));
  assert.ok(errs(chart({ categories: cats, series: [{ ...REV, mark: "pie" }] })).some((x) => x.includes("Use one of: bar, line, auto")));
  assert.deepEqual(errs(chart({ categories: cats, stacked: "auto", series: [{ ...REV, mark: "auto" }] }, { focus: "auto" })), []);
});

test("a third unit is an error", () => {
  const third = { name: "Customers", mark: "line", format: "{v}k", values: [1, 2, 3] };
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN, third] })).some((x) => x.includes("3 units")));
});

test("stacking needs two bar series in one unit", () => {
  assert.ok(errs(chart({ categories: cats, stacked: true, series: [REV, MARGIN] })).some((x) => x.startsWith("chart.stacked:")));
  const b2 = { ...REV, name: "Services", color: "neutral" };
  assert.deepEqual(errs(chart({ categories: cats, stacked: true, format: "£{v}m", series: [REV, b2] })), []);
});

test("area and dashed are line-only", () => {
  assert.ok(errs(chart({ categories: cats, series: [{ ...REV, dashed: true }] })).some((x) => x.includes("only for line series")));
});

test("note points need a chart with bars", () => {
  const notes = { notes: [{ title: "Margin triples", point: { series: 1, index: 2 } }, { title: "Revenue grows" }] };
  assert.deepEqual(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN] }, notes)), [], "a line over bars can be pinned");
  const lines = [{ ...REV, mark: "line" }, { ...REV, name: "Cost", mark: "line", color: "neutral" }];
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: lines }, notes)).some((x) => x.startsWith("notes[0].point:")));
});

test("table columns have no num flag", () => {
  const s = { template: "table", title: "Growth leads on margin across every plan we sell", table: { columns: [{ label: "Plan" }, { label: "Price", num: true }], rows: [{ cells: ["Growth", "£49"] }] } };
  assert.ok(errs(s).some((x) => x.startsWith("table.columns[1].num: not a field")));
});

test("icon and focus accept auto", () => {
  const s = { template: "cards", title: "Three levers move the margin by a third this year", focus: "auto",
    cards: [0, 1, 2].map((i) => ({ icon: "auto", title: `Lever ${i}`, text: "One short line." })) };
  assert.deepEqual(errs(s), []);
});

test("upgrade converts old charts and tables", () => {
  const old = { template: "chart", title: "t", chart: { type: "bars", categories: cats, series: [{ name: "A", color: "focus", values: [1, 2, 3] }, { name: "B", color: "contrast", line: true, format: "{v}%", values: [1, 2, 3] }] } };
  const u = upgrade(old);
  assert.equal(u.chart.type, undefined);
  assert.deepEqual(u.chart.series.map((s) => s.mark), ["bar", "line"]);
  assert.equal(u.chart.series[1].line, undefined);
  assert.equal(old.chart.type, "bars", "upgrade must not mutate its input");
  const lines = upgrade({ template: "chart", chart: { type: "lines", categories: cats, series: [{ name: "A", values: [1, 2, 3] }] } });
  assert.equal(lines.chart.series[0].mark, "line");
  const t = upgrade({ template: "table", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [] } });
  assert.equal(t.table.columns[1].num, undefined);
});

test("the chart card carries the chart guide", () => {
  assert.equal(CHART_GUIDE.length, 7);
  const rules = describe("chart", "consulting").rules.join("\n");
  CHART_GUIDE.forEach((g) => assert.ok(rules.includes(g)));
});

const specFor = ({ consulting, pitch, name, ...shared }, style) => ({ ...shared, ...(style === "pitch" ? pitch : consulting) });
for (const style of ["consulting", "pitch"]) {
  test(`examples validate (${style})`, () => {
    for (const ex of EXAMPLES) assert.deepEqual(errs(specFor(ex, style), style), [], ex.name);
  });
  test(`stress deck validates (${style})`, () => {
    for (const { name, ...s } of stressFor(style)) assert.deepEqual(errs(s, style), [], name);
  });
}
