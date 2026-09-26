/* ═══════════════════════════════════════════════════════════════════════════
   Slide system v5: the contract between the agent and the renderer.

   The agent picks ONE entry from a flat menu of 7 templates and writes fields
   named after the content: { "template": "<id>", ...fields }. It never sees
   layouts, areas or block kinds; code picks the layout variant from the
   content (a chart with notes becomes a split). See the spec, sections 3.4–3.5.

   Fields can be limited to one style (`styles`). Limits are { consulting, pitch }
   or a number. Prototype limits are hand-tuned and proven by the stress deck;
   the product computes them from geometry (spec 4.3).
   ═══════════════════════════════════════════════════════════════════════════ */

export const STYLES = {
  consulting: {
    summary: "McKinsey-like. The argument is carried by full-sentence action titles; the body is the evidence.",
    rules: [
      "Every title is an action title: a full sentence that states the so-what, not a topic. Bad: 'Market size'. Good: 'Most UK SMEs already need revolving credit'.",
      "Reading only the titles, in order, must tell the whole story.",
      "Body content is MECE: points do not overlap and together cover the claim in the title.",
      "Evidence is specific: numbers with units, named sources. Put the source in `source`, caveats in `footnote`.",
      "Use `takeaway` for the implication in one line, only when the body does not already make it obvious.",
    ],
  },
  pitch: {
    summary: "YC / VC-like. A one-line topic title, the claim as a short subtitle, big numbers, very little text.",
    rules: [
      "The title is the topic in 1–3 words: 'Unit economics', 'The problem', 'Market'. Never a sentence.",
      "The subtitle is the claim: one short sentence, ending with a full stop.",
      "One idea per slide. Prefer a single big number over a paragraph. Cut every word that does not change the meaning.",
      "Leave optional detail empty unless it is essential. `footnote` and `source` are rare.",
    ],
  },
};

export const THEMES = {
  ink: { name: "Ink", summary: "Dark, warm black with a gold focus colour." },
  paper: { name: "Paper", summary: "Light, warm white with a cobalt focus colour." },
};

export const MARKUP = [
  { syntax: "**text**", effect: "bold", use: "Emphasis inside body text. A few words, not whole sentences." },
  { syntax: "[[text]]", effect: "focus colour", use: "The point of the slide. At most one span per title; match the focus series, card or step." },
  { syntax: "[-text-]", effect: "negative colour", use: "The problem, a loss or a risk." },
  { syntax: "[+text+]", effect: "positive colour", use: "Money made or a gain." },
];
const MARKUP_NOTE = "Fields of type `markup` accept the inline syntax above. Fields of type `text` are plain.";

/* Curated icon set (lucide names). Only these are allowed. */
export const ICONS = [
  "zap", "wallet", "credit-card", "banknote", "piggy-bank", "landmark", "receipt", "coins",
  "building-2", "store", "shopping-cart", "truck", "package", "factory",
  "users", "user", "handshake", "briefcase", "target", "rocket", "lightbulb", "sparkles",
  "trending-up", "trending-down", "chart-line", "chart-column", "chart-pie", "gauge",
  "shield-check", "lock", "scale", "file-text", "clock", "calendar", "refresh-cw",
  "globe", "map-pin", "layers", "puzzle", "settings", "cpu", "database", "cloud", "smartphone",
  "message-circle", "search", "circle-check", "triangle-alert", "leaf", "heart",
];

/* ─────────────── Field vocabulary ───────────────
   type: text | markup | number | boolean | enum | list | object | cell
   required, max (chars, markup stripped), items {min,max}, of, fields, values,
   styles (limit a field to some styles), desc (read by the agent).            */
const f = (type, desc, extra = {}) => ({ type, desc, ...extra });
const CONSULTING = ["consulting"], PITCH = ["pitch"];

/* The frame every content slide shares. It differs by style (spec 3.1). */
const FRAME = {
  kicker: f("text", "Small label above the title. Optional: defaults to the current section name.", { max: 40, styles: CONSULTING }),
  title: f("markup", "", { required: true, max: { consulting: 105, pitch: 20 },
    desc: { consulting: "The action title: a full sentence stating the so-what. At most 2 lines.", pitch: "The topic, 1–3 words: 'Unit economics'. Exactly 1 line. No markup needed." } }),
  subtitle: f("markup", "The claim in one short sentence, ending with a full stop. Optional; at most 2 lines.", { max: 90, styles: PITCH }),
  takeaway: f("markup", "Optional one-line conclusion at the bottom. Must fit on ONE line.", { max: { consulting: 75, pitch: 42 } }),
  footnote: f("markup", "Optional footnote: definitions, caveats, assumptions.", { max: 110 }),
  source: f("markup", "Optional source line, rendered as 'Source: …'. Do not write the prefix.", { max: 110 }),
};

