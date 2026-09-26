/* Renders the v5 examples and the stress deck in both themes and fails on any issue.
   Needs: node docs/design/proposals/journey/server.mjs (port 8787). Screenshots go to ./shots/. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8787/v5/review.html";
mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
let failed = 0;
for (const q of ["", "stress=1&"]) for (const theme of ["ink", "paper"]) {
  await page.goto(`${BASE}?${q}theme=${theme}`);
  await page.waitForFunction(() => window.__fit, null, { timeout: 20000 });
  const fit = await page.evaluate(() => window.__fit);
  const issues = await page.$$eval("figure .issues > div:not(.w)", (els) => els.map((e) => `${e.closest("figure").querySelector("b").textContent}: ${e.textContent}`));
  console.log(`${q || "examples "}${theme}: ${fit.issues} issues, ${fit.warnings} warnings`);
  issues.forEach((i) => console.log(`  ${i}`));
  failed += fit.issues;
  const figs = await page.$$("figure");
  for (const [i, fig] of figs.entries()) await fig.screenshot({ path: `shots/${q ? "stress" : "examples"}-${theme}-${String(i + 1).padStart(2, "0")}.png` });
}
await browser.close();
process.exit(failed ? 1 : 0);
