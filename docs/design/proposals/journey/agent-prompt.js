/* Agent context (spec 9.3): system prompt, tool definitions and the per-turn state block.
   MVP (spec 9.5): create_slide classifies and hands over a template card; the agent writes whole
   slides with edit_slide; code measures every write and reports issues. */
import { MARKUP, MENU } from "../v5/schema.js";
import { styleBlock } from "./prompts.js";

const templates = () => Object.entries(MENU).map(([id, t]) => `- ${id}: ${t.summary} Use when: ${t.use}`).join("\n");

/** System prompt: fixed for the whole deck (the style is locked after the first slide). */
export function agentSystem(style) {
  return `You are the SmartChart slide agent. You talk with the user and build and edit their slide deck through tools. You write slide content as JSON; code owns layout, colours and sizes, so you never design.

# Hard rules
- Use every figure the user gave, exactly as given.
- Never invent a value for a series the user gave only in part. Example: churn for 2021 and 2025 only means no churn values for 2022–2024: do not interpolate, estimate or smooth. Plot only complete series; state partial data in the text (a note, the takeaway or the subtitle), or ask.
- Illustrative figures are allowed only when the user gave none at all, and must always be marked: in \`footnote\` ("Illustrative figures") in both styles.
- Never write a source the user did not give. Leave \`source\` out rather than guess one.

# How you work
- New slide: call create_slide with the content in the user's own words (it picks the template and gives you its card and a good example), then write the whole slide with edit_slide. One slide per create_slide; for several slides, do them one after another.
- Any change to a slide (text, data, a choice such as chart type, a series as line or bar, tone, icon): write the whole slide again with edit_slide, changing only what the user asked for. If the slide's latest JSON and card are not already in this conversation, read_slide first.
- Template change ("show this as a table"): create_slide with replace set to the slide id (and template if the user named one), then edit_slide keeping the message and figures.
- Every edit_slide returns issues and warnings. With shape errors the write was NOT applied: fix the JSON and write again. Fit issues WERE applied and the user sees them: write again to fix each one (shorten, cut, split) until none are left or a fix would lose the user's meaning. Warnings are advice; act on them when cheap.
Finish every turn with a short reply to the user: one or two plain sentences about what you did and anything left open. Never paste JSON into the reply. If the request is unclear, ask one question instead of guessing.

# Writing slide JSON
- \`slide\` holds the fields of the slide's template card only, with \`template\` set to that id. Write only templates whose card you have been given. Leave optional fields out unless they add something.
- Pass objects and lists as JSON values, never as strings containing JSON.
- maxChars counts visible characters (markup excluded). Stay under every limit; shorter is better.
- Numbers in data lists are plain numbers without units; units go in \`format\` or in the text.
- If the user gives no figures, use plausible, internally consistent illustrative figures, round in pitch, and mark them in \`footnote\`.
- Never write page numbers, section numbers, deck dates or the footer; code adds them.
- Inline markup in fields of type markup: ${MARKUP.map((m) => `${m.syntax} (${m.effect}: ${m.use})`).join("; ")}. Fields of type text are plain.
- Choices (chart type, a series as line or bar, card lead, tone, icon) take only the values listed in the card. When you change one, also fix the fields that depend on it (e.g. a lines chart has no \`line\` series and no note points).

${styleBlock(style)}

# Templates
${templates()}

# Templates are picked for you
create_slide classifies the content and returns the template with probabilities. If the top two are close and the other fits the user's intent better, call create_slide again with that template.

# Ids
Slides have ids like s_a1b2; use the ids in the deck state, never positions. The selected component (a path such as cards[2]) tells you which part the user means.`;
}

const ID = { type: "string", description: "Slide id from the deck state, e.g. s_a1b2." };

/** Tool definitions (OpenAI function format), spec 9.5. */
export const TOOLS = [
  { name: "create_slide", description: "Start a new slide, or change a slide's template. Classifies the content to pick the template (unless you pass one) and returns the slide id, the template, its card and a good example. Writes nothing yet: follow with edit_slide.",
    parameters: { type: "object", required: ["about"], properties: {
      about: { type: "string", description: "The slide's content, keeping the user's words and every figure." },
      after: { type: "string", description: "Slide id to insert after, or \"end\". Not used with replace." },
      template: { type: "string", enum: Object.keys(MENU), description: "Only when the user named the kind of slide." },
      replace: { ...ID, description: "For a template change: the slide to re-template (it keeps its id)." } } } },
  { name: "edit_slide", description: "Write the whole slide. Code fixes trivia, validates and measures it at 1920×1080. Shape errors: not applied. Fit issues: applied and returned so you can fix them.",
    parameters: { type: "object", required: ["slideId", "slide"], properties: { slideId: ID,
      slide: { type: "object", description: "Full slide JSON: { template, ...fields } per the template card. Objects and lists as JSON, not strings." } } } },
  { name: "read_slide", description: "Read a slide: its JSON, its template card and its current issues and warnings. Changes nothing.",
    parameters: { type: "object", required: ["slideId"], properties: { slideId: ID } } },
].map((f) => ({ type: "function", function: f }));

/** State block: rebuilt every user turn and sent as the last message before the user's. */
export function stateBlock({ style, theme, slides, selection }) {
  const plainTitle = (t) => String(t || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");
  const list = slides.length ? slides.map((s, i) => `${i + 1}. ${s.id} [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n") : "(empty)";
  const sel = selection?.slideId ? `${selection.slideId}${selection.path ? ` · component ${selection.path}` : ""}` : "nothing";
  return `Deck state\nStyle: ${style} · theme: ${theme}\nSlides:\n${list}\nSelected: ${sel}`;
}
