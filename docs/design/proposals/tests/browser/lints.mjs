/* Layout lints on known-good and known-bad slides. Needs the journey server on 8787. */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:8787/tests/browser/fixture.html");
await page.waitForFunction(() => window.ready);
const lint = (slide, style = "consulting") => page.evaluate(([s, st]) => window.lint(s, st), [slide, style]);
const title = "Revolvers carry the margin while transactors earn theirs on interchange alone";

// A 2-row table with no notes leaves most of the body empty: L5 warns.
const sparse = await lint({ template: "table", title, table: { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }], rows: [{ cells: ["Starter", "£0", "42%"] }, { cells: ["Growth", "£49", "61%"] }] } });
assert.ok(sparse.warnings.some((m) => m.startsWith("body:") && m.endsWith("(L5)")), JSON.stringify(sparse));
assert.deepEqual(sparse.issues, [], JSON.stringify(sparse));

// A full 7-row table: columns equal (L1), gap right (L3), fills the body (L5).
const rows = Array.from({ length: 7 }, (_, i) => ({ cells: [`Line item ${i + 1}`, "(1,234)", "12,345", "(34)"] }));
const full = await lint({ template: "table", title, table: { columns: [{ label: "£ per customer per month" }, { label: "Revolver" }, { label: "Transactor" }, { label: "Super" }], rows } });
assert.deepEqual([...full.issues, ...full.warnings], [], JSON.stringify(full));

// Pitch gap is 72 px.
const pitch = await lint({ template: "steps", title: "The plan", subtitle: "Five million to a funded book.", steps: [
  { when: "0–6 mo", title: "Build", text: "First 100 cards." }, { when: "6–18 mo", title: "Prove", text: "£10m book." }, { when: "Year 2", title: "Scale", text: "£120m book." }] }, "pitch");
assert.ok(!pitch.issues.some((m) => m.endsWith("(L3)")), JSON.stringify(pitch));

console.log("lints ok");
await browser.close();
