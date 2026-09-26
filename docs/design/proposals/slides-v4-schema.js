/* ═══════════════════════════════════════════════════════════════════════════
   Slide system v4 "Ink": the contract between the agent and the renderer.

   The agent never writes layout. It writes one small JSON object per slide:
     { "template": "<id>", ...slots }
   This file is the single source of truth for what those slots are. The agent
   reads it through two tools (progressive disclosure):
     list_templates()   -> catalogue(style)       one line per template
     get_template(id)   -> describe(id, style)    full slot schema for one template
   Every slide the agent writes goes through validate(); the error messages are
   written for the agent to read and fix.

   Plain data + a few pure functions. Works in the browser (window.SlideSchema)
   and in Node (require). Port to TypeScript + zod at build time.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";

/* ─────────────── Deck-level settings ─────────────── */

const STYLES = {
  consulting: {
    summary: "McKinsey-like. The argument is carried by full-sentence action titles; the body is the evidence.",
    rules: [
      "Pyramid Principle: the answer first, then the supporting arguments. Order slides so the deck reads as one argument.",
      "Every title is an action title: a full sentence that states the 'so what', not a topic. Bad: 'Market size'. Good: 'Most UK SMEs already need revolving credit'.",
      "Reading only the titles, in order, must tell the whole story.",
      "Body content is MECE: points do not overlap and together cover the claim in the title.",
      "Evidence is specific: numbers with units, named sources. Put the source in `source`, caveats in `footnote`.",
      "Use `takeaway` to state the implication in one line when the body does not already make it obvious.",
    ],
  },
  pitch: {
    summary: "YC / VC-like. One bold claim per slide, big numbers, very little text.",
    rules: [
      "One idea per slide. The title is a short, punchy claim of at most ~8 words, ending with a full stop.",
      "Prefer a single big number over a paragraph. Cut every word that does not change the meaning.",
      "Leave optional detail slots empty (note text, stat text, bullets) unless they are essential.",
      "`footnote` and `source` are allowed but rarely used; keep them for figures an investor will challenge.",
    ],
  },
};

const THEMES = {
  ink:   { name: "Ink",   summary: "Dark, warm black with a gold focus colour. Strong on screens and for pitch decks." },
  paper: { name: "Paper", summary: "Light, warm white with a cobalt focus colour. Reads like a printed memo; good for consulting decks." },
};

const MARKUP = [
  { syntax: "**text**",  effect: "bold",           use: "Emphasis inside body text. A few words, not whole sentences." },
  { syntax: "[[text]]",  effect: "focus colour",   use: "The point of the slide. At most one span per title; match the focus series, column or stat." },
  { syntax: "[-text-]",  effect: "negative colour", use: "The problem, a loss or a risk." },
  { syntax: "[+text+]",  effect: "positive colour", use: "Money made or a gain." },
];
const MARKUP_NOTE = "Fields marked `markup` accept the inline syntax above. Fields marked `text` are plain: no markup, no HTML.";

/* Curated icon set (lucide names). The agent may only use these. */
const ICONS = [
  "zap", "wallet", "credit-card", "banknote", "piggy-bank", "landmark", "receipt", "coins",
  "building-2", "store", "shopping-cart", "truck", "package", "factory",
  "users", "user", "handshake", "briefcase", "target", "rocket", "lightbulb", "sparkles",
  "trending-up", "trending-down", "chart-line", "chart-column", "chart-pie", "gauge",
  "shield-check", "lock", "scale", "file-text", "clock", "calendar", "refresh-cw",
  "globe", "map-pin", "layers", "puzzle", "settings", "cpu", "database", "cloud", "smartphone",
  "message-circle", "search", "circle-check", "triangle-alert", "leaf", "heart",
];

/* ─────────────── Field vocabulary ───────────────
   type:     text | markup | number | boolean | enum | list | object | cell | chart
   required: true when the slot must be filled
   max:      character limit (markup stripped). Either a number or { consulting, pitch }.
   items:    { min, max } for lists
   of:       field definition of each list item
   fields:   sub-fields of an object
   desc:     what goes in the slot (read by the agent)                              */

const f = (type, desc, extra = {}) => ({ type, desc, ...extra });

