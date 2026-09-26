/* Records the journey's replay runs with the live agent: one session per style, a few turns each.
   Needs: node docs/design/proposals/journey/server.mjs (port 8787, with the model keys).
   Writes ../../journey/replays.json. */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const SESSIONS = [
  { name: "Consulting · SaaS growth", style: "consulting", theme: "ink", turns: [
    "Our SaaS revenue grew from £2.1m in 2022 to £4.8m in 2023, £7.2m in 2024 and £9.4m in 2025, while monthly churn fell from 8% to 3%",
    "Make the title shorter",
    "Add a table comparing our three plans: Starter £29 with 3 seats and email support, Growth £99 with 10 seats and chat support, Enterprise custom with unlimited seats and a 99.9% SLA",
    "Add a slide with the plan for the next 18 months: pilot with 5 hospitals, certify, then roll out nationally",
    "Highlight the Growth plan",
  ] },
  { name: "Pitch · café ordering", style: "pitch", theme: "ink", turns: [
    "The problem: independent cafés lose 11 hours a week to supplier ordering",
    "Our traction: 40 paying cafés, £38k MRR, growing 22% a month",
    "Why we win: suppliers compete for orders instead of cafés chasing suppliers",
    "Make the traction slide show MRR by month: £4k in March, £9k in April, £17k in May, £26k in June, £38k in July",
  ] },
];

const browser = await chromium.launch();
const runs = [];
for (const s of SESSIONS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:8787/journey/");
  await page.waitForFunction(() => window.__journey?.live, null, { timeout: 30000 });
  await page.evaluate((st) => window.__journey.setStyle(st), s.style);
  for (const t of s.turns) {
    await page.evaluate((x) => window.__journey.send(x), t);
    console.log(`${s.style}: ${t.slice(0, 50)}… ${await page.evaluate(() => (window.__journey.turns.at(-1).ms / 1000).toFixed(1))}s`);
  }
  const turns = await page.evaluate(() => window.__journey.turns.map((t) => ({ request: t.request, trace: t.trace, reply: t.reply || t.error, items: t.items, current: t.current })));
  runs.push({ name: s.name, style: s.style, theme: s.theme, turns });
  await page.close();
}
await browser.close();
writeFileSync(new URL("../../journey/replays.json", import.meta.url), JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), models: "GLM 5.3 Flash + Jev (hybrid agent)", runs }, null, 1));
console.log("replays.json written");
