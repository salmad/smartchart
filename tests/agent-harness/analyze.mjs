/* Reads results.json, requests.json and edits.json; writes report.md with the spec 9.7 pass bars. */
import { readFileSync, writeFileSync } from "node:fs";

const { single } = JSON.parse(readFileSync("requests.json", "utf8"));
const edits = JSON.parse(readFileSync("edits.json", "utf8"));
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
const ratio = (a, b) => (b ? a / b : 0);
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;
const bar = (ok) => (ok ? "PASS" : "FAIL");
const isWrite = (t) => (t.step === "edit_slide" || t.step === "patch_slide") && t.model === "tool";
const lintIssues = (r) => r.fitIssues.filter((i) => /\(L\d\)$/.test(i));

/** Single-slide and long-session turns, against the request's figures and gold template. */
function score(rows) {
  const out = { n: 0, slide: 0, gold: 0, figuresAll: 0, figureMisses: [], endsValid: 0, notValid: [], firstWrite: 0, firstWriteN: 0, replyOk: 0, ms: [], errors: [] };
  for (const [id, r] of rows) {
    const req = byId[id]; out.n++;
    if (r.error) { out.errors.push(`${id}: ${r.error}`); continue; }
    if (!r.slide) { out.errors.push(`${id}: no slide (reply: ${String(r.reply).slice(0, 120)})`); continue; }
    out.slide++;
    if (r.slide.template === req.gold || req.acceptable?.includes(r.slide.template)) out.gold++;
    const missing = [...numbersIn(req.prompt)].filter((n) => !slideNumbers(r.slide).has(n));
    if (!missing.length) out.figuresAll++; else out.figureMisses.push(`${id}: ${missing.join(", ")}`);
    if (!r.fitIssues.length) out.endsValid++; else out.notValid.push(`${id}: ${r.fitIssues.join(" | ")}`);
    const first = r.trace.find(isWrite);
    if (first) { out.firstWriteN++; if (first.detail.startsWith("applied")) out.firstWrite++; }
    const reply = String(r.reply || "");
    if (reply && reply.length < 600 && !/[{}]/.test(reply)) out.replyOk++;
    out.ms.push(r.ms);
  }
  return out;
}

const agent = score(Object.entries(R.agent || {}));
const long = score(Object.values(R.long || {}).flatMap((s) => Object.entries(s.measured || {})));

/* Edits: paths that changed outside `allow`, and the expected values. */
const get = (obj, path) => path.split(/\.|\[|\]/).filter(Boolean).reduce((o, k) => (o == null ? undefined : k === "length" ? o.length : o[k]), obj);
/** Leaf paths of a slide: { "chart.series[0].values[1]": 4.8, … }. */
function leaves(v, path = "", out = {}) {
  if (Array.isArray(v)) { out[`${path}.length`] = v.length; v.forEach((x, i) => leaves(x, `${path}[${i}]`, out)); }
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => leaves(x, path ? `${path}.${k}` : k, out));
  else out[path] = v;
  return out;
}
function drift(start, end, allow) {
  const a = leaves(start), b = leaves(end);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p] && !allow.some((x) => p === x || p.startsWith(`${x}.`) || p.startsWith(`${x}[`)));
}
const E = edits.map((e) => ({ e, r: R.edits?.[e.id] })).filter((x) => x.r && !x.r.error && x.r.slide);
const editErrors = edits.filter((e) => !R.edits?.[e.id] || R.edits[e.id].error || !R.edits[e.id].slide).map((e) => `${e.id}: ${R.edits?.[e.id]?.error || "no result"}`);
const drifted = E.map(({ e, r }) => ({ id: e.id, paths: drift(r.start, r.slide, e.allow) })).filter((x) => x.paths.length);
const missed = E.filter(({ e, r }) => !e.expect.every((x) => get(r.slide, x.path) === x.equals));
const editValid = E.filter(({ r }) => !r.fitIssues.length);
const editMs = E.map(({ r }) => r.ms);
const surgical = E.filter(({ r }) => r.trace.filter(isWrite).every((t) => t.step === "patch_slide"));

/* Jev choices on chart requests, against the labels. */
const marksOf = (s) => { const m = new Set((s?.chart?.series || []).map((x) => x.mark)); return m.size > 1 ? "bar+line" : [...m][0]; };
const labelled = single.filter((r) => r.choices && R.agent?.[r.id]?.slide?.template === "chart");
const choiceOk = labelled.filter((r) => marksOf(R.agent[r.id].slide) === r.choices.marks && !!R.agent[r.id].slide.chart.stacked === !!r.choices.stacked);

/* Every turn with a result. */
const allTurns = [...Object.values(R.agent || {}), ...Object.values(R.long || {}).flatMap((s) => Object.values(s.measured || {})), ...Object.values(R.edits || {})].filter((r) => r && !r.error && r.trace);
const endedByWrite = allTurns.filter((r) => !r.trace.some((t) => t.step === "Reply"));
const preActed = allTurns.filter((r) => r.trace.some((t) => t.model === "code"));
const finals = allTurns.filter((r) => r.slide), lintBad = finals.filter((r) => lintIssues(r).length);
const preOk = [...Object.entries(R.agent || {}).map(([, r]) => [r, "new_slide"]), ...E.map(({ r }) => [r, "edit_selected"])].filter(([r]) => r.pre);
const preRight = preOk.filter(([r, want]) => r.pre.intent === want);