const COMMON = {
  kicker:   f("text",   "Small label above the title. Optional: defaults to the current section title (set by the last `section` slide).", { max: 40 }),
  title:    f("markup", "The action title; it must fit on at most 2 lines. Consulting: a full sentence stating the so-what. Pitch: a short bold claim.", { required: true, max: { consulting: 105, pitch: 44 } }),
  takeaway: f("markup", "Optional one-line conclusion anchored at the bottom of the slide. Must fit on ONE line.", { max: { consulting: 75, pitch: 42 } }),
  footnote: f("markup", "Optional footnote at the bottom left: definitions, caveats, assumptions. Mostly consulting.", { max: 110 }),
  source:   f("markup", "Optional source line at the bottom left. Rendered as 'Source: …'. Do not write the 'Source:' prefix.", { max: 110 }),
};

const TONE = f("enum", "Colour of the value.", { values: ["focus", "neg", "pos"], default: "focus" });

const CHART = f("chart", "A bar or line chart. Values are written on the data; there is no y-axis to configure.", {
  required: true,
  fields: {
    type:       f("enum", "`bars`: grouped bars for comparing categories, optionally with ONE line series on its own scale (e.g. a margin %). `lines`: trends over time with big labels at the end of each line.", { required: true, values: ["bars", "lines"] }),
    categories: f("list", "X-axis labels, in order. Keep them short: 'Year 1', 'Q2', 'Q1 ’27'.", { required: true, items: { min: 2, max: 12 }, of: f("text", "Category label.", { max: 10 }) }),
    format:     f("text", "Value format; `{v}` is replaced by the number. E.g. '£{v}m', '{v}%', '${v}k'.", { default: "{v}" }),
    series: f("list", "Data series. Exactly one series should be `focus`: the one the title is about.", {
      required: true, items: { min: 1, max: 4 },
      of: f("object", "One series.", { fields: {
        name:   f("text", "Series name, shown in the legend or end label.", { required: true, max: 24 }),
        values: f("list", "One number per category, same order. Plain numbers, no units.", { required: true, of: f("number", "Value.") }),
        color:  f("enum", "`focus`: the series the slide is about. `neutral`: context. `contrast`: a secondary series that must still read clearly (e.g. an overlay line or a downside case).", { required: true, values: ["focus", "neutral", "contrast"] }),
        line:   f("boolean", "bars only: draw this series as a line on its own scale. At most one.", { default: false }),
        format: f("text", "Overrides the chart format for this series (useful for a % line over £ bars).", {}),
        area:   f("boolean", "lines only: shade the area under this line. Use on the focus series only.", { default: false }),
        dashed: f("boolean", "lines only: dashed line, for forecasts or scenarios.", { default: false }),
      } }),
    }),
  },
});

/* ─────────────── Templates ─────────────── */

