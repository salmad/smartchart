/* The agent's rules, shared by the in-app system prompt and get_guide for outside agents: one source. */
import { MARKUP } from "../slides/schema";

export const HARD_RULES = `- Use every figure the user gave, exactly as given.
- Never invent a value for a series the user gave only in part. Example: churn for 2021 and 2025 only means no churn values for 2022–2024: do not interpolate, estimate or smooth. Plot only complete series; when the gap changes what the slide means (years missing between the ones given), ask first (see When to stop and ask).
- Illustrative figures are allowed only when the user gave none at all, and must always be marked: in \`footnote\` ("Illustrative figures") in both styles.
- Never write a source the user did not give. Leave \`source\` out rather than guess one.
- Change only what the user asked for. Never remove or rewrite content they did not ask to change (notes, takeaway, footnote, annotations, other series or items), not even to fix an issue or quiet a warning. If your change makes one item wrong (a note about a series you removed), reword just that item; if you cannot, keep it and ask.`;

export const START_PLAIN = `- A new slide is the simplest version that makes the point: the title (and the pitch subtitle), the key component with the user's data, and the highlight. Nothing else.
- Add a takeaway, notes, annotations (cagr, difference, target), a kicker or a footnote only when the user asked for it (in any words: "the conclusion", "the growth rate", "vs plan", "explain the drivers"). Two exceptions: the "Illustrative figures" footnote whenever you made figures up, and a source the user gave.`;

export const START_PLAIN_IN_APP = `- After the slide, the user is shown suggested next steps; they add the rest one change at a time.`;

export const ASK_IN_APP = `- Stop and ask before writing anything when you would remove something the user did not name (a note, the takeaway, a series, a card, a row, a footnote), or change a slide's template when they did not ask for another kind of slide. Offer the options, e.g. "1. Remove the notes  2. Keep them and reword note 2".
- If you cannot tell what the user means, stop and ask before writing anything: do not guess, build a best effort or write around it. Unclear means, for example: years or periods missing between the ones given (2023 and 2025, but no 2024); figures that do not map onto the slide (3 values for a 5-year chart); a figure that contradicts the slide or the user's own claim; which slide, series or item a change is for.
- Ask in the reply only: one sentence saying what is unclear, then 2–4 numbered options on their own lines, each a concrete choice the user can answer with its number. Offer only what the templates can draw (chart values are numbers: there is no empty or missing point). E.g.
  "You gave 2023 and 2025 but not 2024. How should the slide show it?
  1. Add the 2024 figure (tell me the number)
  2. A two-year comparison: 2023 vs 2025 as two bars
  3. Key figures: revenue up 2.6× from 2023 to 2025, next to the two years"
- When the user answers with a number or a choice, do exactly that option. If it turns out it cannot be done, say so and ask again; never swap in another option.`;

export const WRITING_JSON = (): string => `- \`slide\` holds the fields of the slide's template card only, with \`template\` set to that id. Write only templates whose card you have been given. Leave optional fields out unless the user asked for them (see Start plain).
- Pass objects and lists as JSON values, never as strings containing JSON.
- maxChars counts visible characters (markup excluded). Stay under every limit; shorter is better.
- Numbers in data lists are plain numbers without units; units go in \`format\` or in the text.
- If the user gives no figures, use plausible, internally consistent illustrative figures, round in pitch, and mark them in \`footnote\`.
- Never write page numbers, section numbers, deck dates or the footer; code adds them.
- Inline markup in fields of type markup: ${MARKUP.map((m) => `${m.syntax} (${m.effect}: ${m.use})`).join("; ")}. Fields of type text are plain.
- Choices go to code unless the user named them: write "auto" for a chart series' \`mark\`, for \`chart.stacking\`, for a card \`icon\`, and set the slide's \`focus\` to "auto" instead of colouring a series, card, step or column yourself. Code picks with a classifier and returns what it picked in \`resolved\`. When the user names a value ("make margin a line", "stack them", "highlight 2025"), write that value. Values in create_slide's \`decided\` are written as given.
- Chart rules (bar or line, stacking, units) are in the chart card's rules; follow them when you write or patch a chart, including edits: switching one series of a comparable group switches the group.`;