const figures = ratio(agent.figuresAll + long.figuresAll, agent.slide + long.slide);
const rows = [
  ["Every request number on the slide (single + long)", "≥ 95%", pct(agent.figuresAll + long.figuresAll, agent.slide + long.slide), figures >= 0.95],
  ["First write shape-valid, long session", "≥ 90%", pct(long.firstWrite, long.firstWriteN), ratio(long.firstWrite, long.firstWriteN) >= 0.9],
  ["First write shape-valid, single", "", pct(agent.firstWrite, agent.firstWriteN), null],
  ["Ends with no fit issues (single / long / edits)", "≥ 95%", `${pct(agent.endsValid, agent.slide)} / ${pct(long.endsValid, long.slide)} / ${pct(editValid.length, E.length)}`,
    ratio(agent.endsValid + long.endsValid + editValid.length, agent.slide + long.slide + E.length) >= 0.95],
  ["Drift on edits (paths outside `allow`)", "0", `${drifted.length} of ${E.length} edits`, drifted.length === 0],
  ["Edits reaching their `expect`", "", pct(E.length - missed.length, E.length), null],
  ["Edits done only with patch_slide", "", pct(surgical.length, E.length), null],
  ["Latency p50, new slide", "≤ 13 s", secs(q(agent.ms, 0.5)), q(agent.ms, 0.5) <= 13000],
  ["Latency p50, small edit", "≤ 6 s", secs(q(editMs, 0.5)), q(editMs, 0.5) <= 6000],
  ["Template agrees with gold (single + long)", "≥ 90%", pct(agent.gold + long.gold, agent.slide + long.slide), ratio(agent.gold + long.gold, agent.slide + long.slide) >= 0.9],
  ["Short reply, no JSON (single + long)", "≥ 95%", pct(agent.replyOk + long.replyOk, agent.slide + long.slide), ratio(agent.replyOk + long.replyOk, agent.slide + long.slide) >= 0.95],
  ["Layout lints clean on every final slide", "100%", pct(finals.length - lintBad.length, finals.length), lintBad.length === 0],
  ["Jev choices vs labels (chart requests routed to chart)", "≥ 90%", `${pct(choiceOk.length, labelled.length)} (${choiceOk.length} of ${labelled.length})`, ratio(choiceOk.length, labelled.length) >= 0.9],
];

const list = (title, items) => [`- ${title}: ${items.length ? "" : "none"}`, ...items.map((x) => `  - ${x}`)];
const lines = [
  "# Hybrid agent test (2026-09-27)",
  "",
  `Single: ${agent.n} requests from the routing bake-off set, each in its own style from an empty deck. Long: one session per style, 10 warm-up turns, then 5 measured requests. Edits: ${edits.length} requests on approved example slides. Fit and layout lints are measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev. Latency is time to the reply; judgment checks run after it.`,
  "",
  "| Measure | Pass | Result | |",
  "|---|---|---|---|",
  ...rows.map(([m, p, v, ok]) => `| ${m} | ${p} | ${v} | ${ok === null ? "" : bar(ok)} |`),
  "",
  "| Also measured | Result |",
  "|---|---|",
  `| PRE made the first tool call | ${pct(preActed.length, allTurns.length)} of ${allTurns.length} turns |`,
  `| PRE intent right (single: new_slide, edits: edit_selected) | ${pct(preRight.length, preOk.length)} |`,
  `| Turns ended by a write's reply (no extra model call) | ${pct(endedByWrite.length, allTurns.length)} |`,
  `| Model calls per turn, median (single / long / edits) | ${q(Object.values(R.agent || {}).map((r) => r.modelCalls || 0), 0.5)} / ${q(Object.values(R.long || {}).flatMap((s) => Object.values(s.measured || {})).map((r) => r.modelCalls || 0), 0.5)} / ${q(E.map(({ r }) => r.modelCalls || 0), 0.5)} |`,
  `| Latency p95 (new slide / small edit) | ${secs(q(agent.ms, 0.95))} / ${secs(q(editMs, 0.95))} |`,
  "",
  "## For review",
  "",
  ...[["Single", agent], ["Long", long]].flatMap(([name, s]) => [`### ${name}`, "",
    ...list("Errors or no slide", s.errors), ...list("Request numbers missing from the slide", s.figureMisses), ...list("Fit issues left", s.notValid), ""]),
  "### Edits", "",
  ...list("Errors", editErrors),
  ...list("Drift", drifted.map((d) => `${d.id}: ${d.paths.join(", ")}`)),
  ...list("Expected values not reached", missed.map(({ e, r }) => `${e.id}: ${e.expect.map((x) => `${x.path} = ${JSON.stringify(get(r.slide, x.path))} (want ${JSON.stringify(x.equals)})`).join("; ")}`)),
  ...list("Fit issues left", E.filter(({ r }) => r.fitIssues.length).map(({ e, r }) => `${e.id}: ${r.fitIssues.join(" | ")}`)),
  ...list("Not only patch_slide", E.filter((x) => !surgical.includes(x)).map(({ e, r }) => `${e.id}: ${r.trace.filter(isWrite).map((t) => t.step).join(", ")}`)),
  "",
  "### Jev chart choices", "",
  ...labelled.map((r) => `- ${r.id}: got ${marksOf(R.agent[r.id].slide)}${R.agent[r.id].slide.chart.stacked ? " stacked" : ""}, label ${r.choices.marks}${r.choices.stacked ? " stacked" : ""} ${choiceOk.includes(r) ? "✓" : "✗"}`),
  "",
  ...list("Layout lint issues on final slides", lintBad.map((r) => `${r.slide.template}: ${lintIssues(r).join(" | ")}`)),
];
writeFileSync("report.md", lines.join("\n") + "\n");
console.log(lines.slice(4, 26).join("\n"));
