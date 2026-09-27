import { test } from "vitest";
import assert from "node:assert/strict";
import { columnAlign } from "../../src/engine/slides/render.js";

test("alignment follows the column's content", () => {
  const t = { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }, { label: "SLA" }, { label: "Notes" }],
    rows: [{ cells: ["Starter", "£0", "42%", "✓", "Self-serve only"] }, { cells: ["Growth", { value: "(1,234)", note: "net" }, "61%", "—", "Phone support"] }] };
  assert.deepEqual(columnAlign(t), ["text", "num", "num", "sym", "text"]);
});

test("ranges and approximations are numbers", () => {
  assert.deepEqual(columnAlign({ columns: [{ label: "Item" }, { label: "Share" }], rows: [{ cells: ["a", "40–60%"] }, { cells: ["b", "~10%"] }, { cells: ["c", "£120/yr"] }] }), ["text", "num"]);
});

test("the first column is always text; empty columns count as symbols", () => {
  assert.deepEqual(columnAlign({ columns: [{ label: "Year" }, { label: "X" }], rows: [{ cells: ["2024", "—"] }] }), ["text", "sym"]);
});
