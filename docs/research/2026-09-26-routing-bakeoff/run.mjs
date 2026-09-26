// Routing bake-off: Jev vs GLM 5.3 Flash picking a slide template.
// Usage: node --env-file=../../../.env run.mjs [limit]   (ONLY=glm-flash,... reruns selected contestants)
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const { menu, guide } = JSON.parse(readFileSync(dir + "menu.json", "utf8"));
const items = JSON.parse(readFileSync(dir + "prompts.json", "utf8")).slice(0, Number(process.argv[2]) || undefined);
const ids = Object.keys(menu);
const key = (id) => id.replace(/[/+]/g, "_"); // Jev option keys: plain identifiers
const fromKey = Object.fromEntries(ids.map((id) => [key(id), id]));
const GUIDE = guide.join("\n");
const STYLE = {
  consulting: "consulting (McKinsey-style: dense evidence, action titles)",
  pitch: "pitch (VC pitch deck: minimal text, big numbers, one idea per slide)",
};
const state = (it) => `Deck style: ${STYLE[it.style]}.\nUser request: ${it.prompt}`;

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

function jev(withGuide) {
  return async (it) => {
    const { j, ms, err } = await post("https://openrouter.ai/api/alpha/decisions", process.env.OPENROUTER_API_KEY, {
      model: "~typesafe/jev-latest",
      state: state(it),
      questions: {
        template: {
          type: "choice",
          instructions: withGuide
            ? `Which slide template best fits this request?\n${GUIDE}`
            : "Which slide template best fits this request?",
          criteria: Object.fromEntries(ids.map((id) => [key(id), menu[id]])),
        },
      },
    });
    if (err) return { err, ms };
    const a = j.answers.template;
    const probs = Object.fromEntries(Object.entries(a.probabilities).map(([k, v]) => [fromKey[k], v]));
    return { pick: fromKey[a.choice], p: probs[fromKey[a.choice]], confidence: a.confidence, probs, ms, cost: j.usage?.cost ?? 0 };
  };
}

function glm(thinking) {
  const system = [
    "You pick the slide template for a user's request. Reply with the template id only, nothing else.",
    "Templates:",
    ...ids.map((id) => `- ${id}: ${menu[id]}`),
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
        { role: "user", content: state(it) },
      ],
    });
    if (err) return { err, ms };
    const text = (j.choices[0].message.content ?? "").trim();
    const pick = ids.filter((id) => text.includes(id)).sort((a, b) => b.length - a.length)[0] ?? null;
    return { pick, raw: text.slice(0, 80), ms, tokens: j.usage?.total_tokens };
  };
}

const CONTESTANTS = {
  "jev-bare": jev(false),
  "jev-guide": jev(true),
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
