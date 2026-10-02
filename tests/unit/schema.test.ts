import { test } from "vitest";
import assert from "node:assert/strict";
import { CHART_GUIDE, describe, upgrade, validate } from "../../src/engine/slides/schema";
import { STARTERS } from "../../src/engine/starters";
import { stressFor } from "../fixtures/stress";
import type { Slide, Style } from "../../src/engine/types";

/* Tests feed malformed and legacy slides on purpose; these helpers name that. */
const legacy = (v: object) => v as Slide;
type LegacyView = { chart: { type?: string; series: { mark: string; line?: boolean }[] }; table: { columns: { num?: unknown }[] } };
const legacyView = (s: Slide) => s as unknown as LegacyView;

const chart = (c: object, extra: object = {}) => ({ template: "chart", title: "Revenue grew four times while the margin tripled", chart: c, ...extra });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 9.4] };
const MARGIN = { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31] };
const cats = ["2023", "2024", "2025"];
const errs = (s: unknown, style: Style = "consulting") => validate(s, style).errors;

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
  assert.deepEqual(errs(chart({ categories: cats, stacking: "auto", series: [{ ...REV, mark: "auto" }] }, { focus: "auto" })), []);
});

test("a third unit is an error", () => {
  const third = { name: "Customers", mark: "line", format: "{v}k", values: [1, 2, 3] };
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN, third] })).some((x) => x.includes("3 units")));
});

test("stacking needs two bar series in one unit", () => {
  assert.ok(errs(chart({ categories: cats, stacking: "stacked", series: [REV, MARGIN] })).some((x) => x.startsWith("chart.stacking:")));
  const b2 = { ...REV, name: "Services", color: "neutral" };
  assert.deepEqual(errs(chart({ categories: cats, stacking: "stacked", format: "£{v}m", series: [REV, b2] })), []);
});

test("area and dashed are line-only", () => {
  assert.ok(errs(chart({ categories: cats, series: [{ ...REV, dashed: true }] })).some((x) => x.includes("only for line series")));
});

test("note points are not offered while note numbers on the chart are off", () => {
  const notes = { notes: [{ title: "Margin triples", point: { series: 1, index: 2 } }, { title: "Revenue grows" }] };
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN] }, notes)).some((x) => x.startsWith("notes[0].point: not a field")));
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
  const u = legacyView(upgrade(legacy(old)));
  assert.equal(u.chart.type, undefined);
  assert.deepEqual(u.chart.series.map((s) => s.mark), ["bar", "line"]);
  assert.equal(u.chart.series[1].line, undefined);
  assert.equal(old.chart.type, "bars", "upgrade must not mutate its input");
  const lines = legacyView(upgrade(legacy({ template: "chart", chart: { type: "lines", categories: cats, series: [{ name: "A", values: [1, 2, 3] }] } })));
  assert.equal(lines.chart.series[0].mark, "line");
  const t = legacyView(upgrade(legacy({ template: "table", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [] } })));
  assert.equal(t.table.columns[1].num, undefined);
});

test("the chart card carries the chart guide", () => {
  assert.equal(CHART_GUIDE.length, 8);
  const rules = describe("chart", "consulting").rules.join("\n");
  CHART_GUIDE.forEach((g) => assert.ok(rules.includes(g)));
});

for (const style of ["consulting", "pitch"] as const) {
  test(`starters validate (${style})`, () => {
    for (const st of STARTERS) assert.deepEqual(errs(st[style], style), [], st.id);
  });
  test(`stress deck validates (${style})`, () => {
    for (const { name, ...s } of stressFor(style)) assert.deepEqual(errs(s, style), [], name);
  });
}

/* Chart kinds and annotations (spec 2026-09-27-chart-capabilities-design.md). */
const REV5 = { categories: ["2021", "2022", "2023", "2024", "2025"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [10, 12, 15, 18, 20] }] };

test("annotations: valid cagr, difference and target", () => {
  assert.deepEqual(errs(chart({ ...REV5, annotations: [{ type: "cagr", from: 0, to: 4 }, { type: "difference", from: 3, to: 4, relative: true }, { type: "target", value: 25 }] })), []);
});

