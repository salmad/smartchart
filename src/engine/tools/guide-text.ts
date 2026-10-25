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

/** get_guide with style "doc": how to write a doc, from the doc format's own words. */
export function docGuideText(): string {
  return [`# What a doc is
A doc is a title, an optional subtitle, and blocks in order: headings (\`##\` sections and \`###\` subsections), paragraphs, lists, quotes, dividers, code, and figures. A figure is one of Occam's components (chart, table, number, cards, steps, summary, pair, image, team, logos) or a callout, with a caption, notes, a source and a takeaway. Occam draws the page: the contents on the side, sections that fold, figures on a canvas. You write content; palette and accent are the user's Look settings, not fields you set on the doc.`,
  `# How to write
- Start with create_doc (or get_doc for an existing one) and give the user links.edit so they can watch. get_template with style "doc" gives a figure's card and an example; read it once per kind before writing one.
- Add text with create_block { after, markdown }; add a figure with create_block { after, figure: { kind, body } }. After a block's blockId, "start" or "end". Change a text block with write_doc_text and a figure with update_block at exact paths ({ "chart.series[0].values[3]": 42 }); null removes an item. Move and delete by blockId.
- Every write returns blocks again. A text block's id is made from its words, so it changes when they do: use the ids from the last result, and read the doc again if a call says a block is not there.
- Headings and figures keep their ids. A heading's id comes from its words when it is first written; link to it with [the plan](#plan).
- Markdown here is small: \`## \` heading, \`### \` subheading, \`- \` bullets, \`1. \` numbers, \`> \` quote, \`---\` divider, **bold**, [[focus]], [links](https://…) and [section links](#id). Indent a list item two spaces to put it under the item above (three levels at most). A line that begins with one of those marks but is plain text starts with a backslash.
- Pages nest: pass \`parent\` to create_doc to start a doc under another page (a doc or a deck), and move_page to move one; keep a deck's supporting docs under the deck.
- Write sections as short, argued paragraphs; put evidence in figures. One idea per section. Open each section with its answer.`,
  `# Figures
- Give every figure a caption that says what it shows, and a source in \`source\` (or a \`footnote\`) when it shows figures. Link the source: \`[FCA report](https://…)\`.
- A chart, table or number figure carries the user's figures exactly as given. Never invent a figure or a source; leave \`source\` out and tell the user instead.
- One element stands out per figure (a focus series, card, step, column or row). Bars sorted largest first unless the order means something; time runs oldest to newest. Units in \`format\`; at most two units on one chart.
- A table may run to 20 rows. Has/lacks and degree judgements (Yes, No, Partly) read faster as marks (✓ ✗ or Harvey balls) than as words.
- A callout is \`{ tone: "note" | "decision" | "risk", text }\`: one or two sentences, for what a reader must not miss.
- Pictures (image, team, logos) need a src from add_image, and docs cannot take uploads yet: leave them out and say so.`,
  `# When to stop and ask
${ASK_OUTSIDE}`,
  `# Checks
- check_doc judges the figures and the structure: a figure with no caption, an empty section, units, sources, one focus, sorted bars, figures a caption claims that the data does not show. It reports; it never changes the doc. Fix what a small edit fixes and tell the user about the rest.
- A write that breaks the schema is refused with the path and the fix, and changes nothing: correct it and write again.
- Someone may be editing by hand: a result with a notice says so. Your change is saved; their next Save will be refused until they reload.`].join("\n\n");
}
