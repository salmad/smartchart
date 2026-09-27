/* Next-step pills after a turn: GLM Flash reads the slide and the conversation, works out what the slide is
   trying to say, and suggests a few changes that help it say that. Runs in the background; no pills on failure. */
import { complete } from "./llm";

const CAN = "Charts: bars and lines (stacked, side by side or 100% shares), waterfall (a bridge between two totals), timeline (workstreams and milestones); computed annotations: CAGR arrow, difference arrow, target line; highlight one series, bar, step, card or column. Any slide: title, takeaway, numbered notes, footnote, source; another template (chart, table, big number, steps, cards); a new slide.";

export function suggestMessages({ slide, style, history = [], checks = [] }) {
  const convo = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${String(m.content).slice(0, 400)}`).join("\n");
  const failed = checks.filter((c) => !c.ok && c.msg).map((c) => c.msg).join("; ");
  return [
    { role: "system", content: `You help someone build a ${style} slide deck. Read the slide and the conversation, work out the message the slide is trying to convey, then suggest 3 or 4 next changes that would help it convey that message better. Be specific to this slide (its series, figures, labels) and suggest only what the tools can do. Reply with JSON only: {"message": "…", "suggestions": [{"label": "short button text, max 48 characters", "prompt": "the request to send to the slide agent"}]}` },
    { role: "user", content: `Slide: ${JSON.stringify(slide)}\n\nConversation:\n${convo || "(none)"}\n\nFailed checks: ${failed || "none"}\n\nWhat the tools can do: ${CAN}` },
  ];
}

/** The model's answer as { message, pills }; at most 4 pills. */
export function parseSuggestions(text) {
  let o = null;
  try { o = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { /* no pills */ }
  const pills = (Array.isArray(o?.suggestions) ? o.suggestions : [])
    .filter((p) => typeof p?.label === "string" && typeof p?.prompt === "string" && p.label.trim() && p.prompt.trim())
    .slice(0, 4).map((p) => ({ label: p.label.trim(), prompt: p.prompt.trim() }));
  return { message: typeof o?.message === "string" ? o.message : "", pills };
}

export async function suggest(args) {
  try { return parseSuggestions(await complete({ messages: suggestMessages(args), max_tokens: 900, temperature: 0.5 })); }
  catch { return { message: "", pills: [] }; }
}