const TONE = f("enum", "Colour of the value.", { values: ["focus", "neg", "pos"], default: "focus" });

const CHART = f("object", "A bar or line chart. Values are written on the data; there is no y-axis to configure.", {
  required: true,
  fields: {
    type: f("enum", "`bars`: grouped bars comparing categories, optionally with ONE line series on its own scale (e.g. a margin %). `lines`: trends over time with big labels at the end of each line.", { required: true, values: ["bars", "lines"] }),
    categories: f("list", "X-axis labels, in order. Short: 'Year 1', 'Q2', 'Q1 ’27'.", { required: true, items: { min: 2, max: 12 }, of: f("text", "Category label.", { max: 10 }) }),
    format: f("text", "Value format; `{v}` is replaced by the number. E.g. '£{v}m', '{v}%'.", { default: "{v}" }),
    series: f("list", "Data series. Exactly one series is `focus`: the one the title is about.", {
      required: true, items: { min: 1, max: 4 },
      of: f("object", "One series.", { fields: {
        name: f("text", "Series name, shown in the legend or end label.", { required: true, max: 24 }),
        values: f("list", "One number per category, same order. Plain numbers, no units.", { required: true, of: f("number", "Value.") }),
        color: f("enum", "`focus`: the series the slide is about. `neutral`: context. `contrast`: a secondary series that must still read clearly.", { required: true, values: ["focus", "neutral", "contrast"] }),
        line: f("boolean", "bars only: draw this series as a line on its own scale. At most one.", { default: false }),
        format: f("text", "Overrides the chart format for this series (a % line over £ bars)."),
        area: f("boolean", "lines only: shade the area under this line. Focus series only.", { default: false }),
        dashed: f("boolean", "lines only: dashed, for forecasts or scenarios.", { default: false }),
      } }),
    }),
  },
});

/* Notes are an optional field of chart and table, never a routing decision (D16). */
const notes = (withPoint) => f("list", "Optional numbered observations beside the chart or table. Add them only if each says something the body does not already show; in pitch, prefer none. Numbers are added automatically.", {
  items: { min: 2, max: 4 },
  of: f("object", "One observation.", { fields: {
    title: f("markup", "The observation as a short headline.", { required: true, max: 28 }),
    text: f("markup", "Optional supporting sentence.", { max: 80, styles: CONSULTING }),
    ...(withPoint ? { point: f("object", "Optional: pin this note's number onto a data point (bars charts only).", { fields: {
      series: f("number", "0-based index into chart.series.", { required: true }),
      index: f("number", "0-based index into chart.categories.", { required: true }),
    } }) } : {}),
  } }),
});

/* ─────────────── The menu: 7 entries, each a key component ───────────────
   `variant(slide)` is how code picks the internal layout; the agent never sees it. */