const TEMPLATES = {
  cover: {
    summary: "Opening slide: deck title and one-sentence subtitle. No numbers, no labels.",
    use: "Always the first slide, exactly once.",
    common: false,
    fields: {
      title:    f("markup", "Company, product or report name, or (pitch) a short bold claim.", { required: true, max: { consulting: 24, pitch: 32 } }),
      subtitle: f("markup", "One sentence saying what this is and for whom. No figures.", { required: true, max: { consulting: 120, pitch: 80 } }),
    },
    rules: ["The cover never carries numbers, facts, dates or bylines."],
  },

  section: {
    summary: "Section divider: big section number and name. Sets the default kicker for the slides that follow.",
    use: "Decks of 8+ slides with 2–5 parts. Do not use a section for a single slide.",
    common: false,
    fields: {
      title:    f("text",   "Section name, 1–3 words: 'The problem', 'Business model'.", { required: true, max: { consulting: 28, pitch: 20 } }),
      subtitle: f("markup", "Optional: the one-sentence answer this section will prove.", { max: { consulting: 110, pitch: 60 } }),
    },
    rules: ["Sections are numbered automatically (01, 02 …). Do not put numbers in the title."],
  },

  hero: {
    summary: "Argument on the left, one big number on the right.",
    use: "One number proves the point (a size, a cost, a gap). Typical for the problem slide.",
    fields: {
      body:   f("list", "Paragraphs of argument. Consulting: 1–2 short paragraphs. Pitch: 1 line.", { required: true, items: { min: 1, max: 2 }, of: f("markup", "Paragraph.", { max: { consulting: 170, pitch: 70 } }) }),
      number: f("object", "The big number.", { required: true, fields: {
        value:   f("text",   "The number with its unit: '£540k', '19%', '5 min'. At most 6 characters.", { required: true, max: 6 }),
        caption: f("markup", "What the number means, in one phrase.", { required: true, max: { consulting: 90, pitch: 60 } }),
        tone:    TONE,
      } }),
    },
  },

  split: {
    summary: "Chart on the left (⅔), numbered commentary on the right (⅓). The classic consulting slide.",
    use: "A chart that needs explaining: 2–4 observations, each optionally pinned to a data point.",
    fields: {
      chart: CHART,
      notes: f("list", "Numbered observations, in reading order. Numbers are added automatically.", { required: true, items: { min: 2, max: 4 }, of: f("object", "One observation.", { fields: {
        title: f("markup", "The observation as a short headline.", { required: true, max: { consulting: 28, pitch: 28 } }),
        text:  f("markup", "Optional supporting sentence. Consulting only; leave empty in pitch.", { max: 80 }),
        point: f("object", "Optional: pin this note's number onto a data point in the chart.", { fields: {
          series: f("number", "0-based index into chart.series.", { required: true }),
          index:  f("number", "0-based index into chart.categories.", { required: true }),
        } }),
      } }) }),
    },
    rules: ["`point` only works with `bars` charts.", "At most 3 notes when any note has `text`, and at most 3 notes in pitch.", "With a takeaway, all note texts together are at most 200 characters."],
  },

  columns: {
    summary: "2–4 parallel columns, each with an icon or a big value, a title, and bullets or a line of text.",
    use: "Options, pillars, features or steps that are parallel and MECE.",
    fields: {
      columns: f("list", "The columns, left to right.", { required: true, items: { min: 2, max: 4 }, of: f("object", "One column. Give exactly one of `icon` / `value`, and exactly one of `bullets` / `text`.", { fields: {
        icon:    f("enum",   "Consulting: an icon from the curated set.", { values: ICONS }),
        value:   f("text",   "Pitch: a big value instead of an icon, e.g. '5 min', '1%'.", { max: 6 }),
        title:   f("markup", "Column title.", { required: true, max: { consulting: 24, pitch: 22 } }),
        bullets: f("list",   "Consulting: 1–3 bullets.", { items: { min: 1, max: 3 }, of: f("markup", "Bullet.", { max: 60 }) }),
        text:    f("markup", "Pitch: one short line.", { max: 44 }),
      } }) }),
    },
    rules: ["All columns use the same shape: all icons or all values, and all bullets or all text.", "A column's bullets total at most 120 characters.", "With 4 columns: at most 2 bullets per column, each at most 48 characters; `text` at most 30 characters."],
  },

  cases: {
    summary: "Two framed cards side by side: a contrast (bad vs good, before vs after, them vs us).",
    use: "Two alternatives where one wins. Exactly two cases.",
    fields: {
      cases: f("list", "The two cases, left then right. Put the losing case on the left.", { required: true, items: { min: 2, max: 2 }, of: f("object", "One case. Give exactly one of `bullets` / `text`.", { fields: {
        tone:    f("enum",   "`neg`: the losing or problem case. `focus`: the winning case. `neutral`: neither.", { values: ["neg", "focus", "neutral"], default: "neutral" }),
        label:   f("text",   "Who or what this case is: 'Credit-only lenders'.", { required: true, max: 30 }),
        title:   f("text",   "Big two-word headline: 'Adverse loop'.", { required: true, max: 14 }),
        bullets: f("list",   "Consulting: 2–3 bullets, one line each.", { items: { min: 1, max: 3 }, of: f("markup", "Bullet.", { max: 48 }) }),
        text:    f("markup", "Pitch: one short line.", { max: 50 }),
        facts:   f("list",   "Consulting, optional: up to 2 labelled facts pinned to the bottom of the card.", { items: { min: 1, max: 2 }, of: f("object", "Fact.", { fields: {
          label: f("text",   "Short label: 'Outcome', 'Proof'.", { required: true, max: 14 }),
          text:  f("markup", "The fact.", { required: true, max: 38 }),
        } }) }),
      } }) }),
    },
  },

  table: {
    summary: "A typeset data table with optional sub-notes under values and a total row.",
    use: "Exact figures across 2–5 columns where the reader needs to compare rows (unit economics, pricing, feature matrix).",
    fields: {
      table: f("object", "The table.", { required: true, fields: {
        columns: f("list", "Column headers, left to right. The first column is usually the row label.", { required: true, items: { min: 2, max: 5 }, of: f("object", "Column.", { fields: {
          label: f("text",    "Header text.", { required: true, max: 26 }),
          num:   f("boolean", "Right-align as numbers.", { default: false }),
          focus: f("boolean", "Highlight this column in the focus colour. At most one.", { default: false }),
        } }) }),
        rows: f("list", "Rows, top to bottom.", { required: true, items: { min: 1, max: 8 }, of: f("object", "Row.", { fields: {
          cells: f("list", "One cell per column. A cell is a string, or { value, note } to add a small note under the value.", { required: true, of: f("cell", "Cell.", { max: 40 }) }),
          style: f("enum", "`muted`: a context row, hidden in pitch. `total`: the bottom-line row, drawn with a rule above.", { values: ["muted", "total"] }),
        } }) }),
      } }),
    },
    rules: [
      "Row budget: each row costs 1, a row with any cell note costs 1.5, and a takeaway costs 1.5. Consulting: at most 10.5. Pitch: at most 7 (cell notes and muted rows are hidden in pitch, so they cost nothing there).",
    ],
  },

  chart: {
    summary: "One full-width chart with an action title.",
    use: "The chart is self-explanatory and the title says what it shows. Use `split` instead if it needs commentary.",
    fields: { chart: CHART },
  },

  timeline: {
    summary: "Rows of phases: when, a one-word phase name, and what happens.",
    use: "A plan, roadmap or history in 2–5 steps.",
    fields: {
      steps: f("list", "Steps in time order. Pitch: at most 4, or 3 with a takeaway.", { required: true, items: { min: 2, max: 5 }, of: f("object", "Step.", { fields: {
        when:  f("text",    "Time span: '0–6 mo', 'Year 2', 'Q3 2027'.", { required: true, max: 10 }),
        title: f("text",    "Phase name, one word: 'Build', 'Prove', 'Scale'.", { required: true, max: { consulting: 10, pitch: 7 } }),
        text:  f("markup",  "What happens in this phase, in one line.", { required: true, max: { consulting: 70, pitch: 24 } }),
        focus: f("boolean", "Highlight the step the slide is about. At most one.", { default: false }),
      } }) }),
    },
  },

  stats: {
    summary: "2–4 big numbers in a row, each with a label and optional explanation.",
    use: "Several independent numbers that together make the case (market sizing, traction).",
    fields: {
      stats: f("list", "The numbers, left to right.", { required: true, items: { min: 2, max: 4 }, of: f("object", "Stat.", { fields: {
        value: f("text",    "The number with its unit. At most 6 characters: '5.7M', '30–40%'.", { required: true, max: 6 }),
        label: f("text",    "What it counts, in 2–4 words.", { required: true, max: 22 }),
        text:  f("markup",  "Consulting: one sentence of context. Leave empty in pitch.", { max: 80 }),
        focus: f("boolean", "Highlight the stat the title is about. At most one.", { default: false }),
      } }) }),
    },
  },
};