test("annotations: indices, order, bar series, target fields, CAGR sign", () => {
  const e = (a: object, c: object = REV5) => errs(chart({ ...c, annotations: [a] })).join("\n");
  assert.match(e({ type: "cagr", from: 0, to: 9 }), /category indices 0–4/);
  assert.match(e({ type: "difference", from: 3, to: 1 }), /must come before/);
  assert.match(e({ type: "target" }), /value: required/);
  assert.match(e({ type: "target", value: 3, from: 0 }), /from: not used by a target/);
  assert.match(e({ type: "cagr", from: 0, to: 1, value: 2 }), /value: only for a target/);
  assert.match(e({ type: "cagr", from: 0, to: 1, series: 1 }, { ...REV5, series: [...REV5.series, { name: "M", mark: "line", values: [1, 2, 3, 4, 5] }] }), /not a bar series/);
  assert.match(e({ type: "cagr", from: 0, to: 1 }, { ...REV5, series: [{ ...REV5.series[0], values: [0, 2, 3, 4, 5] }] }), /positive values/);
  assert.match(errs(chart({ ...REV5, annotations: [1, 2, 3, 4].map(() => ({ type: "target", value: 1 })) })).join(), /at most 3/);
});

test("100% stacked needs 2 bar series and takes no annotations", () => {
  const two = { ...REV5, stacking: "percent", series: [REV5.series[0], { name: "Other", mark: "bar", color: "neutral", values: [1, 2, 3, 4, 5] }] };
  assert.deepEqual(errs(chart(two)), []);
  assert.match(errs(chart({ ...REV5, stacking: "percent" })).join(), /stacking needs 2/);
  assert.match(errs(chart({ ...two, annotations: [{ type: "target", value: 50 }] })).join(), /100% stacked/);
});

test("a gap in the values is an error that points at a target", () => {
  assert.match(errs(chart({ categories: cats, series: [{ ...REV, values: [2.1, null, 9.4] }] })).join(), /series\[0\]\.values\[1\]: missing.*target/);
});

test("series names are unique within a chart", () => {
  assert.match(errs(chart({ categories: cats, series: [REV, { ...REV, color: "neutral" }] })).join(), /two series are named "Revenue"/);
});

test("up to 6 series; a 7th is cut or merged", () => {
  const lines = (n: number) => ({ ...REV5, series: Array.from({ length: n }, (_, i) => ({ name: `S${i}`, mark: "line", color: i ? "neutral" : "focus", values: [1, 2, 3, 4, 5] })) });
  assert.deepEqual(errs(chart(lines(6))), []);
  assert.match(errs(chart(lines(7))).join(), /at most 6 items/);
});

const WF = { kind: "waterfall", format: "£{v}m", items: [{ label: "FY24", value: 100 }, { label: "Price", value: 12, focus: true }, { label: "Volume", value: -5 }, { label: "FY25", total: true }] };

test("waterfall: valid, checked totals, bars fields refused", () => {
  assert.deepEqual(validate(chart(WF), "consulting"), { errors: [], warnings: [] });
  assert.match(errs(chart({ ...WF, items: [...WF.items.slice(0, 3), { label: "FY25", total: true, value: 110 }] })).join(), /110, but the steps before it sum to 107/);
  assert.match(errs(chart({ ...WF, series: REV5.series })).join(), /chart\.series: not used by kind "waterfall"/);
  assert.match(errs(chart({ ...WF, items: WF.items.map((x) => ({ ...x, focus: true })) })).join(), /at most one focus item/);
  assert.match(validate(chart({ ...WF, items: WF.items.slice(0, 3) })).warnings.join(), /ends with a total/);
});

const TL = { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [{ label: "Build", start: 0, end: 1 }, { label: "Pilot", start: 1, end: 3, focus: true }], milestones: [{ label: "Launch", at: 2 }] };

test("timeline: valid, ranges checked", () => {
  assert.deepEqual(errs(chart(TL)), []);
  assert.match(errs(chart({ ...TL, rows: [{ label: "x", start: 2, end: 1 }, TL.rows[0]] })).join(), /is after/);
  assert.match(errs(chart({ ...TL, rows: [{ label: "x", start: 0, end: 9 }, TL.rows[0]] })).join(), /period indices 0–3/);
  assert.match(errs(chart({ ...TL, milestones: [{ label: "x", at: 7 }] })).join(), /milestones\[0\]\.at/);
  assert.match(errs(chart({ ...TL, categories: ["a", "b"] })).join(), /not used by kind "timeline"/);
});