export const MENU = {
  chart: {
    summary: "A bar or line chart with a title; optional numbered notes beside it.",
    use: "Data over categories or time: a trend, a comparison of sizes, a crossover.",
    fields: { chart: CHART, notes: notes(true) },
    variant: (s) => (s.notes?.length ? "split" : "full"),
    rules: ["With notes: at most 6 categories.", "`notes[].point` only works with `bars` charts.", "At most 3 notes when any note has text, and at most 3 in pitch."],
  },
  table: {
    summary: "A typeset table with optional sub-notes under values and a total row; optional notes beside it.",
    use: "Exact figures the reader needs to compare across rows.",
    fields: {
      table: f("object", "The table.", { required: true, fields: {
        columns: f("list", "Column headers, left to right. The first column is usually the row label.", { required: true, items: { min: 2, max: 5 }, of: f("object", "Column.", { fields: {
          label: f("text", "Header text.", { required: true, max: 26 }),
          num: f("boolean", "Right-align as numbers.", { default: false }),
          focus: f("boolean", "Highlight this column. At most one.", { default: false }),
        } }) }),
        rows: f("list", "Rows, top to bottom.", { required: true, items: { min: 1, max: 8 }, of: f("object", "Row.", { fields: {
          cells: f("list", "One cell per column. A string, or { value, note } for a small note under the value.", { required: true, of: f("cell", "Cell.", { max: 40 }) }),
          style: f("enum", "`muted`: a context row, hidden in pitch. `total`: the bottom line, drawn with a rule above.", { values: ["muted", "total"] }),
        } }) }),
      } }),
      notes: notes(false),
    },
    variant: (s) => (s.notes?.length ? "split" : "full"),
    rules: [
      "Row budget: a row costs 1, a row with a cell note 1.5, a takeaway 1.5. Consulting: at most 10.5. Pitch: at most 7 (cell notes and muted rows are hidden in pitch).",
      "With notes: at most 4 columns, 3 notes, and first-column text of at most 24 characters.",
    ],
  },
  number: {
    summary: "One big number, with the argument beside it.",
    use: "One number proves the argument: a size, a cost, a gap.",
    fields: {
      body: f("list", "Paragraphs of argument.", { items: { min: 1, max: { consulting: 2, pitch: 1 } }, required: { consulting: true, pitch: false },
        of: f("markup", "Paragraph.", { max: { consulting: 170, pitch: 70 } }) }),
      number: f("object", "The big number.", { required: true, fields: {
        value: f("text", "The number with its unit: '£540k', '19%', '5 min'. At most 6 characters.", { required: true, max: 6 }),
        caption: f("markup", "What the number means, in one phrase.", { required: true, max: { consulting: 90, pitch: 60 } }),
        tone: TONE,
      } }),
    },
    variant: () => "split",
  },
  steps: {
    summary: "Rows of phases: when, a one-word phase name, and what happens.",
    use: "A sequence in time: a plan, roadmap, process or history in 2–5 steps.",
    fields: {
      steps: f("list", "Steps in time order.", { required: true, items: { min: 2, max: { consulting: 5, pitch: 4 } }, of: f("object", "Step.", { fields: {
        when: f("text", "Time span: '0–6 mo', 'Year 2', 'Q3 2027'.", { required: true, max: 10 }),
        title: f("text", "Phase name, one word: 'Build', 'Prove', 'Scale'.", { required: true, max: { consulting: 10, pitch: 7 } }),
        text: f("markup", "What happens in this phase, in one line.", { required: true, max: { consulting: 70, pitch: 24 } }),
        focus: f("boolean", "Highlight the step the slide is about. At most one.", { default: false }),
      } }) }),
    },
    variant: () => "full",
    rules: ["Pitch: at most 3 steps with a takeaway."],
  },
  cards: {
    summary: "2–4 parallel cards. Each leads with an icon or a big value; or two framed cards as a contrast.",
    use: "Parallel options, pillars or features; several independent numbers; or a two-way contrast (them vs us).",
    fields: {
      framed: f("boolean", "Two framed cards side by side, for a contrast: the losing case left (tone `neg`), the winning case right (tone `focus`).", { default: false }),
      cards: f("list", "The cards, left to right.", { required: true, items: { min: 2, max: 4 }, of: f("object", "One card.", { fields: {
        icon: f("enum", "Icon lead: an icon from the curated set. Not with `value` or `framed`.", { values: ICONS }),
        value: f("text", "Value lead: a big number with its unit, e.g. '5 min', '19%'. Not with `icon` or `framed`.", { max: 6 }),
        label: f("text", "Framed only: who or what this case is, e.g. 'Credit-only lenders'.", { max: 30 }),
        title: f("markup", "Card title. Framed: a big 2-word headline, plain text.", { required: true, max: { consulting: 24, pitch: 22 } }),
        bullets: f("list", "1–3 bullets. Not with `text`.", { items: { min: 1, max: 3 }, of: f("markup", "Bullet.", { max: 60 }), styles: CONSULTING }),
        text: f("markup", "One short line. Not with `bullets`. Value cards: one sentence of context.", { max: { consulting: 80, pitch: 50 } }),
        tone: f("enum", "`focus`: the card the title is about. `neg`: the problem or losing case. `neutral`: the rest.", { values: ["neutral", "focus", "neg"], default: "neutral" }),
        facts: f("list", "Framed only, optional: up to 2 labelled facts at the bottom of the card.", { items: { min: 1, max: 2 }, styles: CONSULTING, of: f("object", "Fact.", { fields: {
          label: f("text", "Short label: 'Outcome', 'Proof'.", { required: true, max: 14 }),
          text: f("markup", "The fact.", { required: true, max: 38 }),
        } }) }),
      } }) }),
    },
    variant: (s) => (s.framed ? "framed" : s.cards?.some((c) => c?.value) ? "value" : "icon"),
    rules: [
      "Not framed: every card has an icon, or every card has a value. Framed: exactly 2 cards, each with a `label`, no icon or value.",
      "All cards use the same body: all bullets, all text, or (value cards only) none.",
      "Text: icon cards at most 50 characters (30 in a row of 4); value cards at most 80 (pitch 44); framed at most 50.",
      "Bullets: at most 60 characters each and 120 per card; 48 each in framed cards or a row of 4, and at most 2 per card in a row of 4.",
      "At most one card has tone `focus` unless framed.",
    ],
  },
  cover: {
    summary: "Opening slide: deck title and a one-sentence subtitle.",
    use: "The first slide of a deck, once.",
    frame: false,
    fields: {
      title: f("markup", "Company, product or report name, or (pitch) a short bold claim.", { required: true, max: { consulting: 24, pitch: 32 } }),
      subtitle: f("markup", "One sentence saying what this is and for whom. No figures.", { required: true, max: { consulting: 120, pitch: 80 } }),
    },
    variant: () => "cover",
    rules: ["The cover never carries numbers, dates or bylines."],
  },
  section: {
    summary: "Section divider: big section number and name.",
    use: "The start of a new part in a deck of 8+ slides.",
    frame: false,
    fields: {
      title: f("text", "Section name, 1–3 words: 'The problem', 'Business model'.", { required: true, max: { consulting: 28, pitch: 20 } }),
      subtitle: f("markup", "Optional: the one-sentence answer this section will prove.", { max: { consulting: 110, pitch: 60 } }),
    },
    variant: () => "section",
    rules: ["Sections are numbered automatically. Do not put numbers in the title."],
  },
};