// Content templates share the kicker / title / takeaway / footnote / source frame.
for (const t of Object.values(TEMPLATES)) {
  if (t.common === false) continue;
  t.fields = { ...COMMON, ...t.fields };
}

const DECK = {
  style:  f("enum", "Writing style for the whole deck. Chosen by the user.", { required: true, values: Object.keys(STYLES) }),
  theme:  f("enum", "Colour palette for the whole deck.", { required: true, values: Object.keys(THEMES), default: "ink" }),
  footer: f("text", "Shown bottom right on every slide, next to the page number: '<Company> · <document>'.", { required: true, max: 44 }),
};

/* ─────────────── Agent-facing views ─────────────── */

const limitFor = (max, style) => (max && typeof max === "object" ? max[style] : max);

/** One line per template. This is what list_templates returns. */
function catalogue() {
  return Object.entries(TEMPLATES).map(([id, t]) => `${id}: ${t.summary} Use when: ${t.use}`).join("\n");
}

/** Resolve a field definition for one style: limits become plain numbers. */
function view(def, style) {
  const out = { type: def.type };
  if (def.required) out.required = true;
  const max = limitFor(def.max, style);
  if (max) out.maxChars = max;
  if (def.values) out.values = def.values;
  if (def.default !== undefined) out.default = def.default;
  if (def.items) out.items = def.items;
  out.desc = def.desc;
  if (def.of) out.of = view(def.of, style);
  if (def.fields) out.fields = Object.fromEntries(Object.entries(def.fields).map(([k, v]) => [k, view(v, style)]));
  return out;
}

