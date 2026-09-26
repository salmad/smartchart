/* Reads results.json and requests.json, writes report.md (spec 9.7 pass bars). */
import { readFileSync, writeFileSync } from "node:fs";

const { single } = JSON.parse(readFileSync("requests.json", "utf8"));
const R = JSON.parse(readFileSync("results.json", "utf8"));
const byId = Object.fromEntries(single.map((r) => [r.id, r]));

/* Numbers as written: "£2.1m" → 2.1, "1,200" → 1200. */
const numbersIn = (text) => new Set((String(text).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => parseFloat(n.replace(/,/g, ""))));
function slideNumbers(slide) {
  const out = new Set(), walk = (v) => {
    if (typeof v === "number") out.add(v);
    else if (typeof v === "string") numbersIn(v).forEach((n) => out.add(n));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(slide); return out;
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

function score(engine, rows) {
  const out = { n: 0, slide: 0, gold: 0, figuresAll: 0, figureMisses: [], invented: [], endsValid: 0, firstWrite: 0, firstWriteN: 0, replyOk: 0, ms: [], model: [], tools: [], errors: [] };
  for (const [id, r] of rows) {
    const req = byId[id]; out.n++;
    if (r.error) { out.errors.push(`${id}: ${r.error}`); continue; }
    if (!r.slide) { out.errors.push(`${id}: no slide (reply: ${String(r.reply).slice(0, 120)})`); continue; }
    out.slide++;
    if (r.slide.template === req.gold || req.acceptable.includes(r.slide.template)) out.gold++;
    const want = numbersIn(req.prompt), have = slideNumbers(r.slide);
    const missing = [...want].filter((n) => !have.has(n));
    if (!missing.length) out.figuresAll++; else out.figureMisses.push(`${id}: ${missing.join(", ")}`);
    const extra = [...have].filter((n) => !want.has(n) && n > 10 && !(n >= 1990 && n <= 2040));
    if (extra.length) out.invented.push(`${id}: ${extra.slice(0, 8).join(", ")}`);
    if (!r.fitIssues.length) out.endsValid++;
    if (engine !== "pipeline") {
      const firstEdit = r.trace.find((t) => t.step === "edit_slide");
      if (firstEdit) { out.firstWriteN++; if (firstEdit.detail.startsWith("applied")) out.firstWrite++; }
      const reply = String(r.reply || "");
      if (reply && reply.length < 600 && !/[{}]/.test(reply)) out.replyOk++;
    }
    out.ms.push(r.ms); out.model.push(r.modelCalls || 0); out.tools.push(r.toolCalls || 0);
  }
  return out;
}

const pipe = score("pipeline", Object.entries(R.pipeline || {}));
const agent = score("agent", Object.entries(R.agent || {}));
const longRows = Object.values(R.long || {}).flatMap((s) => Object.entries(s.measured || {}));
const long = score("long", longRows);
const agree = Object.keys(R.agent || {}).filter((id) => R.agent[id].slide && R.pipeline?.[id]?.slide);
const same = agree.filter((id) => R.agent[id].slide.template === R.pipeline[id].slide.template);

const lines = [
  "# Single-slide test: pipeline vs MVP agent (2026-09-26)",
  "",
  `Requests: ${single.length} from the routing bake-off set (15 consulting, 15 pitch; 3 per content template), each run in its own style from an empty deck. Long: one agent session per style, 10 warm-up turns, then 5 measured requests. Fit is measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev.`,
  "",
  "| Measure | Pipeline | Agent | Agent, after 10 turns | Agent pass bar |",
  "|---|---|---|---|---|",
  `| Requests | ${pipe.n} | ${agent.n} | ${long.n} | |`,
  `| Produced a slide | ${pct(pipe.slide, pipe.n)} | ${pct(agent.slide, agent.n)} | ${pct(long.slide, long.n)} | |`,
  `| Gold template (or acceptable) | ${pct(pipe.gold, pipe.slide)} | ${pct(agent.gold, agent.slide)} | ${pct(long.gold, long.slide)} | |`,
  `| Every request number on the slide | ${pct(pipe.figuresAll, pipe.slide)} | ${pct(agent.figuresAll, agent.slide)} | ${pct(long.figuresAll, long.slide)} | ≥ 95% |`,
  `| First edit_slide shape-valid | – | ${pct(agent.firstWrite, agent.firstWriteN)} | ${pct(long.firstWrite, long.firstWriteN)} | ≥ 90% |`,
  `| Ends with no fit issues | ${pct(pipe.endsValid, pipe.slide)} | ${pct(agent.endsValid, agent.slide)} | ${pct(long.endsValid, long.slide)} | ≥ 95% |`,
  `| Short reply, no JSON | – | ${pct(agent.replyOk, agent.slide)} | ${pct(long.replyOk, long.slide)} | ≥ 95% |`,
  `| Model calls per turn, median | ${q(pipe.model, 0.5)} | ${q(agent.model, 0.5)} | ${q(long.model, 0.5)} | |`,
  `| Tool calls per turn, median | – | ${q(agent.tools, 0.5)} | ${q(long.tools, 0.5)} | |`,
  `| Latency p50 | ${secs(q(pipe.ms, 0.5))} | ${secs(q(agent.ms, 0.5))} | ${secs(q(long.ms, 0.5))} | |`,
  `| Latency p95 | ${secs(q(pipe.ms, 0.95))} | ${secs(q(agent.ms, 0.95))} | ${secs(q(long.ms, 0.95))} | |`,
  "",
  `Same template as the pipeline: ${same.length} of ${agree.length} (${pct(same.length, agree.length)}; pass bar ≥ 90%).`,
  "Pipeline latency includes its Jev judgment checks after the slide; the agent runs none (dropped for the MVP).",
  "",
  "## For review",
  "",
  ...[["Pipeline", pipe], ["Agent", agent], ["Agent, after 10 turns", long]].flatMap(([name, s]) => [
    `### ${name}`, "",
    `- Errors or no slide: ${s.errors.length ? "" : "none"}`, ...s.errors.map((e) => `  - ${e}`),
    `- Request numbers missing from the slide: ${s.figureMisses.length ? "" : "none"}`, ...s.figureMisses.map((e) => `  - ${e}`),
    `- Numbers on the slide not in the request (above 10, not years; may be derived, e.g. a growth multiple): ${s.invented.length ? "" : "none"}`, ...s.invented.map((e) => `  - ${e}`),
    "",
  ]),
  "### Template differences (agent vs pipeline vs gold)", "",
  ...agree.filter((id) => !same.includes(id)).map((id) => `- ${id} (${byId[id].style}): agent ${R.agent[id].slide.template}, pipeline ${R.pipeline[id].slide.template}, gold ${byId[id].gold}. "${byId[id].prompt.slice(0, 110)}…"`),
];
writeFileSync("report.md", lines.join("\n") + "\n");
console.log(lines.slice(4, 21).join("\n"));