/* The picking guide (spec 9.2): used by the router prompt and when Jev is unsure. */
export const PICKING_GUIDE = [
  ["the first slide of a deck", "cover"],
  ["the start of a new part in a deck of 8+ slides", "section"],
  ["one number that proves the argument (a size, a cost, a gap)", "number"],
  ["data over categories or time (a series): a trend, a comparison of sizes, a crossover", "chart"],
  ["exact figures the reader needs to compare", "table"],
  ["a sequence in time: plan, roadmap, process, history (2–5 steps)", "steps"],
  ["2–4 parallel things: options, pillars, features, several independent numbers, or a two-way contrast", "cards"],
];

/* ─────────────── Resolving fields for one style ─────────────── */

const byStyle = (v, style) => (v && typeof v === "object" && !Array.isArray(v) && ("consulting" in v || "pitch" in v) ? v[style] : v);
const inStyle = (def, style) => !def.styles || def.styles.includes(style);

/** The fields of one entry for one style: frame + body, with style-only fields removed. */
export function fieldsFor(id, style) {
  const entry = MENU[id];
  if (!entry) throw new Error(`Unknown template "${id}". Known: ${Object.keys(MENU).join(", ")}`);
  const all = entry.frame === false ? entry.fields : { ...FRAME, ...entry.fields };
  return Object.fromEntries(Object.entries(all).filter(([, d]) => inStyle(d, style)));
}

/** One line per entry: what the router and planning prompt see. */
export function catalogue() {
  return Object.entries(MENU).map(([id, t]) => `${id}: ${t.summary} Use when: ${t.use}`).join("\n");
}

/** A field definition resolved for one style: plain numbers, no style maps. */
function view(def, style) {
  const out = { type: def.type };
  if (byStyle(def.required, style)) out.required = true;
  const max = byStyle(def.max, style);
  if (max) out.maxChars = max;
  if (def.values) out.values = def.values;
  if (def.default !== undefined) out.default = def.default;
  if (def.items) out.items = { min: byStyle(def.items.min, style), max: byStyle(def.items.max, style) };
  out.desc = byStyle(def.desc, style);
  if (def.of) out.of = view(def.of, style);
  if (def.fields) out.fields = Object.fromEntries(Object.entries(def.fields).filter(([, d]) => inStyle(d, style)).map(([k, v]) => [k, view(v, style)]));
  return out;
}