test("notes limits per kind", () => {
  const notes = [{ title: "One" }, { title: "Two" }];
  assert.match(errs(chart({ ...TL, periods: Array.from({ length: 9 }, (_, i) => `M${i}`) }, { notes })).join(), /with notes at most 8/);
  assert.match(errs(chart({ ...TL, rows: Array.from({ length: 7 }, (_, i) => ({ label: `R${i}`, start: 0, end: 1 })) }, { notes })).join(), /with notes at most 6/);
  assert.match(errs(chart({ ...TL, rows: [{ label: "A workstream label that is long", start: 0, end: 1 }, TL.rows[1]] }, { notes })).join(), /with notes at most 20/);
});

test("annotations accept series whose mark is still auto", () => {
  assert.deepEqual(errs(chart({ ...REV5, series: [{ ...REV5.series[0], mark: "auto" }], annotations: [{ type: "target", value: 25 }, { type: "cagr", from: 0, to: 4, series: 0 }] })), []);
});

test("charts and tables take an optional one-line caption and notes heading, in both styles", () => {
  const s = chart({ categories: cats, format: "£{v}m", series: [REV] }, { caption: "Revenue, 2023–2025 · £m", notesTitle: "Notes", notes: [{ title: "a" }, { title: "b" }, { title: "c" }] });
  for (const style of ["consulting", "pitch"] as const) assert.deepEqual(errs(style === "pitch" ? { ...s, subtitle: "It grew." } : s, style).filter((e) => /caption|notesTitle/.test(e)), []);
  assert.ok(errs({ ...s, caption: "x".repeat(49) }).some((e) => e.startsWith("caption")));
  assert.ok(errs({ ...s, notesTitle: "x".repeat(21) }).some((e) => e.startsWith("notesTitle")));
});

test("a notes heading does not go with a takeaway", () => {
  const s = chart({ categories: cats, format: "£{v}m", series: [REV] }, { notesTitle: "Notes", takeaway: "So what.", notes: [{ title: "a" }, { title: "b" }, { title: "c" }] });
  assert.ok(errs(s).some((e) => e.startsWith("notesTitle: a notes heading and a takeaway")));
  assert.ok(!errs({ ...s, takeaway: undefined }).some((e) => e.startsWith("notesTitle")));
});

const GROUPED = { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [
  { label: "Platform" }, { label: "API", level: 1, start: 0, end: 1 }, { label: "UI", level: 1, start: 1, end: 3 },
  { label: "Launch", start: 3, end: 3, focus: true }], milestones: [{ label: "Beta", at: 1 }] };

test("timeline groups: valid shapes pass, bad ones are named", () => {
  assert.deepEqual(errs(chart(GROUPED)), []);
  assert.match(errs(chart({ ...GROUPED, rows: [{ ...GROUPED.rows[0], start: 0, end: 1 }, ...GROUPED.rows.slice(1)] })).join(), /rows\[0\].*group.*start/);
  assert.match(errs(chart({ ...GROUPED, rows: [{ label: "x", level: 1, start: 0, end: 1 }, GROUPED.rows[3]] })).join(), /rows\[0\].*sub-row/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[3], { label: "x", level: 2, start: 0, end: 1 }] })).join(), /rows\[1\]\.level/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[3], { ...GROUPED.rows[3] }] })).join(), /at most one focus/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[0], { label: "c", level: 1 }] })).join(), /rows\[1\].*start.*end/);
});

test("timeline limits count lines, not only workstreams", () => {
  const many = (n: number, extra: object = {}) => Array.from({ length: n }, (_, i) => ({ label: `R${i}`, start: 0, end: 1, ...extra }));
  assert.match(errs(chart({ ...TL, rows: many(9) })).join(), /at most 8 workstreams/);
  const twelve = [{ label: "G" }, ...many(8, { level: 1 }), ...many(3)];
  assert.deepEqual(errs(chart({ ...TL, rows: twelve })), []);
  assert.match(errs(chart({ ...TL, rows: [...twelve, { label: "x", level: 1, start: 0, end: 1 }] })).join(), /rows/);
  assert.match(errs(chart({ ...TL, milestones: Array.from({ length: 7 }, (_, i) => ({ label: `M${i}`, at: 0 })) })).join(), /milestones/);
});

