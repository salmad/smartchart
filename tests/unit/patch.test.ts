import { test } from "vitest";
import assert from "node:assert/strict";
import { applyPatch, parsePath, type PatchResult } from "../../src/engine/agent/patch";
import type { Slide } from "../../src/engine/types";

const S: Slide = { template: "cards", title: "Three levers", cards: [{ icon: "zap", title: "A", text: "a" }, { icon: "zap", title: "B", text: "b" }, { icon: "zap", title: "C", text: "c" }], takeaway: "So what." };
const cards = (s: Slide) => s.cards ?? [];

/** The patched slide; fails the test when the patch was rejected. */
const applied = (r: PatchResult): Slide => { assert.ok(r.slide, r.errors?.join("; ") ?? "rejected"); return r.slide; };
const firstError = (r: PatchResult): string => r.errors?.[0] ?? "";

test("parsePath", () => {
  assert.deepEqual(parsePath("chart.series[1].values[3]"), ["chart", "series", 1, "values", 3]);
  assert.deepEqual(parsePath("title"), ["title"]);
  assert.equal(parsePath("cards[x]"), null);
  assert.equal(parsePath(".title"), null);
  assert.equal(parsePath(""), null);
});

test("sets a nested value and keeps everything else byte for byte", () => {
  const r = applyPatch(S, { "cards[1].title": "Bee" }), out = applied(r);
  assert.equal(cards(out)[1].title, "Bee");
  assert.deepEqual({ ...out, cards: null }, { ...S, cards: null });
  assert.deepEqual(cards(out)[0], cards(S)[0]);
  assert.deepEqual(r.changed, ["cards[1].title"]);
  assert.equal(cards(S)[1].title, "B", "input untouched");
});

test("null removes a field or a list item; removals run highest index first", () => {
  const out = applied(applyPatch(S, { takeaway: null, "cards[0]": null, "cards[2]": null }));
  assert.equal("takeaway" in out, false);
  assert.deepEqual(cards(out).map((c) => c.title), ["B"]);
});

test("paths refer to the slide before the patch", () => {
  const out = applied(applyPatch(S, { "cards[0]": null, "cards[2].title": "See" }));
  assert.deepEqual(cards(out).map((c) => c.title), ["B", "See"]);
});

test("an index equal to the length appends", () => {
  const out = applied(applyPatch(S, { "cards[3]": { icon: "auto", title: "D", text: "d" } }));
  assert.equal(cards(out).length, 4);
});

test("all or nothing: one bad path applies nothing", () => {
  const r = applyPatch(S, { title: "New", "cards[7].title": "x" });
  assert.ok(firstError(r).startsWith("cards[7].title: index 7 is past the end; the list has 3 items"));
  assert.equal(r.slide, undefined);
});

test("errors: malformed path, template, empty patch, not a list, missing parent", () => {
  assert.ok(firstError(applyPatch(S, { "cards..x": 1 })).includes("not a valid path"));
  assert.ok(firstError(applyPatch(S, { template: "table" })).startsWith("template:"));
  assert.ok(firstError(applyPatch(S, {})).startsWith("set:"));
  assert.ok(firstError(applyPatch(S, { "title[0]": "x" })).includes("not a list"));
  assert.ok(firstError(applyPatch(S, { "cards[9].title.x": "x" })).includes("does not exist"));
});

test("a missing optional object is created on the way", () => {
  const s: Slide = { template: "chart", title: "", chart: { series: [] }, notes: [{ title: "n" }] };
  assert.deepEqual(applied(applyPatch(s, { "notes[0].point.series": 0 })).notes?.[0].point, { series: 0 });
});
