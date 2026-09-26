/* Model client: GLM (chat and agent steps) and Jev, through the proxy (server.mjs locally, api/ on Vercel). */

export const FLASH = "glm-5.3-flash", BIG = "glm-5.3";

async function post(path, payload) {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j).slice(0, 300));
      return { j, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((ok) => setTimeout(ok, 1200 * (attempt + 1)));
    }
  }
}

/** One agent step: GLM 5.3 Flash with tools. Returns the assistant message (content and/or tool_calls). */
export async function agentStep({ messages, tools, toolChoice = "auto", model = FLASH }) {
  const { j, ms } = await post("/api/glm", { model, messages, tools, tool_choice: toolChoice, temperature: 0.3, max_tokens: 8000 });
  const m = j.choices?.[0]?.message || {};
  const message = { role: "assistant", content: m.content || "", ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
  return { message, ms, tokens: j.usage?.total_tokens ?? 0 };
}

/** GLM chat call. With `json`, the reply is parsed into an object (code fences tolerated). */
export async function glm({ system, user, model = FLASH, thinking = false, json = true, temperature = 0.3 }) {
  const { j, ms } = await post("/api/glm", {
    model, thinking, temperature, max_tokens: thinking ? 8000 : 4000,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
  const text = j.choices?.[0]?.message?.content ?? "";
  const tokens = j.usage?.total_tokens ?? 0;
  return { value: json ? parseJSON(text) : text.trim(), ms, tokens, model };
}

export function parseJSON(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error(`the model did not return JSON: ${t.slice(0, 120)}`);
  }
}

/* Jev option keys must be plain identifiers; map anything else and back. */
const keyOf = (s) => s.replace(/[^A-Za-z0-9_]/g, "_");

/**
 * Jev: several closed-set decisions in one call.
 * questions: { id: { instructions, options: { value: description } } }
 * returns   { id: { choice, p, probabilities } } with the original option values.
 */
export async function jev(state, questions) {
  const back = {};
  const qs = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
    back[id] = Object.fromEntries(Object.keys(q.options).map((v) => [keyOf(v), v]));
    return [id, { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(Object.entries(q.options).map(([v, d]) => [keyOf(v), d])) }];
  }));
  const { j, ms } = await post("/api/jev", { state, questions: qs });
  const out = { _ms: ms, _cost: j.usage?.cost ?? 0 };
  for (const [id, a] of Object.entries(j.answers || {})) {
    const probabilities = Object.fromEntries(Object.entries(a.probabilities).map(([k, v]) => [back[id][k] ?? k, v]));
    out[id] = { choice: back[id][a.choice] ?? a.choice, p: probabilities[back[id][a.choice] ?? a.choice] ?? 0, probabilities };
  }
  return out;
}