/** The template card body for one entry and style: resolved fields and rules. */
export function describe(id, style = "consulting") {
  const t = MENU[id];
  return {
    template: id, summary: t.summary, use: t.use,
    fields: Object.fromEntries(Object.entries(fieldsFor(id, style)).map(([k, v]) => [k, view(v, style)])),
    rules: [...(t.rules || []), `Markup: ${MARKUP.map((m) => `${m.syntax} = ${m.effect}`).join("; ")}. ${MARKUP_NOTE}`],
  };
}

/* ─────────────── Validation ───────────────
   validate(slide, style) -> { errors, warnings }. Messages name the exact path,
   what was measured, the limit and the fix (spec 9.4).                        */

export const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(.+?)\]\]/g, "$1").replace(/\[-(.+?)-\]/g, "$1").replace(/\[\+(.+?)\+\]/g, "$1");
const MARKUP_RE = /\*\*|\[\[|\]\]|\[-|-\]|\[\+|\+\]/;

function check(def, value, path, style, out) {
  if (value === undefined || value === null || value === "") {
    if (byStyle(def.required, style)) out.errors.push(`${path}: required. ${byStyle(def.desc, style)}`);
    return;
  }
  const max = byStyle(def.max, style);
  switch (def.type) {
    case "text":
    case "markup": {
      if (typeof value !== "string") return out.errors.push(`${path}: must be a string.`);
      if (/<[a-z/][^>]*>/i.test(value)) out.errors.push(`${path}: HTML is not allowed. Use the markup syntax instead.`);
      if (def.type === "text" && MARKUP_RE.test(value)) out.errors.push(`${path}: plain text only; remove the markup.`);
      const len = plain(value).length;
      if (max && len > max) out.errors.push(`${path}: ${len} characters, limit ${max} (${len - max} too many). Shorten this field only.`);
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
      else if (max && String(v.value).length > max) out.errors.push(`${path}: ${String(v.value).length} characters, limit ${max}.`);
      if (v.note !== undefined && String(v.note).length > 32) out.errors.push(`${path}.note: limit is 32 characters.`);
      break;
    }
    case "list": {
      if (!Array.isArray(value)) return out.errors.push(`${path}: must be a list.`);
      const min = byStyle(def.items?.min, style), maxItems = byStyle(def.items?.max, style);
      if (min && value.length < min) out.errors.push(`${path}: needs at least ${min} items (got ${value.length}).`);
      if (maxItems && value.length > maxItems) out.errors.push(`${path}: at most ${maxItems} items (got ${value.length}). Cut or merge.`);
      value.forEach((item, i) => check(def.of, item, `${path}[${i}]`, style, out));
      break;
    }
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) return out.errors.push(`${path}: must be an object.`);
      const fields = Object.fromEntries(Object.entries(def.fields).filter(([, d]) => inStyle(d, style)));
      for (const [k, sub] of Object.entries(fields)) check(sub, value[k], `${path}.${k}`, style, out);
      for (const k of Object.keys(value)) if (!fields[k]) out.errors.push(`${path}.${k}: not a field here${def.fields[k] ? ` in ${style}` : ""}. Allowed: ${Object.keys(fields).join(", ")}.`);
      break;
    }
  }
}

function checkChart(c, path, out) {
  if (!c || !Array.isArray(c.series) || !Array.isArray(c.categories)) return;
  c.series.forEach((s, i) => {
    if (Array.isArray(s?.values) && s.values.length !== c.categories.length)
      out.errors.push(`${path}.series[${i}].values: ${s.values.length} values, but there are ${c.categories.length} categories. Give exactly one value per category.`);
    if (c.type === "lines" && s?.line) out.errors.push(`${path}.series[${i}].line: only for bars charts.`);
    if (c.type === "bars" && (s?.area || s?.dashed)) out.errors.push(`${path}.series[${i}]: \`area\` and \`dashed\` are only for lines charts.`);
  });
  if (c.type === "bars") {
    if (c.series.filter((s) => s?.line).length > 1) out.errors.push(`${path}.series: at most one series can have "line": true.`);
    if (c.series.filter((s) => !s?.line).length > 3) out.errors.push(`${path}.series: at most 3 bar series.`);
  }
  if (c.format && !String(c.format).includes("{v}")) out.errors.push(`${path}.format: must contain {v}, e.g. "£{v}m".`);
  const focus = c.series.filter((s) => s?.color === "focus").length;
  if (focus !== 1) out.warnings.push(`${path}.series: ${focus} series are "focus"; exactly one should be.`);
}