/** Full schema of one template for one style. This is what get_template returns. */
function describe(id, style = "consulting") {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown template "${id}". Known: ${Object.keys(TEMPLATES).join(", ")}`);
  return {
    template: id, summary: t.summary, use: t.use,
    fields: Object.fromEntries(Object.entries(t.fields).map(([k, v]) => [k, view(v, style)])),
    rules: [...(t.rules || []), `Markup: ${MARKUP.map(m => `${m.syntax} = ${m.effect}`).join("; ")}. ${MARKUP_NOTE}`],
  };
}

/* ─────────────── Validation ───────────────
   validate(slide, style) -> { errors: [...], warnings: [...] }
   Messages name the exact path and say how to fix it.                         */

const plain = s => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(.+?)\]\]/g, "$1").replace(/\[-(.+?)-\]/g, "$1").replace(/\[\+(.+?)\+\]/g, "$1");
const MARKUP_RE = /\*\*|\[\[|\]\]|\[-|-\]|\[\+|\+\]/;

function check(def, value, path, style, out) {
  if (value === undefined || value === null || value === "") {
    if (def.required) out.errors.push(`${path}: required. ${def.desc}`);
    return;
  }
  const max = limitFor(def.max, style);
  switch (def.type) {
    case "text":
    case "markup": {
      if (typeof value !== "string") return out.errors.push(`${path}: must be a string.`);
      if (/<[a-z/][^>]*>/i.test(value)) out.errors.push(`${path}: HTML is not allowed. Use the markup syntax instead.`);
      if (def.type === "text" && MARKUP_RE.test(value)) out.errors.push(`${path}: plain text only; remove the markup.`);
      const len = plain(value).length;
      if (max && len > max) out.errors.push(`${path}: ${len} characters, limit is ${max} for ${style}. Shorten it; do not split it across fields.`);
      if (def.type === "markup" && (value.match(/\[\[/g) || []).length > 1 && path.endsWith(".title")) out.warnings.push(`${path}: more than one [[focus]] span; keep one.`);
      break;
    }
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) out.errors.push(`${path}: must be a number without units (got ${JSON.stringify(value)}).`);
      break;
    case "boolean":
      if (typeof value !== "boolean") out.errors.push(`${path}: must be true or false.`);
      break;
    case "enum":
      if (!def.values.includes(value)) out.errors.push(`${path}: "${value}" is not allowed. Use one of: ${def.values.join(", ")}.`);
      break;
    case "cell": {
      const v = typeof value === "object" ? value : { value };
      if (typeof v.value !== "string" && typeof v.value !== "number") out.errors.push(`${path}: a cell is a string or { "value": "…", "note": "…" }.`);
      else if (max && String(v.value).length > max) out.errors.push(`${path}: ${String(v.value).length} characters, limit is ${max}.`);
      if (v.note !== undefined && String(v.note).length > 32) out.errors.push(`${path}.note: limit is 32 characters.`);
      break;
    }
    case "list": {
      if (!Array.isArray(value)) return out.errors.push(`${path}: must be a list.`);
      const { min, max: maxItems } = def.items || {};
      if (min && value.length < min) out.errors.push(`${path}: needs at least ${min} items (got ${value.length}).`);
      if (maxItems && value.length > maxItems) out.errors.push(`${path}: at most ${maxItems} items (got ${value.length}). Cut or merge; do not add a second slide just to fit.`);
      value.forEach((item, i) => check(def.of, item, `${path}[${i}]`, style, out));
      break;
    }
    case "object":
    case "chart": {
      if (typeof value !== "object" || Array.isArray(value)) return out.errors.push(`${path}: must be an object.`);
      for (const [k, sub] of Object.entries(def.fields)) check(sub, value[k], `${path}.${k}`, style, out);
      for (const k of Object.keys(value)) if (!def.fields[k]) out.errors.push(`${path}.${k}: unknown field. Allowed: ${Object.keys(def.fields).join(", ")}.`);
      if (def.type === "chart") checkChart(value, path, out);
      break;
    }
  }
}

function checkChart(c, path, out) {
  if (!Array.isArray(c.series) || !Array.isArray(c.categories)) return;
  c.series.forEach((s, i) => {
    if (Array.isArray(s.values) && s.values.length !== c.categories.length)
      out.errors.push(`${path}.series[${i}].values: ${s.values.length} values but ${c.categories.length} categories. Give exactly one value per category.`);
    if (c.type === "lines" && s.line) out.errors.push(`${path}.series[${i}].line: only for bars charts.`);
    if (c.type === "bars" && (s.area || s.dashed)) out.errors.push(`${path}.series[${i}]: \`area\` and \`dashed\` are only for lines charts.`);
  });
  if (c.type === "bars") {
    if (c.series.filter(s => s.line).length > 1) out.errors.push(`${path}.series: at most one series can have "line": true.`);
    if (c.series.filter(s => !s.line).length > 3) out.errors.push(`${path}.series: at most 3 bar series.`);
  }
  if (c.format && !String(c.format).includes("{v}")) out.errors.push(`${path}.format: must contain {v}, e.g. "£{v}m".`);
  const focus = c.series.filter(s => s.color === "focus").length;
  if (focus !== 1) out.warnings.push(`${path}.series: ${focus} series are "focus"; exactly one should be.`);
}

