/* Prompt pieces shared by the agent and Jev (spec 9.3): the style block, worked examples, the picking guide. */
import { MENU, OFFERED, PICKING_GUIDE, STYLES } from "../slides/schema";
import { STARTERS, starterSlide } from "../starters";
import type { Slide, Style, TemplateId } from "../types";

/* A new slide starts plain (agent prompt, "Start plain"), so the example shows the plain version: the model
   copies the shape it is shown. The extras stay in the starters. */
const EXTRAS = ["takeaway", "notes", "kicker", "footnote", "source"] as const;
const plainExample = (s: Slide): Slide => {
  const out = structuredClone(s);
  EXTRAS.forEach((k) => delete out[k]);
  if (out.chart) delete out.chart.annotations;
  return out;
};

/** The worked example for a template and style, plain; for cards, the one with the same lead. */
export function exampleFor(id: TemplateId, style: Style, lead?: string | null): string {
  const pool = STARTERS.filter((s) => s.consulting.template === id).map((s) => plainExample(starterSlide(s, style)));
  const match = pool.find((s) => MENU[id].variant(s) === lead) || pool[0];
  return match ? JSON.stringify(match, null, 1) : "(none)";
}

export const styleBlock = (style: Style): string => `Deck style: ${style}. ${STYLES[style].summary}\n${STYLES[style].rules.map((r) => `- ${r}`).join("\n")}`;

export const STYLE_STATE: Record<Style, string> = {
  consulting: "consulting (McKinsey-style: dense evidence, full-sentence action titles)",
  pitch: "pitch (VC pitch deck: minimal text, one-line topic title, big numbers, one idea per slide)",
};

export const GUIDE = `Answer in order and stop at the first match:\n${PICKING_GUIDE.map(([q, id], i) => `${i + 1}. If the content is ${q}: ${id}`).join("\n")}\nCover or section only when the user asks for a title, cover, opening or divider slide; otherwise route the content itself, even into an empty deck.\nChart or table? Chart for a trend, a comparison of sizes or a crossover; table when the reader needs exact values. When in doubt, pick the entry with fewer words.`;

export const MENU_OPTIONS = Object.fromEntries(OFFERED.map((id) => [id, `${MENU[id].summary} Use when: ${MENU[id].use}`]));

