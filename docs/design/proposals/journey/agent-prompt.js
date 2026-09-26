/* Agent context (spec 9.3): system prompt, the four tools, the per-turn state block and the working-slides block. */
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
- New slide: create_slide with the content in the user's own words (it picks the template and gives you its card, a good example and any values already decided), then write the whole slide with edit_slide. One slide per create_slide.
- Any change to an existing slide: patch_slide with only the paths that change, e.g. { "set": { "cards[1].title": "…", "chart.series[0].values[3]": 42 } }. You never rewrite an existing slide whole; edit_slide refuses it. To remove an item set it to null; to add one, use the next index. Reordering: patch the whole list.
- Template change ("show this as a table"): create_slide with replace set to the slide id, then edit_slide with the full slide, keeping the message and figures.
- The "Working slides" message at the end of the conversation holds the CURRENT JSON of every slide you work on, with its open issues and failed checks. Always read slides from it, never from older copies earlier in the conversation. read_slide adds a slide to it.
- Every write returns issues and warnings. Shape errors: NOT applied; fix and write again. issues: applied and visible; patch again to fix each one. elsewhere (patch_slide): problems outside your patch, often caused by it (a longer title now on 3 lines, a note pointing at a removed category); patch them too when your change caused them. Warnings are advice; act on them when cheap.
- Put your reply to the user in the write's \`reply\` when that write should finish the request. If the write comes back clean the turn ends there; otherwise fix the issues and reply after.
Finish every turn with a short reply: one or two plain sentences about what you did and anything left open. Never paste JSON into the reply. If the request is unclear, ask one question instead of guessing.

# Writing slide JSON
- \`slide\` holds the fields of the slide's template card only, with \`template\` set to that id. Write only templates whose card you have been given. Leave optional fields out unless they add something.
- Pass objects and lists as JSON values, never as strings containing JSON.
- maxChars counts visible characters (markup excluded). Stay under every limit; shorter is better.
- Numbers in data lists are plain numbers without units; units go in \`format\` or in the text.
- If the user gives no figures, use plausible, internally consistent illustrative figures, round in pitch, and mark them in \`footnote\`.
- Never write page numbers, section numbers, deck dates or the footer; code adds them.
- Inline markup in fields of type markup: ${MARKUP.map((m) => `${m.syntax} (${m.effect}: ${m.use})`).join("; ")}. Fields of type text are plain.
- Choices go to code unless the user named them: write "auto" for a chart series' \`mark\`, for \`chart.stacked\`, for a card \`icon\`, and set the slide's \`focus\` to "auto" instead of colouring a series, card, step or column yourself. Code picks with a classifier and returns what it picked in \`resolved\`. When the user names a value ("make margin a line", "stack them", "highlight 2025"), write that value. Values in create_slide's \`decided\` are written as given.
- Chart rules (bar or line, stacking, units) are in the chart card's rules; follow them when you write or patch a chart, including edits: switching one series of a comparable group switches the group.

${styleBlock(style)}

# Templates
${templates()}

# Templates are picked for you
create_slide classifies the content and returns the template with probabilities. If the top two are close and the other fits the user's intent better, call create_slide again with that template.

# Ids
Slides have ids like s_a1b2; use the ids in the deck state, never positions. The selected component (a path such as cards[2]) tells you which part the user means.`;
}

const ID = { type: "string", description: "Slide id from the deck state, e.g. s_a1b2." };
const REPLY = { type: "string", description: "Your reply to the user, when this write should finish the request. Used only if the write comes back with no issues." };

/** Tool definitions (OpenAI function format), spec 9.5. */
export const TOOLS = [
  { name: "create_slide", description: "Start a new slide, or change a slide's template. Picks the template (unless you pass one) and returns the slide id, the template, its card, a good example and any values already decided. Writes nothing yet: follow with edit_slide.",
    parameters: { type: "object", required: ["about"], properties: {
      about: { type: "string", description: "The slide's content, keeping the user's words and every figure." },
      after: { type: "string", description: "Slide id to insert after, or \"end\". Not used with replace." },
      template: { type: "string", enum: Object.keys(MENU), description: "Only when the user named the kind of slide." },
      replace: { ...ID, description: "For a template change: the slide to re-template (it keeps its id)." } } } },
  { name: "edit_slide", description: "Write a WHOLE slide, only right after create_slide reserved it (a new slide or a template change). Existing slides change with patch_slide. Code fixes trivia, resolves \"auto\" choices, validates and measures it at 1920×1080.",
    parameters: { type: "object", required: ["slideId", "slide"], properties: { slideId: ID,
      slide: { type: "object", description: "Full slide JSON: { template, ...fields } per the template card. Objects and lists as JSON, not strings." }, reply: REPLY } } },
  { name: "patch_slide", description: "Change an existing slide at exact paths; everything else stays as it is. All or nothing: a bad path or a shape error applies nothing. The whole slide is re-checked after the patch.",
    parameters: { type: "object", required: ["slideId", "set"], properties: { slideId: ID,
      set: { type: "object", description: "{ path: new value }. Paths follow the slide JSON: title, chart.series[1].values, cards[2].title, notes[0]. null removes a field or item; the next index appends.", additionalProperties: true },
      reply: REPLY } } },
  { name: "read_slide", description: "Add a slide to the Working slides message (its current JSON and issues) and get its template card. Changes nothing.",
    parameters: { type: "object", required: ["slideId"], properties: { slideId: ID } } },
].map((f) => ({ type: "function", function: f }));

/** State block: rebuilt every user turn and sent as the last message before the user's. */
export function stateBlock({ style, theme, slides, selection }) {
  const plainTitle = (t) => String(t || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");
  const list = slides.length ? slides.map((s, i) => `${i + 1}. ${s.id} [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n") : "(empty)";
  const sel = selection?.slideId ? `${selection.slideId}${selection.path ? ` · component ${selection.path}` : ""}` : "nothing";
  return `Deck state\nStyle: ${style} · theme: ${theme}\nSlides:\n${list}\nSelected: ${sel}`;
}

/** Working slides (spec 9.3): rebuilt before every model step, sent last, never stored in the history. */
export function workingBlock(items) {
  if (!items.length) return "Working slides (current JSON)\n(none yet)";
  return `Working slides (current JSON; this replaces any earlier copy in the conversation)\n\n${items.map((it) => {
    const failed = (it.checks || []).filter((c) => !c.ok && c.id.startsWith("J")).map((c) => `${c.id}: ${c.msg}`);
    return [`${it.id} [${it.slide.template}]`, JSON.stringify(it.slide),
      `Open issues: ${it.issues?.length ? it.issues.join(" | ") : "none"}`,
      it.warnings?.length ? `Warnings: ${it.warnings.join(" | ")}` : "",
      failed.length ? `Judgment checks failed: ${failed.join(" | ")}` : ""].filter(Boolean).join("\n");
  }).join("\n\n")}`;
}
