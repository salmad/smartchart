import { test } from "vitest";
import assert from "node:assert/strict";
import { shorten, targets } from "../../src/engine/agent/shorten";
import { fakeAgent, say } from "./fakes";
import type { Slide } from "../../src/engine/types";

// Partial slides: shorten reads only the fields a path names.
const partial = (v: object) => v as Slide;

const slide = partial({ template: "chart", title: "A title that runs onto three lines of text on the slide", takeaway: "x".repeat(97),
  notes: [{ title: "a", text: "y".repeat(120) }, { title: "b" }, { title: "c", text: "z".repeat(95) }],
  table: { rows: [{ cells: ["a", { value: "1", note: "n".repeat(40) }] }] } });

test("targets: per-field limits, totals across notes, cell notes and line wraps", () => {
  const t = Object.fromEntries(targets([
    "takeaway: 97 characters, limit 75 (22 too many). Shorten this field only.",
    "notes[].text: 215 characters in total; with a takeaway the limit is 200. Shorten the notes or drop the takeaway.",
    "table.rows[0].cells[1].note: limit is 32 characters.",
    "title wraps to 3 lines (max 2); shorten it",
    "chart.categories: 7 categories; with notes at most 6. Drop notes or group categories.",
  ], slide).map((x) => [x.path, x.max]));
  assert.deepEqual(t, { takeaway: 75, "notes[0].text": 106, "notes[2].text": 83, "table.rows[0].cells[1].note": 32, title: 33 });
});

test("shorten keeps a rewrite only when it fits and its figures survive on the slide", async () => {
  const s = partial({ template: "chart", title: "Revenue grew 4.5× to £9.4m in 36 months", chart: { series: [{ values: [9.4] }] } });
  const r = await shorten([{ path: "title", text: s.title, max: 30 }], "consulting", fakeAgent([say("Revenue grew 4.5× in 36 months"), say("x")]), s);
  assert.deepEqual(r.set, { title: "Revenue grew 4.5× in 36 months" }); // £9.4m stays on the slide in the chart
  const bad = await shorten([{ path: "title", text: s.title, max: 30 }], "consulting", fakeAgent([say("Revenue grew 4.5×"), say("Revenue grew 4.5×")]), s);
  assert.deepEqual(bad.set, {}); // "36" is nowhere else
});
