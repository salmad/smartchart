/* Hybrid agent test (spec 9.7), measured in the journey page: single slides, long sessions, surgical edits.
   Needs the app with the models: npm run dev (port 5173, .env with the keys)
   Run from this folder:          npm i && node --experimental-strip-types run.mjs [--only=agent|long|edits] [--workers=4]
   Writes results.json (finished ids are skipped on a rerun); then node analyze.mjs writes report.md. */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { EXAMPLES } from "../../src/engine/slides/examples.ts";

const URL = "http://localhost:5173/";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const WORKERS = Number(args.workers || 4);
const { single, warmup } = JSON.parse(readFileSync("requests.json", "utf8"));
const edits = JSON.parse(readFileSync("edits.json", "utf8"));
const results = existsSync("results.json") ? JSON.parse(readFileSync("results.json", "utf8")) : {};
results.agent ||= {}; results.long ||= {}; results.edits ||= {};
const save = () => writeFileSync("results.json", JSON.stringify(results, null, 1));
const specFor = ({ consulting, pitch, name, ...shared }, style) => ({ ...shared, ...(style === "pitch" ? pitch : consulting) });

const browser = await chromium.launch();

async function openPage(style) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.__journey?.live, null, { timeout: 30000 });
  await page.evaluate((s) => window.__journey.setStyle(s), style);
  return page;
}

/** Send one message; resolves after the reply and the judgment checks. `ms` is the page's time to the reply. */
async function turn(page, text) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__journey.send(t), text);
  return page.evaluate(({ totalMs }) => {
    const s = window.__journey, t = s.turns.at(-1) || {};
    const item = s.items.find((it) => it.id === (t.written?.at(-1) ?? s.items[s.current]?.id));
    return {
      ms: t.ms ?? totalMs, totalMs, reply: t.reply ?? null, error: t.error || null, pre: t.pre || null, written: t.written || [],
      modelCalls: t.modelCalls ?? null, toolCalls: t.toolCalls ?? null,
      trace: (t.trace || []).map((x) => ({ step: x.step, model: x.model, ms: x.ms, detail: x.detail })),
      slides: s.items.length, slide: item?.slide || null, fitIssues: item?.errors || [], warnings: item?.warnings || [],
      checksFailed: (item?.checks || []).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`),
    };
  }, { totalMs: Date.now() - t0 });
}

async function pool(items, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: WORKERS }, async () => { for (let it; (it = queue.shift()); ) await fn(it); }));
}

/* Single requests: each in its own style from an empty deck. */
if (!args.only || args.only === "agent") await pool(single.filter((r) => !results.agent[r.id]), async (r) => {
  const page = await openPage(r.style);
  try { results.agent[r.id] = await turn(page, r.prompt); } catch (e) { results.agent[r.id] = { error: String(e.message || e) }; }
  await page.close(); save();
  const x = results.agent[r.id];
  console.log(`agent ${r.id} ${x.error ? `ERROR ${x.error}` : `${x.slide?.template} ${(x.ms / 1000).toFixed(1)}s`}`);
});

/* Surgical edits: start from an approved example, one request, compare the slide before and after. */
if (!args.only || args.only === "edits") await pool(edits.filter((e) => !results.edits[e.id]), async (e) => {
  const ex = EXAMPLES.find((x) => x.name === e.start);
  const page = await openPage(e.style);
  try {
    await page.evaluate(([s, st]) => window.__journey.load([s], st), [specFor(ex, e.style), e.style]);
    const start = await page.evaluate(() => structuredClone(window.__journey.items[0].slide));
    results.edits[e.id] = { ...(await turn(page, e.prompt)), start };
  } catch (err) { results.edits[e.id] = { error: String(err.message || err) }; }
  await page.close(); save();
  console.log(`edit ${e.id} ${results.edits[e.id].error || `${(results.edits[e.id].ms / 1000).toFixed(1)}s`}`);
});

/* Long conversation: one session per style, 10 warm-up turns, then the first request of each template. */
if (!args.only || args.only === "long") await Promise.all(["consulting", "pitch"].map(async (style) => {
  if (results.long[style]?.done) return;
  const page = await openPage(style), measured = {};
  const targets = ["chart", "table", "number", "steps", "cards"].map((g) => single.find((r) => r.style === style && r.gold === g));
  for (const w of warmup[style]) { try { await turn(page, w.prompt); } catch (e) { console.log(`long ${style} warm-up error ${e.message}`); } console.log(`long ${style} warm-up ${w.id}`); }
  for (const r of targets) {
    try { measured[r.id] = await turn(page, r.prompt); } catch (e) { measured[r.id] = { error: String(e.message || e) }; }
    console.log(`long ${style} ${r.id} ${measured[r.id].slide?.template} ${(measured[r.id].ms / 1000).toFixed(1)}s`);
  }
  results.long[style] = { done: true, measured }; save();
  await page.close();
}));

await browser.close();
console.log("done");
