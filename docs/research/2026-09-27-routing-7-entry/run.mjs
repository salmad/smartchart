// Routing bake-off on the 7-entry menu: Jev vs GLM 5.3 Flash picking a slide template.
// Menu, picking guide and the PRE call are imported from the journey prototype, so this tests what it runs.
// Usage: node --env-file=../../../.env run.mjs [limit]   (ONLY=glm-flash,... reruns selected contestants)
import { readFileSync, writeFileSync } from "node:fs";
import { MENU } from "../../design/proposals/v5/schema.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE } from "../../design/proposals/journey/prompts.js";
import { preStep } from "../../design/proposals/journey/pre.js";

const dir = new URL(".", import.meta.url).pathname;
const items = JSON.parse(readFileSync(dir + "prompts.json", "utf8")).slice(0, Number(process.argv[2]) || undefined);
const ids = Object.keys(MENU);
writeFileSync(dir + "menu.json", JSON.stringify({ options: MENU_OPTIONS, guide: GUIDE }, null, 2) + "\n"); // snapshot of what was tested

async function post(url, auth, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
      return { j, ms: performance.now() - t0 };
    } catch (e) {
      if (attempt === 3) return { err: String(e.message ?? e), ms: performance.now() - t0 };
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
}

/* Same shape as journey/llm.js jev(), but calling OpenRouter directly instead of the local proxy. */
const keyOf = (s) => s.replace(/[^A-Za-z0-9_]/g, "_");
async function jevCall(state, questions) {
  const back = {};
  const qs = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
    back[id] = Object.fromEntries(Object.keys(q.options).map((v) => [keyOf(v), v]));
    return [id, { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(Object.entries(q.options).map(([v, d]) => [keyOf(v), d])) }];
  }));
  const { j, ms, err } = await post("https://openrouter.ai/api/alpha/decisions", process.env.OPENROUTER_API_KEY,
    { model: "~typesafe/jev-latest", state, questions: qs });
  if (err) throw new Error(err);
  const out = { _ms: Math.round(ms), _cost: j.usage?.cost ?? 0 };
  for (const [id, a] of Object.entries(j.answers || {})) {
    const probabilities = Object.fromEntries(Object.entries(a.probabilities).map(([k, v]) => [back[id][k] ?? k, v]));
    out[id] = { choice: back[id][a.choice] ?? a.choice, p: probabilities[back[id][a.choice] ?? a.choice] ?? 0, probabilities };
  }
  return out;
}

/* Jev with the guide: the journey PRE step itself (intent, template, card lead in one call), on an empty deck. */
async function jevGuide(it) {
  let cost = 0;
  const jev = async (state, qs) => { const r = await jevCall(state, qs); cost = r._cost; return r; };
  try {
    const r = await preStep({ text: it.prompt, deck: { style: it.style, slides: [] }, selection: null, jev });
    return { pick: r.template, p: r.probabilities[r.template], probs: r.probabilities, intent: r.intent, pIntent: r.p, ms: r.ms, cost };
  } catch (e) { return { err: String(e.message ?? e) }; }
}

/* Jev bare: one template question, the menu options, no guide. */
async function jevBare(it) {
  try {
    const r = await jevCall(`Deck style: ${STYLE_STATE[it.style]}.\nUser request: ${it.prompt}`,
      { template: { instructions: "Which slide template best fits this request?", options: MENU_OPTIONS } });
    return { pick: r.template.choice, p: r.template.p, probs: r.template.probabilities, ms: r._ms, cost: r._cost };
  } catch (e) { return { err: String(e.message ?? e) }; }
}

function glm(thinking) {
  const system = [
    "You pick the slide template for a user's request. Reply with the template id only, nothing else.",
    "Templates:",
    ...Object.entries(MENU).map(([id, t]) => `- ${id}: ${t.summary} Use when: ${t.use}`),
    "",
    GUIDE,
  ].join("\n");
  return async (it) => {
    const { j, ms, err } = await post("https://api.z.ai/api/coding/paas/v4/chat/completions", process.env.GLM_API_KEY, {
      model: "glm-5.3-flash",
      thinking: { type: thinking ? "enabled" : "disabled" },
      temperature: 0,
      max_tokens: thinking ? 4000 : 400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Deck style: ${STYLE_STATE[it.style]}.\nUser request: ${it.prompt}` },
      ],
    });
    if (err) return { err, ms };
    const text = (j.choices[0].message.content ?? "").trim().toLowerCase();
    const words = text.match(/[a-z]+/g) ?? [];
    const pick = words.find((w) => ids.includes(w)) ?? null;
    return { pick, raw: text.slice(0, 80), ms, tokens: j.usage?.total_tokens };
  };
}

const CONTESTANTS = {
  "jev-guide": jevGuide,
  "jev-guide-2": jevGuide,
  "jev-bare": jevBare,
  "jev-bare-2": jevBare,
  "glm-flash": glm(false),
  "glm-flash-think": glm(true),
};

async function pool(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k], k); }
  }));
  return out;
}

const only = process.env.ONLY?.split(",");
const results = only ? JSON.parse(readFileSync(dir + "results.json", "utf8")).results : {};
for (const [name, fn] of Object.entries(CONTESTANTS)) {
  if (only && !only.includes(name)) continue;
  process.stdout.write(`${name}: `);
  results[name] = await pool(items, name.startsWith("jev") ? 8 : 4, async (it) => {
    const r = await fn(it);
    process.stdout.write(r.err ? "x" : r.pick === it.gold ? "." : "-");
    return { id: it.id, ...r };
  });
  process.stdout.write("\n");
}
writeFileSync(dir + "results.json", JSON.stringify({ items, results }, null, 1));
console.log("wrote results.json");