const count = (list, key) => (list || []).filter(x => x && x[key]).length;

function checkRules(s, style, out) {
  switch (s.template) {
    case "split": {
      const notes = s.notes || [];
      if (notes.length > 3 && (style === "pitch" || notes.some(n => n && n.text))) out.errors.push(`notes: ${notes.length} notes; at most 3 when notes have text${style === "pitch" ? " or in pitch" : ""}. Merge or cut the weakest.`);
      notes.forEach((n, i) => {
        if (!n || !n.point || !s.chart) return;
        if (s.chart.type !== "bars") return out.errors.push(`notes[${i}].point: points only work with bars charts; remove it.`);
        const series = s.chart.series || [], cats = s.chart.categories || [];
        if (!(n.point.series >= 0 && n.point.series < series.length)) out.errors.push(`notes[${i}].point.series: ${n.point.series} is out of range; the chart has ${series.length} series (0–${series.length - 1}).`);
        if (!(n.point.index >= 0 && n.point.index < cats.length)) out.errors.push(`notes[${i}].point.index: ${n.point.index} is out of range; the chart has ${cats.length} categories (0–${cats.length - 1}).`);
      });
      const textLen = notes.reduce((sum, n) => sum + (n && n.text ? plain(n.text).length : 0), 0);
      if (s.takeaway && textLen > 200) out.errors.push(`notes[].text: ${textLen} characters in total; with a takeaway the limit is 200. Shorten the notes or drop the takeaway.`);
      if (style === "pitch" && notes.some(n => n && n.text)) out.warnings.push("notes[].text: pitch slides normally leave note text empty.");
      break;
    }
    case "columns": {
      const cols = s.columns || [];
      cols.forEach((c, i) => {
        if (!c) return;
        if (!!c.icon === !!c.value) out.errors.push(`columns[${i}]: give exactly one of "icon" or "value".`);
        if (!!c.bullets === !!c.text) out.errors.push(`columns[${i}]: give exactly one of "bullets" or "text".`);
      });
      if (count(cols, "icon") && count(cols, "value")) out.errors.push("columns: mix of icons and values; use the same for every column.");
      if (count(cols, "bullets") && count(cols, "text")) out.errors.push("columns: mix of bullets and text; use the same for every column.");
      cols.forEach((c, i) => { const n = c && c.bullets ? c.bullets.reduce((sum, b) => sum + plain(b).length, 0) : 0;
        if (n > 120) out.errors.push(`columns[${i}].bullets: ${n} characters in total; a column holds at most 120. Cut a bullet or shorten them.`); });
      if (cols.length === 4) cols.forEach((c, i) => {
        if (!c) return;
        if (c.bullets && c.bullets.length > 2) out.errors.push(`columns[${i}].bullets: with 4 columns, at most 2 bullets per column.`);
        (c.bullets || []).forEach((b, j) => { if (plain(b).length > 48) out.errors.push(`columns[${i}].bullets[${j}]: with 4 columns, bullets are at most 48 characters (got ${plain(b).length}).`); });
        if (c.text && plain(c.text).length > 30) out.errors.push(`columns[${i}].text: with 4 columns, text is at most 30 characters (got ${plain(c.text).length}).`);
      });
      break;
    }
    case "cases":
      (s.cases || []).forEach((c, i) => { if (c && !!c.bullets === !!c.text) out.errors.push(`cases[${i}]: give exactly one of "bullets" or "text".`); });
      break;
    case "table": {
      const t = s.table || {}, n = (t.columns || []).length;
      (t.rows || []).forEach((r, i) => {
        if (r && Array.isArray(r.cells) && r.cells.length !== n) out.errors.push(`table.rows[${i}].cells: ${r.cells.length} cells but ${n} columns. Use "—" for an empty cell.`);
      });
      if (count(t.columns, "focus") > 1) out.errors.push("table.columns: at most one focus column.");
      const rows = (t.rows || []).filter(r => r && !(style === "pitch" && r.style === "muted"));
      const noted = r => style === "consulting" && (r.cells || []).some(c => c && typeof c === "object" && c.note);
      const cost = rows.reduce((sum, r) => sum + (noted(r) ? 1.5 : 1), 0) + (s.takeaway ? 1.5 : 0), budget = style === "pitch" ? 7 : 10.5;
      if (cost > budget) out.errors.push(`table: row budget is ${budget} for ${style}, this table costs ${cost} (row = 1, row with a cell note = 1.5, takeaway = 1.5). Cut rows, drop cell notes or drop the takeaway.`);
      break;
    }
    case "timeline":
      if (count(s.steps, "focus") > 1) out.errors.push("steps: at most one step can be focus.");
      const maxSteps = style === "pitch" ? (s.takeaway ? 3 : 4) : 5;
      if ((s.steps || []).length > maxSteps) out.errors.push(`steps: ${style} timelines${s.takeaway ? " with a takeaway" : ""} have at most ${maxSteps} steps (got ${s.steps.length}).`);
      break;
    case "stats":
      if (count(s.stats, "focus") > 1) out.errors.push("stats: at most one stat can be focus.");
      if (style === "pitch" && count(s.stats, "text")) out.warnings.push("stats[].text: pitch slides normally leave stat text empty.");
      break;
  }
  if (style === "consulting" && s.title && TEMPLATES[s.template] && TEMPLATES[s.template].common !== false && plain(s.title).trim().split(/\s+/).length < 5)
    out.warnings.push("title: consulting titles are full-sentence action titles (usually 8–16 words). This reads like a topic.");
}