const count = (list, key) => (list || []).filter((x) => x && x[key]).length;

function checkNotes(s, style, out) {
  const list = s.notes || [];
  if (list.length > 3 && (style === "pitch" || list.some((n) => n?.text))) out.errors.push(`notes: ${list.length} notes; at most 3 when notes have text${style === "pitch" ? " or in pitch" : ""}. Merge or cut the weakest.`);
  const textLen = list.reduce((sum, n) => sum + (n?.text ? plain(n.text).length : 0), 0);
  if (s.takeaway && textLen > 200) out.errors.push(`notes[].text: ${textLen} characters in total; with a takeaway the limit is 200. Shorten the notes or drop the takeaway.`);
}

function checkRules(s, style, out) {
  switch (s.template) {
    case "chart": {
      checkChart(s.chart, "chart", out);
      if (!s.notes?.length) break;
      checkNotes(s, style, out);
      const cats = s.chart?.categories || [], series = s.chart?.series || [];
      if (cats.length > 6) out.errors.push(`chart.categories: ${cats.length} categories; with notes at most 6. Drop notes or group categories.`);
      s.notes.forEach((n, i) => {
        if (!n?.point) return;
        if (s.chart?.type !== "bars") return out.errors.push(`notes[${i}].point: points only work with bars charts; remove it.`);
        if (!(n.point.series >= 0 && n.point.series < series.length)) out.errors.push(`notes[${i}].point.series: ${n.point.series} is out of range; the chart has ${series.length} series (0–${series.length - 1}).`);
        if (!(n.point.index >= 0 && n.point.index < cats.length)) out.errors.push(`notes[${i}].point.index: ${n.point.index} is out of range; the chart has ${cats.length} categories (0–${cats.length - 1}).`);
      });
      break;
    }
    case "table": {
      const t = s.table || {}, n = (t.columns || []).length;
      (t.rows || []).forEach((r, i) => {
        if (Array.isArray(r?.cells) && r.cells.length !== n) out.errors.push(`table.rows[${i}].cells: ${r.cells.length} cells, but there are ${n} columns. Use "—" for an empty cell.`);
      });
      if (count(t.columns, "focus") > 1) out.errors.push("table.columns: at most one focus column.");
      const rows = (t.rows || []).filter((r) => r && !(style === "pitch" && r.style === "muted"));
      const noted = (r) => style === "consulting" && (r.cells || []).some((c) => c && typeof c === "object" && c.note);
      const cost = rows.reduce((sum, r) => sum + (noted(r) ? 1.5 : 1), 0) + (s.takeaway ? 1.5 : 0), budget = style === "pitch" ? 7 : 10.5;
      if (cost > budget) out.errors.push(`table: this table costs ${cost} rows, budget ${budget} for ${style} (row = 1, row with a cell note = 1.5, takeaway = 1.5). Cut rows, drop cell notes or drop the takeaway.`);
      if (s.notes?.length) {
        checkNotes(s, style, out);
        if (s.notes.length > 3) out.errors.push(`notes: ${s.notes.length} notes; beside a table at most 3.`);
        if (n > 4) out.errors.push(`table.columns: ${n} columns; with notes at most 4. Drop a column or the notes.`);
        (t.rows || []).forEach((r, i) => { const c = r?.cells?.[0], v = typeof c === "object" ? c?.value : c;
          if (v && String(v).length > 24) out.errors.push(`table.rows[${i}].cells[0]: ${String(v).length} characters; with notes at most 24.`); });
      }
      break;
    }
    case "steps": {
      if (count(s.steps, "focus") > 1) out.errors.push("steps: at most one step can be focus.");
      if (style === "pitch" && s.takeaway && (s.steps || []).length > 3) out.errors.push(`steps: pitch steps with a takeaway are at most 3 (got ${s.steps.length}).`);
      break;
    }
    case "cards": {
      const cards = s.cards || [];
      if (s.framed) {
        if (cards.length !== 2) out.errors.push(`cards: framed cards come in exactly 2 (got ${cards.length}).`);
        cards.forEach((c, i) => {
          if (!c) return;
          if (!c.label) out.errors.push(`cards[${i}].label: required for framed cards.`);
          if (c.icon || c.value) out.errors.push(`cards[${i}]: framed cards have no icon or value; remove it.`);
          if (c.title && MARKUP_RE.test(c.title)) out.errors.push(`cards[${i}].title: framed titles are plain text.`);
          if (c.title && plain(c.title).length > 14) out.errors.push(`cards[${i}].title: ${plain(c.title).length} characters; framed titles are at most 14 (a 2-word headline).`);
        });
      } else {
        cards.forEach((c, i) => {
          if (!c) return;
          if (!!c.icon === !!c.value) out.errors.push(`cards[${i}]: give exactly one of "icon" or "value".`);
          if (c.label) out.errors.push(`cards[${i}].label: only for framed cards; remove it.`);
          if (c.facts) out.errors.push(`cards[${i}].facts: only for framed cards; remove them.`);
          if (c.icon && !c.bullets && !c.text) out.errors.push(`cards[${i}]: icon cards need "bullets" or "text".`);
        });
        if (count(cards, "icon") && count(cards, "value")) out.errors.push("cards: mix of icons and values; use the same lead on every card.");
        if (cards.filter((c) => c?.tone === "focus").length > 1) out.errors.push("cards: at most one card has tone focus.");
      }
      cards.forEach((c, i) => { if (c?.bullets && c?.text) out.errors.push(`cards[${i}]: give "bullets" or "text", not both.`); });
      if (count(cards, "bullets") && count(cards, "text")) out.errors.push("cards: mix of bullets and text; use the same on every card.");
      // Limits per look: framed cards are wide, value cards set text small, icon cards set it large.
      const look = MENU.cards.variant(s), four = cards.length === 4;
      const textMax = { framed: 50, value: style === "pitch" ? 44 : 80, icon: four ? 30 : 50 }[look];
      const bulletMax = look === "framed" || four ? 48 : 60;
      cards.forEach((c, i) => {
        if (!c) return;
        if (c.text && plain(c.text).length > textMax) out.errors.push(`cards[${i}].text: ${plain(c.text).length} characters; ${look} cards${four ? " in a row of 4" : ""} allow ${textMax}. Shorten it.`);
        (c.bullets || []).forEach((b, j) => { if (plain(b).length > bulletMax) out.errors.push(`cards[${i}].bullets[${j}]: ${plain(b).length} characters; at most ${bulletMax} here.`); });
        if (four && c.bullets && c.bullets.length > 2) out.errors.push(`cards[${i}].bullets: with 4 cards, at most 2 bullets each.`);
        const n = c.bullets ? c.bullets.reduce((sum, b) => sum + plain(b).length, 0) : 0;
        if (look !== "framed" && n > 120) out.errors.push(`cards[${i}].bullets: ${n} characters in total; at most 120. Cut a bullet or shorten them.`);
      });
      break;
    }
  }
  if (MENU[s.template].frame !== false && s.title) {
    const words = plain(s.title).trim().split(/\s+/).length;
    if (style === "consulting" && words < 5) out.warnings.push("title: consulting titles are full-sentence action titles (usually 8–16 words). This reads like a topic.");
    if (style === "pitch" && words > 3) out.warnings.push(`title: ${words} words; a pitch title is the topic in 1–3 words. Move the claim to the subtitle.`);
  }
}