const barsSlide = (extra: Record<string, unknown>) => legacy({ template: "chart", title: "Revenue grew in every segment over three years", chart: {
  kind: "bars", categories: ["2023", "2024", "2025"], series: [{ name: "A", values: [1, 2, 3], mark: "bar" }, { name: "B", values: [2, 3, 4], mark: "bar" }], ...extra } });

test("chart.stacking: old stacked values upgrade", () => {
  const st = (v: unknown) => (upgrade(barsSlide({ stacked: v })).chart as { stacking?: string }).stacking;
  assert.equal(st(false), "none");
  assert.equal(st(true), "stacked");
  assert.equal(st("100"), "percent");
  assert.equal(st("auto"), "auto");
  assert.ok(!("stacked" in (upgrade(barsSlide({ stacked: true })).chart as object)));
});

test("chart.stacking: validates and refuses the old field", () => {
  assert.deepEqual(validate(barsSlide({ stacking: "percent" }), "consulting").errors, []);
  assert.match(validate(barsSlide({ stacked: true }), "consulting").errors.join(" "), /stacked/);
});

test("chart.stacking: the card offers the four strings", () => {
  const card = JSON.stringify(describe("chart", "consulting"));
  assert.match(card, /"none","stacked","percent","auto"/);
});

/* Ranked bars and the matrix: the limits the agent reads on the card are the ones validation enforces. */
const RANK = (n: number, extra: object = {}) => ({ kind: "ranked", format: "{v}%", ranking: Array.from({ length: n }, (_, i) => ({ label: `Reason ${i + 1}`, value: 50 - i * 5, focus: i === 0 })), ...extra });
const MX = (n: number) => ({ kind: "matrix", axes: { x: "Rewards", y: "Credit limit" }, quadrants: ["Lenders", "The gap", "Basic", "Rewards"],
  points: Array.from({ length: n }, (_, i) => ({ label: `Card ${i + 1}`, x: 10 + i * 10, y: 80 - i * 9, focus: i === 0 })) });
const THREE = [{ title: "One" }, { title: "Two" }, { title: "Three" }];

test("ranked: 2–8 items of 0 or more, largest first, one focus; bars fields refused", () => {
  assert.deepEqual(errs(chart(RANK(8))), []);
  assert.match(errs(chart(RANK(9))).join(), /chart\.ranking: at most 8 items/);
  assert.match(errs(chart(RANK(3, { ranking: [{ label: "a", value: -1 }, { label: "b", value: 2 }] }))).join(), /0 or more/);
  assert.match(errs(chart(RANK(3, { categories: cats }))).join(), /chart\.categories: not used by kind "ranked"/);
  assert.match(validate(chart(RANK(3, { ranking: [{ label: "a", value: 1 }, { label: "b", value: 5 }, { label: "Other", value: 9 }] }))).warnings.join(), /not largest first/);
  assert.deepEqual(validate(chart(RANK(3, { ranking: [{ label: "a", value: 5 }, { label: "b", value: 1 }, { label: "Other", value: 9 }] }))).warnings, []);
});

test("ranked: with notes at most 7 items of 24 characters; pitch with a takeaway at most 6", () => {
  assert.match(errs(chart(RANK(8), { notes: THREE })).join(), /with notes at most 7/);
  assert.match(errs(chart(RANK(3, { ranking: [{ label: "x".repeat(25), value: 2 }, { label: "b", value: 1 }] }), { notes: THREE })).join(), /with notes at most 24/);
  const pitch = { title: "Objections", subtitle: "Limits lose the customer.", takeaway: "Fix the limit." };
  assert.match(errs(chart(RANK(7), pitch), "pitch").join(), /pitch with a takeaway takes at most 6/);
  assert.deepEqual(errs(chart(RANK(6), pitch), "pitch"), []);
  assert.deepEqual(errs(chart(RANK(8), { takeaway: "Fix the limit." })), []);
});

