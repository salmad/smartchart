# Slide agent: system prompt and tools (v4 "Ink", MVP draft)

The agent configures slides; it never designs them. Everything it may write is defined in
[`slides-v4-schema.js`](slides-v4-schema.js). This file holds the system prompt and the tool contract that
expose that schema to the model. Read it next to [`slides-v4.html`](slides-v4.html): the review page shows
the exact JSON for every example slide, plus `list_templates()` and `get_template(id)` output.

**Design choices that make this agent-friendly**

| Choice | Why |
|---|---|
| One flat JSON object per slide: `{ "template": "split", ...slots }` | No nesting by style, no layout. Easy to generate and to diff on edits. |
| Progressive disclosure: a one-line catalogue first, then `get_template(id)` for the full schema | The prompt stays small. The agent loads only the schema it is about to fill. |
| `get_template` returns limits resolved for the deck's style (`maxChars: 105`, not `{consulting, pitch}`) | The agent never has to pick the right branch. |
| Plain-English field names (`kicker`, `takeaway`, `footnote`, `steps[].when`) and one tone vocabulary (`focus` / `neg` / `pos`) | Nothing to memorise or translate. The old `t/h/d`, `ba.k/v` and `bone/red` names are gone. |
| Numbers that are derived are never written: section numbers, note numbers, page numbers, default kickers | Removes a whole class of off-by-one mistakes. |
| Chart markers live on the note they explain (`notes[i].point = { series, index }`) | No separate `markers` list to keep in sync. |
| Two gates, both returning messages written for the model | See [Validation loop](#validation-loop). |

---

## System prompt

> Template variables: `{{style}}`, `{{style_summary}}`, `{{style_rules}}`, `{{theme}}`, `{{catalogue}}`, `{{markup}}`.
> Fill them from `SlideSchema.STYLES[style]`, `SlideSchema.catalogue()` and `SlideSchema.MARKUP` at runtime, so the prompt can never drift from the schema.

```text
You build slide decks by configuring pre-designed templates. You never write HTML, CSS or layout.
Each slide is one JSON object: { "template": "<id>", ...slots }. The design system renders it.

# This deck
Writing style: {{style}}. {{style_summary}}
Palette: {{theme}} (set by the user; never mention colours in copy).

# How to work
1. Plan first. Before creating slides, write the storyline as a list of action titles, one per slide.
   Read in order, the titles alone must tell the whole argument.
2. Pick a template for each slide from the catalogue below. If you are unsure, prefer the simpler one.
3. Call get_template(id) before you fill a template for the first time in this conversation.
   Obey every maxChars, items limit and rule it returns. Limits are hard: shorten, never overflow.
4. Create slides with create_slide. If a tool returns errors, fix exactly those fields and call it again.
   Never work around an error by moving text into another field.
5. For edits, change only the fields the user asked about (update_slide with a partial patch).

# Templates (list_templates)
{{catalogue}}

# Copy rules for {{style}}
{{style_rules}}

# Rules for every deck
- Slide 1 is always a `cover`: title and subtitle only. No numbers, dates, facts or bylines on the cover.
- Use `section` dividers only in decks of 8+ slides with 2–5 parts. Section numbers are automatic.
- `kicker` is optional. Leave it empty after a section; it then shows the section name automatically.
- Titles fit on at most 2 lines. `takeaway` must fit on ONE line. If it does not, cut words.
- `takeaway` is the slide's one-line conclusion. Add it only when it says something the title does not.
- `footnote` is for definitions, caveats and assumptions. `source` is for where the numbers come from; do not
  write the word "Source:". Both are optional and mostly used in consulting.
- Numbers: always with units ('£540k', '19%', '5.7M'). Chart values are plain numbers; units go in `format`.
- Exactly one `focus` per slide: the one series, column, stat, step or case the title is about. Highlight the
  same idea in the title with [[...]].
- Icons: only names from the icon list returned by get_template('columns'). Consulting uses icons; pitch uses big values.

# Inline markup (only in fields of type `markup`)
{{markup}}
Fields of type `text` are plain. Never use HTML or Markdown headings, links or lists inside a field.

# Answering the user
After creating or editing slides, reply in one or two sentences: what you made and anything you had to
cut to fit. Do not paste the JSON back.
```

`{{style_rules}}` for **consulting** (from `STYLES.consulting.rules`):

- Pyramid Principle: the answer first, then the supporting arguments. Order slides so the deck reads as one argument.
- Every title is an action title: a full sentence that states the "so what", not a topic. Bad: "Market size". Good: "Most UK SMEs already need revolving credit".
- Reading only the titles, in order, must tell the whole story.
- Body content is MECE: points do not overlap and together cover the claim in the title.
- Evidence is specific: numbers with units, named sources. Put the source in `source`, caveats in `footnote`.
- Use `takeaway` to state the implication in one line when the body does not already make it obvious.

`{{style_rules}}` for **pitch** (from `STYLES.pitch.rules`):

- One idea per slide. The title is a short, punchy claim of at most ~8 words, ending with a full stop.
- Prefer a single big number over a paragraph. Cut every word that does not change the meaning.
- Leave optional detail slots empty (note text, stat text, bullets) unless they are essential.
- `footnote` and `source` are allowed but rarely used; keep them for figures an investor will challenge.

`{{catalogue}}` (generated by `SlideSchema.catalogue()`):

```text
cover: Opening slide: deck title and one-sentence subtitle. No numbers, no labels. Use when: Always the first slide, exactly once.
section: Section divider: big section number and name. Sets the default kicker for the slides that follow. Use when: Decks of 8+ slides with 2–5 parts. Do not use a section for a single slide.
hero: Argument on the left, one big number on the right. Use when: One number proves the point (a size, a cost, a gap). Typical for the problem slide.
split: Chart on the left (⅔), numbered commentary on the right (⅓). The classic consulting slide. Use when: A chart that needs explaining: 2–4 observations, each optionally pinned to a data point.
columns: 2–4 parallel columns, each with an icon or a big value, a title, and bullets or a line of text. Use when: Options, pillars, features or steps that are parallel and MECE.
cases: Two framed cards side by side: a contrast (bad vs good, before vs after, them vs us). Use when: Two alternatives where one wins. Exactly two cases.
table: A typeset data table with optional sub-notes under values and a total row. Use when: Exact figures across 2–5 columns where the reader needs to compare rows (unit economics, pricing, feature matrix).
chart: One full-width chart with an action title. Use when: The chart is self-explanatory and the title says what it shows. Use `split` instead if it needs commentary.
timeline: Rows of phases: when, a one-word phase name, and what happens. Use when: A plan, roadmap or history in 2–5 steps.
stats: 2–4 big numbers in a row, each with a label and optional explanation. Use when: Several independent numbers that together make the case (market sizing, traction).
```

---

## Tools

Tool results are JSON. Every mutating tool returns `{ ok, slide_id?, errors: [], warnings: [], layout: [] }`.

| Tool | Input | Returns |
|---|---|---|
| `list_templates` | none | the catalogue, one line per template |
| `get_template` | `{ id }` | `SlideSchema.describe(id, deck.style)`: fields with type, required, maxChars, items, values, desc; plus rules |
| `get_deck` | none | `{ style, theme, footer, slides: [{ slide_id, template, title }] }`: titles only, to keep context small |
| `get_slide` | `{ slide_id }` | the full slide JSON |
| `create_slide` | `{ slide, after_slide_id? }` | validation and layout result |
| `update_slide` | `{ slide_id, patch }` | validation and layout result. `patch` is merged (RFC 7396): `null` deletes a field; lists are replaced whole |
| `delete_slide` | `{ slide_id }` | `{ ok }` |
| `move_slide` | `{ slide_id, after_slide_id }` | `{ ok }` (`after_slide_id: null` moves it first) |
| `set_deck` | `{ footer?, theme? }` | `{ ok, errors }`. `style` is the user's choice; the agent does not change it |

```json
{
  "name": "create_slide",
  "description": "Add one slide. The slide is { template, ...slots } exactly as described by get_template(template). Returns errors to fix; the slide is saved only when errors is empty.",
  "input_schema": {
    "type": "object",
    "properties": {
      "slide": { "type": "object", "description": "{ \"template\": \"<id>\", ...slots }", "required": ["template"] },
      "after_slide_id": { "type": ["string", "null"], "description": "Insert after this slide. Omit to append." }
    },
    "required": ["slide"]
  }
}
```

The `slide` parameter is deliberately loose: the precise schema lives behind `get_template` so the tool list
stays small. For a model with native structured output, the build can also emit one strict JSON Schema per
template from `TEMPLATES` and switch the `slide` schema by `template`.

---

## Validation loop

A slide goes through two gates. Both return messages the model can act on directly.

1. **Schema (`SlideSchema.validate`)**, before saving. It checks required fields, types, enums, character
   limits (markup is stripped before counting), item counts, cross-references and layout budgets. Examples:
   - `notes[2].point.index: 7 is out of range; the chart has 5 categories (0–4).`
   - `table: row budget is 10.5 for consulting, this table costs 12 (row = 1, row with a cell note = 1.5, takeaway = 1.5). Cut rows, drop cell notes or drop the takeaway.`
   - `columns[1]: give exactly one of "bullets" or "text".`
   - `pull: not a field of "split". Allowed: kicker, title, takeaway, footnote, source, chart, notes.`
2. **Layout (`fitIssues`)**, after rendering at 1920×1080 in the browser. Character counts approximate
   width; this check is authoritative. It is returned in `layout` and the slide stays in draft until it is empty:
   - `title wraps to 3 lines (max 2); shorten it`
   - `takeaway wraps to 2 lines; it must fit on one`
   - `timeline runs 23px into the bottom margin; shorten the body or drop the takeaway`

Limits are calibrated so that a slide with **every slot at its maximum** still fits. `slides-v4.html?stress=1`
renders that worst case for every template, in both styles and both palettes. It must show 0 issues before
any template or limit change ships.

---

## Worked example

User (consulting deck): *"Add a slide showing interchange overtakes interest by year 4."*

Agent → `get_template({ "id": "split" })`, then:

```json
{
  "slide": {
    "template": "split",
    "kicker": "Unit economics",
    "title": "[[Interchange]] catches up with interest by year 4, lifting gross margin from 12% to 38%",
    "chart": {
      "type": "bars",
      "categories": ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
      "format": "£{v}m",
      "series": [
        { "name": "Interest income", "color": "neutral", "values": [0.4, 3.1, 14, 42, 85] },
        { "name": "Interchange", "color": "focus", "values": [0.3, 2.2, 11, 36, 80] },
        { "name": "Gross margin", "color": "contrast", "line": true, "format": "{v}%", "values": [12, 24, 31, 36, 38] }
      ]
    },
    "notes": [
      { "title": "Interest leads early", "text": "Revolvers are **40–60%** of customers and carry margin while spend ramps.", "point": { "series": 0, "index": 1 } },
      { "title": "Interchange compounds", "text": "Spend per customer grows **3×** as the card replaces the personal Amex.", "point": { "series": 1, "index": 3 } },
      { "title": "Margin settles at 38%", "text": "Bad debt stabilises near **10%** of revolver balances from year 4.", "point": { "series": 2, "index": 4 } }
    ],
    "takeaway": "Spend, not lending, is what makes the book profitable.",
    "footnote": "Gross margin = revenue less funding cost, rewards and bad debt, as a share of revenue.",
    "source": "FinBridge financial model, base case. Illustrative."
  }
}
```

Tool → `{ "ok": true, "slide_id": "s4", "errors": [], "warnings": [], "layout": [] }`

User: *"Make the takeaway punchier."* Agent → `update_slide({ "slide_id": "s4", "patch": { "takeaway": "Spend pays; lending just starts it." } })`
