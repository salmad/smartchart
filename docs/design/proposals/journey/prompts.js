/* Prompt pieces shared by the agent and Jev (spec 9.3): the style block, worked examples, the picking guide. */
import { MENU, PICKING_GUIDE, STYLES } from "../v5/schema.js";
import { EXAMPLES } from "../v5/examples.js";

const specFor = (ex, style) => { const { consulting, pitch, name, ...shared } = ex; return { ...shared, ...(style === "pitch" ? pitch : consulting) }; };

/** The worked example for a template and style; for cards, the one with the same lead. */
export function exampleFor(id, style, lead) {
  const pool = EXAMPLES.filter((e) => e.template === id).map((e) => specFor(e, style));
  const match = pool.find((s) => MENU[id].variant(s) === lead) || pool[0];
  return match ? JSON.stringify(match, null, 1) : "(none)";
}

export const styleBlock = (style) => `Deck style: ${style}. ${STYLES[style].summary}\n${STYLES[style].rules.map((r) => `- ${r}`).join("\n")}`;

export const STYLE_STATE = {
  consulting: "consulting (McKinsey-style: dense evidence, full-sentence action titles)",
  pitch: "pitch (VC pitch deck: minimal text, one-line topic title, big numbers, one idea per slide)",
};

export const GUIDE = `Answer in order and stop at the first match:\n${PICKING_GUIDE.map(([q, id], i) => `${i + 1}. If the content is ${q}: ${id}`).join("\n")}\nCover or section only when the user asks for a title, cover, opening or divider slide; otherwise route the content itself, even into an empty deck.\nChart or table? Chart for a trend, a comparison of sizes or a crossover; table when the reader needs exact values. When in doubt, pick the entry with fewer words.`;

export const MENU_OPTIONS = Object.fromEntries(Object.entries(MENU).map(([id, t]) => [id, `${t.summary} Use when: ${t.use}`]));