test("matrix: axes required, positions 0–100, one focus; with notes at most 6 points and no takeaway", () => {
  assert.deepEqual(errs(chart(MX(8))), []);
  assert.match(errs(chart({ ...MX(3), axes: undefined })).join(), /chart\.axes: required/);
  assert.match(errs(chart({ ...MX(2), points: [{ label: "a", x: 120, y: 5 }, { label: "b", x: 5, y: 5 }] })).join(), /chart\.points\[0\]\.x: 120; positions are 0 to 100/);
  assert.match(errs(chart({ ...MX(3), quadrants: ["a", "b"] })).join(), /chart\.quadrants: needs at least 4/);
  assert.match(errs(chart(MX(7), { notes: THREE })).join(), /with notes at most 6/);
  assert.match(errs(chart(MX(4), { notes: THREE, takeaway: "Alone." })).join(), /no room for a takeaway/);
  assert.deepEqual(errs(chart(MX(4), { takeaway: "Alone." })), []);
});

test("summary: 2–4 points of a claim and a sentence; with a takeaway at most 3", () => {
  const sum = (n: number, extra: object = {}) => ({ template: "summary", title: "Acme can build a £120m book by bundling credit with banking", points: Array.from({ length: n }, () => ({ title: "A claim", text: "Its evidence." })), ...extra });
  assert.deepEqual(errs(sum(4)), []);
  assert.match(errs(sum(5)).join(), /points: at most 4 items/);
  assert.match(errs(sum(4, { takeaway: "So what." })).join(), /with a takeaway at most 3/);
  assert.match(errs(sum(2, { points: [{ title: "x".repeat(41), text: "y" }, { title: "a", text: "b" }] })).join(), /points\[0\]\.title: 41 characters, limit 40/);
});

test("the chart card tells the agent the ranked and matrix limits", () => {
  const rules = describe("chart").rules.join(" ");
  assert.match(rules, /ranked 7 items/);
  assert.match(rules, /pitch with a takeaway at most 6 items/);
  assert.match(rules, /Matrix: notes or a takeaway, not both/);
  assert.ok(describe("chart").capabilities?.some((c) => c.name === "Ranked") && describe("chart").capabilities?.some((c) => c.name === "Matrix"));
});

test("tables highlight what the writer chooses: rows, several columns, cells by markup", () => {
  const t = { template: "table", title: "Acme offers five times the limit of the nearest SME card", table: { columns: [{ label: "Provider" }, { label: "Limit", focus: true }, { label: "Fee", focus: true }],
    rows: [{ cells: ["Bank", "£25k", "£120"] }, { cells: ["[[Acme]]", "£250k", "£0"], focus: true }] } };
  assert.deepEqual(errs(t), []);
  assert.match(errs({ ...t, table: { ...t.table, rows: [{ cells: ["a", "b", "c"], focus: "yes" }] } }).join(), /table\.rows\[0\]\.focus: must be true or false/);
});

test("consulting notes take 120 characters each; 300 in total, 200 beside a takeaway (measured on the review page)", () => {
  const chart = { categories: ["A", "B", "C"], series: [{ name: "S", mark: "bar", color: "focus", values: [1, 2, 3] }] };
  const n = (len: number) => ({ title: "Note", text: "x".repeat(len) });
  const base = { template: "chart", title: "T", chart };
  assert.deepEqual(validate({ ...base, notes: [n(120), n(120), n(60)] } as never, "consulting").errors, []);
  assert.match(validate({ ...base, notes: [n(120), n(120), n(61)] } as never, "consulting").errors.join("\n"), /301 characters in total; the limit is 300/);
  assert.match(validate({ ...base, notes: [n(121), n(10), n(10)] } as never, "consulting").errors.join("\n"), /notes\[0\]\.text: 121 characters, limit 120/);
  assert.deepEqual(validate({ ...base, takeaway: "So what.", notes: [n(50), n(75), n(75)] } as never, "consulting").errors, []);
  assert.match(validate({ ...base, takeaway: "So what.", notes: [n(80), n(80), n(41)] } as never, "consulting").errors.join("\n"), /201 characters in total; with a takeaway the limit is 200/);
});

test("upgrade turns an old pair's charts into halves", () => {
  const old = { template: "pair", title: "t", charts: [{ caption: "A", chart: { categories: cats, series: [{ name: "A", values: [1, 2, 3] }] } }, { caption: "B", chart: { categories: cats, series: [{ name: "B", values: [1, 2, 3] }] } }] };
  const u = upgrade(legacy(old)) as unknown as { halves?: unknown[]; charts?: unknown };
  assert.equal(u.halves?.length, 2);
  assert.equal(u.charts, undefined);
});