/** Validate one slide for the deck style. */
export function validate(slide, style = "consulting") {
  const out = { errors: [], warnings: [] };
  if (!slide || typeof slide !== "object") return { errors: ["slide: must be an object."], warnings: [] };
  if (!MENU[slide.template]) return { errors: [`template: "${slide.template}" does not exist. Use one of: ${Object.keys(MENU).join(", ")}.`], warnings: [] };
  const fields = fieldsFor(slide.template, style);
  for (const [k, def] of Object.entries(fields)) check(def, slide[k], k, style, out);
  for (const k of Object.keys(slide)) if (k !== "template" && !fields[k]) out.errors.push(`${k}: not a field of "${slide.template}" in ${style}. Allowed: ${Object.keys(fields).join(", ")}.`);
  checkRules(slide, style, out);
  return out;
}

/** Validate a deck: every slide plus deck-level rules. */
export function validateDeck(deck) {
  const out = { errors: [], warnings: [] };
  const slides = deck.slides || [];
  slides.forEach((s, i) => {
    const r = validate(s, deck.style);
    r.errors.forEach((e) => out.errors.push(`slides[${i}].${e}`));
    r.warnings.forEach((w) => out.warnings.push(`slides[${i}].${w}`));
  });
  if (slides.filter((s) => s.template === "cover").length > 1) out.errors.push("slides: only one cover.");
  return out;
}
