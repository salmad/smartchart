/* Next-step pills after a turn: GLM Flash reads the slide and the conversation, works out what the slide is
   trying to say, and suggests a few changes that help it say that. Runs in the background; no pills on failure. */
import { complete, type ChatMessage } from "./llm.js";
import { asSlide } from "../docs/figure.js";
import { OFFERED, MENU } from "../slides/schema.js";
import { softChecks } from "./soft.js";
import type { Check } from "./checks.js";
import type { Doc } from "../docs/types.js";
import type { Slide, Style } from "../types.js";

export interface Pill { label: string; prompt: string }
export interface SuggestArgs { slide: Slide; style: Style; history?: ChatMessage[]; checks?: Pick<Check, "ok" | "msg">[] }
export interface Suggestions { message: string; pills: Pill[] }

// What the tools can do. The templates come from the menu, so a new template is suggested as soon as it exists.
const CAN = `Charts: bars and lines (stacked, side by side or 100% shares), waterfall (a bridge between two totals), timeline (workstreams with sub-steps, and milestones), ranked horizontal bars (named items by one measure), a 2×2 matrix (points on two judged axes, named quadrants); computed annotations: CAGR arrow, difference arrow, target line; highlight one series, bar, step, card, point, column, row or table cell. Tables: scores as Harvey balls or ticks; an action with a detail note, owner and date. Any slide: title, takeaway, numbered notes, footnote, source, speaker notes (talk: what to say over it, never shown on the slide, read in the presenter view); a chart or table: a caption saying what it shows (measure, scope, period, unit); notes: a one- or two-word heading over them (Notes, What drives it), only as a suggestion; a new slide. Another template: ${OFFERED.filter((id) => id !== "cover").map((id) => `${id} (${MENU[id].use})`).join("; ")}.`;

export function suggestMessages({ slide, style, history = [], checks = [] }: SuggestArgs): ChatMessage[] {
  const convo = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${String(m.content).slice(0, 400)}`).join("\n");
  const failed = checks.filter((c) => !c.ok && c.msg).map((c) => c.msg).join("; ");
  return [
    { role: "system", content: `You help someone build a ${style} slide deck. Read the slide and the conversation, work out the message the slide is trying to convey, then suggest 3 or 4 next changes that would help it convey that message better. Be specific to this slide (its series, figures, labels) and suggest only what the tools can do. When code suggestions mention chart annotations (CAGR, difference, target), include at least one pill that asks for that annotation by name. Reply with JSON only: {"message": "…", "suggestions": [{"label": "short button text, max 48 characters", "prompt": "the request to send to the slide agent"}]}` },
    { role: "user", content: `Slide: ${JSON.stringify(slide)}\n\nConversation:\n${convo || "(none)"}\n\nFailed checks: ${failed || "none"}\n\nCode suggestions (high-value; prefer one of these as a pill when present): ${softChecks(slide).map((x) => x.msg).join("; ") || "none"}\n\nWhat the tools can do: ${CAN}` },
  ];
}

/** The model's answer as { message, pills }; at most 4 pills. */
export function parseSuggestions(text: unknown): Suggestions {
  let o: { message?: unknown; suggestions?: unknown } | null = null;
  try { o = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { /* no pills */ }
  const pills = (Array.isArray(o?.suggestions) ? o.suggestions : [])
    .filter((p): p is Pill => typeof p?.label === "string" && typeof p?.prompt === "string" && !!p.label.trim() && !!p.prompt.trim())
    .slice(0, 4).map((p) => ({ label: p.label.trim(), prompt: p.prompt.trim() }));
  return { message: typeof o?.message === "string" ? o.message : "", pills };
}

export async function suggest(args: SuggestArgs, signal?: AbortSignal): Promise<Suggestions> {
  try { return parseSuggestions(await complete({ messages: suggestMessages(args), max_tokens: 900, temperature: 0.5, signal })); }
  catch { return { message: "", pills: [] }; }
}

const DOC_CAN = `Figures: chart (bars, lines, waterfall, timeline, ranked, matrix; computed annotations: CAGR, difference, target), table, number, cards, steps, summary, pair (two charts side by side), image, team, logos, callout. Text: headings, bullets, quotes. Change figures with update_block by blockId and path; text with write_doc_text.`

export interface DocSuggestArgs { doc: Doc; history?: ChatMessage[] }

export function docSuggestMessages({ doc, history = [] }: DocSuggestArgs): ChatMessage[] {
  const convo = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${String(m.content).slice(0, 400)}`).join("\n");
  const figures = doc.blocks.flatMap((b) => (b.type === "figure" && b.kind !== "callout" ? [{ id: b.id, kind: b.kind, body: b.body }] : []));
  const codeHints = figures.flatMap(({ id, kind, body }) => {
    const fake = { type: "figure" as const, kind, id, body };
    const s = asSlide(fake);
    return s ? softChecks({ ...s, title: body.caption ?? "" }).map((x) => `${id}: ${x.msg}`) : [];
  });
  return [
    { role: "system", content: `You help someone build a consulting doc. Read the doc and the conversation, then suggest 3 or 4 next changes. Be specific (name blockIds and figures). When code suggestions mention chart annotations, include at least one pill that asks for that annotation on the named figure. Reply with JSON only: {"message": "…", "suggestions": [{"label": "short button text, max 48 characters", "prompt": "the request to send to the doc agent"}]}` },
    { role: "user", content: `Doc title: ${doc.title}\nFigures: ${JSON.stringify(figures)}\n\nConversation:\n${convo || "(none)"}\n\nCode suggestions (prefer one as a pill when present): ${codeHints.join("; ") || "none"}\n\nWhat you can do: ${DOC_CAN}` },
  ];
}

export async function suggestDoc(args: DocSuggestArgs, signal?: AbortSignal): Promise<Suggestions> {
  try { return parseSuggestions(await complete({ messages: docSuggestMessages(args), max_tokens: 900, temperature: 0.5, signal })); }
  catch { return { message: "", pills: [] }; }
}
