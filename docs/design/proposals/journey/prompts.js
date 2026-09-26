/* Prompt layers (spec 9.3): fixed system prompt, style rules, ONE template card with one good example, task. */
import { MARKUP, MENU, PICKING_GUIDE, STYLES, catalogue, describe } from "../v5/schema.js";
import { EXAMPLES } from "../v5/examples.js";

const specFor = (ex, style) => { const { consulting, pitch, name, ...shared } = ex; return { ...shared, ...(style === "pitch" ? pitch : consulting) }; };

/** The worked example for a template and style; for cards, the one with the same lead. */
export function exampleFor(id, style, lead) {
  const pool = EXAMPLES.filter((e) => e.template === id).map((e) => specFor(e, style));
  const match = pool.find((s) => MENU[id].variant(s) === lead) || pool[0];
  return match ? JSON.stringify(match, null, 1) : "(none)";
}

const SYSTEM = [
  "You fill slide templates for SmartChart, a presentation tool. You never design: layout, colours and sizes are fixed by code.",
  "You receive ONE template card and write its fields as ONE JSON object: { \"template\": \"<id>\", ...fields }.",
  "Rules:",
  "- Use only the fields listed in the card. Leave optional fields out unless they add something.",
  "- maxChars counts visible characters (markup excluded). Stay under every limit; shorter is better.",
  "- Numbers in data lists are plain numbers without units; units go in `format` or in the text.",
  "- If the request gives no figures, use plausible, internally consistent illustrative figures and mark them as illustrative in `footnote` (consulting) or keep them round (pitch).",
  "- Never write page numbers, section numbers, dates of the deck or the footer; code adds them.",
  `- Inline markup in fields of type markup: ${MARKUP.map((m) => `${m.syntax} (${m.effect}: ${m.use})`).join("; ")}. Fields of type text are plain.`,
  "- Reply with the JSON object only.",
].join("\n");

export const styleBlock = (style) => `Deck style: ${style}. ${STYLES[style].summary}\n${STYLES[style].rules.map((r) => `- ${r}`).join("\n")}`;

export const STYLE_STATE = {
  consulting: "consulting (McKinsey-style: dense evidence, full-sentence action titles)",
  pitch: "pitch (VC pitch deck: minimal text, one-line topic title, big numbers, one idea per slide)",
};

export const GUIDE = `Answer in order and stop at the first match:\n${PICKING_GUIDE.map(([q, id], i) => `${i + 1}. If the content is ${q}: ${id}`).join("\n")}\nCover or section only when the user asks for a title, cover, opening or divider slide; otherwise route the content itself, even into an empty deck.\nChart or table? Chart for a trend, a comparison of sizes or a crossover; table when the reader needs exact values. When in doubt, pick the entry with fewer words.`;

export const MENU_OPTIONS = Object.fromEntries(Object.entries(MENU).map(([id, t]) => [id, `${t.summary} Use when: ${t.use}`]));

/** Context line about the deck around this slide. */
export function deckState(deck, index) {
  const titles = deck.slides.map((s, i) => `${i + 1}. [${s.template}] ${s.title?.replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "") ?? ""}`);
  return titles.length ? `Slides already in the deck:\n${titles.join("\n")}${index != null ? `\nThis slide goes at position ${index + 1}.` : ""}` : "The deck is empty.";
}

export function fillPrompt({ id, style, request, deck, index, fixed, previous }) {
  const card = describe(id, style), lead = fixed["cards.lead"];
  const system = [SYSTEM, "", styleBlock(style), "", `Template card:\n${JSON.stringify(card, null, 1)}`,
    "", `A good example of this template in ${style} style (a different topic; copy the quality, not the content):\n${exampleFor(id, style, lead)}`].join("\n");
  const fixedLines = Object.entries(fixed).map(([k, v]) => `- ${k} = ${v}`);
  const user = [
    `Request: ${request}`,
    deckState(deck, index),
    previous ? `Rebuild this existing slide as a ${id} slide. Keep its message and figures:\n${JSON.stringify(previous)}` : "",
    fixedLines.length ? `Already decided (follow exactly):\n${fixedLines.join("\n")}` : "",
    `Write the ${id} slide as JSON.`,
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

export function repairPrompt({ slide, style, errors, round }) {
  const system = [SYSTEM, "", styleBlock(style), "", `Template card:\n${JSON.stringify(describe(slide.template, style), null, 1)}`].join("\n");
  const user = [
    `This ${slide.template} slide fails checks:\n${JSON.stringify(slide, null, 1)}`,
    `Fix ONLY these problems:\n${errors.map((e) => `- ${e}`).join("\n")}`,
    round > 1 ? "This is the second attempt. Cut harder: aim for about 80% of each limit." : "",
    "Reply with a JSON patch: { \"set\": { \"<top-level field>\": <new value> } }. Include only the fields you change; each value replaces that whole field.",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

export function editPrompt({ slide, style, request, deck, index }) {
  const system = [SYSTEM, "", styleBlock(style), "", `Template card:\n${JSON.stringify(describe(slide.template, style), null, 1)}`].join("\n");
  const user = [
    deckState(deck, index),
    `Current slide ${index + 1}:\n${JSON.stringify(slide, null, 1)}`,
    `Edit request: ${request}`,
    "Change only what the request asks for. Reply with a JSON patch: { \"set\": { \"<top-level field>\": <new value> } }; each value replaces that whole field. Use null to remove an optional field.",
  ].join("\n\n");
  return { system, user };
}

export function pickPrompt({ request, style, candidates }) {
  return {
    system: `You pick the slide template for a request. Reply with JSON { "template": "<id>" }.\nTemplates:\n${catalogue()}\n\n${GUIDE}`,
    user: `Deck style: ${STYLE_STATE[style]}.\nRequest: ${request}\nThe most likely candidates are: ${candidates.join(", ")}.`,
  };
}
