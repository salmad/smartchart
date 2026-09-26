import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuto } from "../journey/resolve.js";
import { fakeJev } from "./fakes.js";

const cats = ["2021", "2022", "2023", "2024", "2025"];
const chart = (series, extra = {}) => ({ template: "chart", title: "Revenue [[doubled]] while margin rose", chart: { categories: cats, format: "£{v}m", series, ...extra.chart }, ...extra.slide });

test("no auto, no call", async () => {
  const jev = fakeJev();
  const r = await resolveAuto(chart([{ name: "Rev", mark: "bar", color: "focus", values: [1, 2, 3, 4, 5] }]), "consulting", jev);
  assert.equal(jev.calls.length, 0);
  assert.deepEqual(r.resolved, {});
});

test("marks, stacking, focus and icons in one call", async () => {
  const jev = fakeJev({ mark0: ["bar", 0.9], mark1: ["line", 0.8], stacked: ["side_by_side", 0.9], focus: ["item1", 0.8] });
  const s = chart([{ name: "Revenue", mark: "auto", values: [1, 2, 3, 4, 5] }, { name: "Margin", mark: "auto", format: "{v}%", values: [5, 6, 7, 8, 9] }],
    { chart: { stacked: "auto" }, slide: { focus: "auto" } });
  const r = await resolveAuto(s, "consulting", jev);
  assert.equal(jev.calls.length, 1);
  assert.deepEqual(r.slide.chart.series.map((x) => x.mark), ["bar", "line"]);
  assert.equal(r.slide.chart.stacked, false);
  assert.deepEqual(r.slide.chart.series.map((x) => x.color), ["neutral", "focus"]);
  assert.equal(r.slide.focus, undefined);
  assert.deepEqual(r.resolved["chart.series[1].mark"], { value: "line", p: 0.8 });
  assert.ok(jev.calls[0].questions.mark0.instructions.includes("Comparable series share one mark"));
});

test("a concrete value is never touched", async () => {
  const jev = fakeJev({ mark1: ["bar", 0.99] });
  const s = chart([{ name: "Revenue", mark: "line", color: "focus", values: [1, 2, 3, 4, 5] }, { name: "Cost", mark: "auto", color: "neutral", values: [1, 1, 1, 1, 1] }]);
  const r = await resolveAuto(s, "consulting", jev);
  assert.equal(r.slide.chart.series[0].mark, "line");
  assert.equal(Object.keys(jev.calls[0].questions).join(), "mark1");
});

test("below p 0.6 the default is used: bar for up to 6 categories, line for 7 or more", async () => {
  const jev = fakeJev({ mark0: ["line", 0.5] });
  const r = await resolveAuto(chart([{ name: "Rev", mark: "auto", color: "focus", values: [1, 2, 3, 4, 5] }]), "consulting", jev);
  assert.equal(r.slide.chart.series[0].mark, "bar");
});

test("comparable auto series end with one mark", async () => {
  const jev = fakeJev({ mark0: ["bar", 0.62], mark1: ["line", 0.91] });
  const s = chart([{ name: "Us", mark: "auto", color: "focus", values: [1, 2, 3, 4, 5] }, { name: "Them", mark: "auto", color: "neutral", values: [2, 2, 2, 2, 2] }]);
  const r = await resolveAuto(s, "consulting", jev);
  assert.deepEqual(r.slide.chart.series.map((x) => x.mark), ["line", "line"]);
});

test("cards: focus sets tone, icons take Jev's pick", async () => {
  const jev = fakeJev({ focus: ["item2", 0.7], icon0: ["rocket", 0.3], icon1: ["wallet", 0.2], icon2: ["scale", 0.4] });
  const s = { template: "cards", title: "Three levers", focus: "auto", cards: ["Launch", "Pay", "Grow"].map((t) => ({ icon: "auto", title: t, text: "x" })) };
  const r = await resolveAuto(s, "consulting", jev);
  assert.deepEqual(r.slide.cards.map((c) => c.icon), ["rocket", "wallet", "scale"]);
  assert.deepEqual(r.slide.cards.map((c) => c.tone), ["neutral", "neutral", "focus"]);
});

test("table and steps focus", async () => {
  const jev = fakeJev({ focus: ["item0", 0.9] });
  const t = await resolveAuto({ template: "table", title: "t", focus: "auto", table: { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }], rows: [{ cells: ["a", "1", "2"] }] } }, "consulting", jev);
  assert.deepEqual(t.slide.table.columns.map((c) => !!c.focus), [false, true, false]);
  const st = await resolveAuto({ template: "steps", title: "t", focus: "auto", steps: [{ when: "1", title: "A", text: "a" }, { when: "2", title: "B", text: "b" }] }, "consulting", fakeJev({ focus: ["item1", 0.9] }));
  assert.deepEqual(st.slide.steps.map((x) => !!x.focus), [false, true]);
});