/** Validate one slide. `style` is the deck style. */
function validate(slide, style = "consulting") {
  const out = { errors: [], warnings: [] };
  if (!slide || typeof slide !== "object") return { errors: ["slide: must be an object."], warnings: [] };
  const t = TEMPLATES[slide.template];
  if (!t) return { errors: [`template: "${slide.template}" does not exist. Use one of: ${Object.keys(TEMPLATES).join(", ")}.`], warnings: [] };
  for (const [k, def] of Object.entries(t.fields)) check(def, slide[k], k, style, out);
  for (const k of Object.keys(slide)) if (k !== "template" && !t.fields[k]) out.errors.push(`${k}: not a field of "${slide.template}". Allowed: ${Object.keys(t.fields).join(", ")}.`);
  checkRules(slide, style, out);
  return out;
}

/** Validate a whole deck: settings plus every slide, with deck-level rules. */
function validateDeck(deck) {
  const out = { errors: [], warnings: [] };
  for (const [k, def] of Object.entries(DECK)) check(def, deck[k], k, deck.style, out);
  const slides = deck.slides || [];
  slides.forEach((s, i) => {
    const r = validate(s, deck.style);
    r.errors.forEach(e => out.errors.push(`slides[${i}].${e}`));
    r.warnings.forEach(w => out.warnings.push(`slides[${i}].${w}`));
  });
  if (slides.length && slides[0].template !== "cover") out.warnings.push("slides[0]: a deck normally opens with a cover.");
  if (slides.filter(s => s.template === "cover").length > 1) out.errors.push("slides: only one cover.");
  slides.forEach((s, i) => { if (s.template === "section" && (!slides[i + 1] || slides[i + 1].template === "section")) out.warnings.push(`slides[${i}]: a section needs at least one content slide after it.`); });
  return out;
}

const api = { STYLES, THEMES, MARKUP, MARKUP_NOTE, ICONS, TEMPLATES, DECK, catalogue, describe, validate, validateDeck, plain };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.SlideSchema = api;
})(typeof window !== "undefined" ? window : globalThis);
