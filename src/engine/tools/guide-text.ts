/* get_guide: the rules an outside agent needs before it writes a slide, from the same sections as the in-app prompt. */
import { HARD_RULES, START_PLAIN, WRITING_JSON } from "../agent/prompt-sections.js";
import { styleBlock } from "../agent/prompts.js";
import { COMMENTS_RULE } from "../comments.js";
import type { Style } from "../types.js";

const ASK_OUTSIDE = `- Ask your user before writing when you would remove something they did not name (a note, the takeaway, a series, a card, a row, a footnote) or change a slide's template they did not ask to change.
- Ask when you cannot tell what they mean: no figures given for a slide that needs them (ask for them, or whether to use published sources), periods missing between the ones given, figures that do not map onto the slide, a figure that contradicts the slide, or which slide, series or item a change is for.
- Ask with one sentence on what is unclear, then 2–4 numbered options, each a concrete choice the templates can draw. When they answer, do exactly that option.`;

const START_PLAIN_OUTSIDE = `- Reviewing or improving slides: do suggest extras (notes, a takeaway, an annotation) and why; write them once the user agrees.`;

const TOOLS_OUTSIDE = `- New slide: create_slide with the whole slide JSON for its template (get_template gives the card and an example). Existing slide: update_slide with only the paths that change, e.g. { "cards[1].title": "…", "chart.series[0].values[3]": 42 }. null removes an item; the next index appends; reorder by setting the whole list. Indexes start at 0.
- Every write returns issues (fix them with the smallest edit, never by deleting content), warnings (advice), checks (rule checks that failed) and resolved (the "auto" values code picked). A write with wrong shapes is refused with the path and the fix: correct it and write again. next says what to do after the write (fix, judge with check_slide, read the storyline); follow it unless the user wants otherwise.
- Pass request: the user's own words, on every write. Code uses it for "auto" choices.
- Before a meeting, offer to rehearse: read the deck as the room would (a board, investors), ask the hardest question per slide, and with the user's agreement put the answers in each slide's talk field (speaker notes, never drawn; the presenter view shows them). A question the deck cannot answer is a backup slide to suggest, with figures the user gives.
- Sources: name the source in words and link it, \`[FCA report](https://…)\` in \`source\` or \`footnote\`. It shows as the words with a small arrow and opens the page on a click. Never paste a bare address, and link only a page you know exists.
- Pictures (a product screenshot, team photos, logos): add_image with a public link to the picture itself (or its bytes) and the right kind, or for a company's logo its domain ("stripe.com"), then put the { src } it returns where the card says. A logo found from a domain: tell the user where it was found so they can check it. Use pictures the user gave, or asked you to find (a company's logo from its own site or press kit); never a stock photo nobody asked for. If a picture cannot be added, tell the user why and ask for another; do not drop it silently.`;

export function guideText(style: Style): string {
  return [`# Hard rules\n${HARD_RULES}`, `# How to write\n${TOOLS_OUTSIDE}`, `# Start plain\n${START_PLAIN}\n${START_PLAIN_OUTSIDE}`,
    `# When to stop and ask\n${ASK_OUTSIDE}`, `# Comments\n- ${COMMENTS_RULE}`, `# Writing slide JSON\n${WRITING_JSON()}`, `# Style\n${styleBlock(style)}`].join("\n\n");
}
