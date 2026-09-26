/* Single-slide test (spec 9.7): today's pipeline vs the MVP agent, measured in the journey page.
   Needs the local server:  node docs/design/proposals/journey/server.mjs
   Run from this folder:    npm i && node run.mjs [--only=agent|pipeline|long] [--workers=4]
   Writes results.json; then node analyze.mjs writes report.md. */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const URL = "http://localhost:8787/journey/";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const WORKERS = Number(args.workers || 4);
const { single, warmup } = JSON.parse(readFileSync("requests.json", "utf8"));
const results = existsSync("results.json") ? JSON.parse(readFileSync("results.json", "utf8")) : { pipeline: {}, agent: {}, long: {} };
const save = () => writeFileSync("results.json", JSON.stringify(results, null, 1));

const browser = await chromium.launch();

async function openPage(engine, style) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${URL}?engine=${engine}`);
  await page.waitForFunction(() => window.__journey?.live, null, { timeout: 30000 });
  await page.evaluate((s) => window.__journey.setStyle(s), style);
  return page;
}

/** Send one message and return what the turn produced. */
async function turn(page, text) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__journey.send(t), text); // resolves when the turn ends
  return page.evaluate(({ ms }) => {
    const s = window.__journey, t = s.turns.at(-1) || {};
    const item = s.items[s.current];
    return {
      ms, reply: t.reply?.what ? `${t.reply.what} ${t.reply.sub}` : t.reply, error: t.error || null,
      modelCalls: t.modelCalls ?? t.trace?.filter((x) => x.model !== "code" && x.model !== "tool").length,
      toolCalls: t.toolCalls ?? null,
      trace: (t.trace || []).map((x) => ({ step: x.step, model: x.model, ms: x.ms, detail: x.detail })),
      slides: s.items.length,
      slide: item?.slide || null, fitIssues: item?.errors || [], warnings: item?.warnings || [],
      rulesFailed: (item?.checks || []).filter((c) => !c.ok && c.id.startsWith("R")).map((c) => `${c.id}: ${c.msg}`),
    };
  }, { ms: Date.now() - t0 });
}

async function pool(items, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: WORKERS }, async () => { for (let it; (it = queue.shift()); ) await fn(it); }));
}

for (const engine of ["pipeline", "agent"]) {
  if (args.only && args.only !== engine) continue;
  await pool(single.filter((r) => !results[engine][r.id]), async (r) => {
    const page = await openPage(engine, r.style);
    try { results[engine][r.id] = await turn(page, r.prompt); }
    catch (e) { results[engine][r.id] = { error: String(e.message || e) }; }
    await page.close(); save();
    console.log(`${engine} ${r.id} ${results[engine][r.id].error ? "ERROR " + results[engine][r.id].error : `${results[engine][r.id].slide?.template} ${(results[engine][r.id].ms / 1000).toFixed(1)}s`}`);
  });
}

/* Long conversation: one session per style, 10 warm-up turns, then the first request of each template. */
if (!args.only || args.only === "long") {
  await Promise.all(["consulting", "pitch"].map(async (style) => {
    if (results.long[style]?.done) return;
    const page = await openPage("agent", style), measured = {};
    const targets = ["chart", "table", "number", "steps", "cards"].map((g) => single.find((r) => r.style === style && r.gold === g));
    for (const w of warmup[style]) { try { await turn(page, w.prompt); } catch (e) { console.log(`long ${style} warm-up error ${e.message}`); } console.log(`long ${style} warm-up ${w.id}`); }
    for (const r of targets) {
      try { measured[r.id] = await turn(page, r.prompt); } catch (e) { measured[r.id] = { error: String(e.message || e) }; }
      console.log(`long ${style} ${r.id} ${measured[r.id].slide?.template} ${(measured[r.id].ms / 1000).toFixed(1)}s`);
    }
    results.long[style] = { done: true, measured }; save();
    await page.close();
  }));
}

await browser.close();
console.log("done");
