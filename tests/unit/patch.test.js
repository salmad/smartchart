import { test } from "vitest";
import assert from "node:assert/strict";
import { applyPatch, parsePath } from "../../src/engine/agent/patch.js";

const S = { template: "cards", title: "Three levers", cards: [{ icon: "zap", title: "A", text: "a" }, { icon: "zap", title: "B", text: "b" }, { icon: "zap", title: "C", text: "c" }], takeaway: "So what." };

test("parsePath", () => {
  assert.deepEqual(parsePath("chart.series[1].values[3]"), ["chart", "series", 1, "values", 3]);
  assert.deepEqual(parsePath("title"), ["title"]);
  assert.equal(parsePath("cards[x]"), null);
  assert.equal(parsePath(".title"), null);
  assert.equal(parsePath(""), null);
});

test("sets a nested value and keeps everything else byte for byte", () => {
  const r = applyPatch(S, { "cards[1].title": "Bee" });
  assert.equal(r.slide.cards[1].title, "Bee");
  assert.deepEqual({ ...r.slide, cards: null }, { ...S, cards: null });
  assert.deepEqual(r.slide.cards[0], S.cards[0]);
  assert.deepEqual(r.changed, ["cards[1].title"]);
  assert.equal(S.cards[1].title, "B", "input untouched");
});

test("null removes a field or a list item; removals run highest index first", () => {
  const r = applyPatch(S, { takeaway: null, "cards[0]": null, "cards[2]": null });
  assert.equal("takeaway" in r.slide, false);
  assert.deepEqual(r.slide.cards.map((c) => c.title), ["B"]);
});

test("paths refer to the slide before the patch", () => {
  const r = applyPatch(S, { "cards[0]": null, "cards[2].title": "See" });
  assert.deepEqual(r.slide.cards.map((c) => c.title), ["B", "See"]);
});

test("an index equal to the length appends", () => {
  const r = applyPatch(S, { "cards[3]": { icon: "auto", title: "D", text: "d" } });
  assert.equal(r.slide.cards.length, 4);
});

test("all or nothing: one bad path applies nothing", () => {
  const r = applyPatch(S, { title: "New", "cards[7].title": "x" });
  assert.ok(r.errors[0].startsWith("cards[7].title: index 7 is past the end; the list has 3 items"));
  assert.equal(r.slide, undefined);
});

test("errors: malformed path, template, empty patch, not a list, missing parent", () => {
  assert.ok(applyPatch(S, { "cards..x": 1 }).errors[0].includes("not a valid path"));
  assert.ok(applyPatch(S, { template: "table" }).errors[0].startsWith("template:"));
  assert.ok(applyPatch(S, {}).errors[0].startsWith("set:"));
  assert.ok(applyPatch(S, { "title[0]": "x" }).errors[0].includes("not a list"));
  assert.ok(applyPatch(S, { "cards[9].title.x": "x" }).errors[0].includes("does not exist"));
});

test("a missing optional object is created on the way", () => {
  const s = { template: "chart", chart: { series: [] }, notes: [{ title: "n" }] };
  assert.deepEqual(applyPatch(s, { "notes[0].point.series": 0 }).slide.notes[0].point, { series: 0 });
});
