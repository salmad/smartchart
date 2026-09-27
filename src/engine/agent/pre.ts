/* PRE (spec 9.0): one Jev call before the agent runs: intent, template, card lead, position.
   When the intent is sure, code makes the agent's first tool call itself. */
import { GUIDE, MENU_OPTIONS, STYLE_STATE } from "./prompts";
import type { JevFn, JevQuestion } from "./llm";
import type { Slide, Style } from "../types";

/** What PRE reads of the deck: the slides in order (a pending slide has no content yet). */
export interface PreDeck { style: Style; slides: { id: string; slide: Slide | null }[] }
/** The user's selection: a slide, and optionally a component on it (a path such as cards[2]). */
export type Selection = { slideId?: string; path?: string } | null | undefined;
export interface Pre { intent: string; p: number; template: string; probabilities: Record<string, number>; lead: string | null; after: string; ms: number }
/** What isSure and firstCall read of a PRE result. */
export type PreChoice = Pick<Pre, "intent" | "p" | "template" | "after">;
export interface FirstCall { name: "create_slide" | "read_slide"; args: Record<string, string> }

export const P_ACT = 0.7, P_LEAD = 0.6;
const plainTitle = (s: unknown) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");

const INTENTS: Record<string, string> = {
  new_slide: "Add one new slide with this content.",
  edit_selected: "Change something on the selected slide: wording, numbers, a series, a choice such as bar or line, a card, the focus.",
  change_template: "Show the selected slide as another kind of slide (as a table, as a chart, as cards).",
  several_slides: "Add or change several slides in one request.",
  ask: "Too unclear to act on: the agent must ask one question first.",
  other: "A question, a comment, thanks, or anything that does not change the deck.",
};
export const LEADS: Record<string, string> = {
  icon: "Each card leads with an icon.",
  value: "Each card leads with a big number.",
  framed: "Two framed cards contrasting a losing case and a winning case.",
};
export const LEAD_Q = "If the slide were cards, how should they lead? Value when every card has a number worth showing; framed for a two-way contrast (them vs us, before vs after); otherwise icon.";

export async function preStep({ text, deck, selection, jev }: { text: string; deck: PreDeck; selection: Selection; jev: JevFn }): Promise<Pre> {
  const slides = deck.slides.filter((s): s is { id: string; slide: Slide } => !!s.slide);
  const list = slides.map((s, i) => `${i + 1}. ${s.id} [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n");
  const state = [`Deck style: ${STYLE_STATE[deck.style]}.`, list ? `Slides:\n${list}` : "The deck is empty.",
    selection?.slideId ? `Selected slide: ${selection.slideId}.` : "No slide is selected.", `User message: ${text}`].join("\n");
  const qs: Record<string, JevQuestion> = {
    intent: { instructions: "What does the user want done with this message?", options: INTENTS },
    template: { instructions: `If this message asks for a new slide or another kind of slide, which template fits its content?\n${GUIDE}`, options: MENU_OPTIONS },
    lead: { instructions: LEAD_Q, options: LEADS },
  };
  if (slides.length) qs.after = { instructions: "If a new slide is added, after which slide should it go? The end, unless the message says where or clearly continues a particular slide.",
    options: { end: "At the end of the deck.", ...Object.fromEntries(slides.map((s) => [s.id, `After ${s.id}: ${plainTitle(s.slide.title)}`])) } };
  const r = await jev(state, qs);
  return { intent: r.intent.choice, p: r.intent.p, template: r.template.choice, probabilities: r.template.probabilities,
    lead: r.lead.p >= P_LEAD ? r.lead.choice : null, after: r.after?.choice || "end", ms: r._ms };
}

/** Sure enough for code to act: p ≥ P_ACT, or a new slide into an empty deck (nothing else can be meant). */
export const isSure = (pre: PreChoice, deck: PreDeck): boolean => pre.p >= P_ACT || (pre.intent === "new_slide" && !deck.slides.some((s) => s.slide));

export function firstCall(pre: PreChoice, selection: Selection, text: string, deck: PreDeck): FirstCall | null {
  if (!isSure(pre, deck)) return null;
  const id = selection?.slideId, current = deck.slides.find((s) => s.id === id)?.slide;
  if (pre.intent === "new_slide") return { name: "create_slide", args: { about: text, after: pre.after, template: pre.template } };
  if (pre.intent === "edit_selected" && current && id) return { name: "read_slide", args: { slideId: id } };
  if (pre.intent === "change_template" && current && id && pre.template !== current.template) return { name: "create_slide", args: { about: text, replace: id, template: pre.template } };
  return null;
}
