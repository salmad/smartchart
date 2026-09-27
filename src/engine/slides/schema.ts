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
import { waterfall } from "./charts/chart-math";
import type { Chart, Series, Slide, Style, TemplateId, Validation } from "../types";

type ByStyle<T> = T | Partial<Record<Style, T>>;
export type FieldType = "text" | "markup" | "number" | "boolean" | "enum" | "list" | "object" | "cell";
export interface FieldDef {
  type: FieldType;
  desc: ByStyle<string>;
  required?: ByStyle<boolean>;
  max?: ByStyle<number>;
  values?: readonly unknown[];
  default?: unknown;
  items?: { min?: ByStyle<number>; max?: ByStyle<number> };
  of?: FieldDef;
  fields?: Record<string, FieldDef>;
  styles?: readonly Style[];
}
/** A field definition resolved for one style (what the agent reads). */
export interface FieldView {
  type: FieldType;
  required?: true;
  maxChars?: number;
  values?: readonly unknown[];
  default?: unknown;
  items?: { min?: number; max?: number };
  desc?: string;
  of?: FieldView;
  fields?: Record<string, FieldView>;
}
export interface MenuEntry {
  summary: string;
  use: string;
  frame?: false;
  fields: Record<string, FieldDef>;
  variant: (s: Slide) => string;
  rules?: string[];
}
export interface StyleGuide { summary: string; rules: string[] }
export interface TemplateCard { template: TemplateId; summary: string; use: string; fields: Record<string, FieldView>; rules: string[] }

export const STYLES: Record<Style, StyleGuide> = {
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
      "Every content slide has a subtitle: the claim in one short sentence, ending with a full stop.",
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
  { syntax: "[-text-]", effect: "negative colour", use: "Rarely: a loss the user named, or when the user asks for red. A problem slide does not need it; [[…]] is the default emphasis." },
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
const f = (type: FieldType, desc: ByStyle<string>, extra: Partial<Omit<FieldDef, "type">> = {}): FieldDef => ({ type, desc, ...extra });
const CONSULTING: readonly Style[] = ["consulting"], PITCH: readonly Style[] = ["pitch"];

/* The frame every content slide shares. It differs by style (spec 3.1). */
const FRAME: Record<string, FieldDef> = {
  kicker: f("text", "Small label above the title. Optional: defaults to the current section name.", { max: 40, styles: CONSULTING }),
  title: f("markup", "", { required: true, max: { consulting: 105, pitch: 20 },
    desc: { consulting: "The action title: a full sentence stating the so-what. At most 2 lines.", pitch: "The topic, 1–3 words: 'Unit economics'. Exactly 1 line. No markup needed." } }),
  subtitle: f("markup", "The claim in one short sentence, ending with a full stop. Required; at most 2 lines.", { required: true, max: 90, styles: PITCH }),
  takeaway: f("markup", "Optional one-line conclusion at the bottom. Must fit on ONE line.", { max: { consulting: 75, pitch: 42 } }),
  footnote: f("markup", "Optional footnote: definitions, caveats, assumptions.", { max: 110 }),
  source: f("markup", "Optional source line, rendered as 'Source: …'. Do not write the prefix.", { max: 110 }),
};

const TONE = f("enum", "Colour of the value. `neg` only for a loss the user named or when they ask for red.", { values: ["focus", "neg", "pos"], default: "focus" });

/* The chart guide (spec 9.1): in the chart card for the agent, and in Jev's mark and stacking questions. */
export const CHART_GUIDE: string[] = [
  "Comparable series share one mark: series that measure the same thing in the same unit (our revenue vs a competitor's, revenue by segment, scenarios) are all bars or all lines.",
  "Bars for sizes, lines for trends: bars compare sizes across categories or a few periods (up to about 6); lines show a trend over many periods (7 or more), forecasts and scenarios.",
  "A different unit can be a line over bars: a series in another unit (a margin % or a growth rate over £m revenue) is a line on its own scale over the bars. At most two units per chart; a third needs another slide.",
  "A reference series can differ: a target, benchmark or average in the same unit may be a dashed line over bars.",
  "Stack only parts of a whole: stack bar series that add up to a total that matters (revenue by segment); keep them side by side when the point is comparing them (us vs them). Never stack rates or percentages that do not sum to a whole; lines never stack.",
  "Pitch: one series, two at most.",
  "Edits keep the rules: when the user switches one series of a comparable group, switch the whole group and say so, unless the user said only that series. A new series in another unit on a bar chart is a line.",
  "Shares of a whole that change over time (mix, market share) are `stacked: \"100\"`: write the raw values; code converts them to %.",
  "A bridge from one total to another (revenue FY24 → FY25 by driver, a cost walk, an EBITDA bridge) is `kind: \"waterfall\"`. Write the start total, then each driver as a signed change, and end with `{ \"label\": \"FY25\", \"total\": true }`: code computes the total. Never write a total you have not checked.",
  "Parallel or overlapping workstreams on a time axis are `kind: \"timeline\"`. A simple sequence of 2–5 phases is the `steps` template instead.",
  "Annotations are computed by code; never write their figure yourself. `cagr` when the title claims a growth rate over a period (\"grows 86% a year\", \"growth rate per year across the period\"; year-on-year rates for each year are a % line instead), `difference` when it claims a gap between two categories, `target` when it compares with a goal. At most 3 (2 with notes); only when the user asked for them.",
];

/* `auto` hands a choice to code (spec 9.1): Jev picks, and the pick comes back in `resolved`. */
const FOCUS = f("enum", "A top-level slide field, next to `title` (never inside `chart`). Write \"auto\" to let code pick and highlight the one item the title is about (a series, column, step or card). Leave it out when the user named the focus, and set it on that item yourself.", { values: ["auto"] });

const KINDS = ["bars", "waterfall", "timeline"] as const;
type Kind = (typeof KINDS)[number];
/* Fields each chart kind uses; any other chart field is an error for that kind. */
export const KIND_FIELDS: Record<Kind, string[]> = {
  bars: ["kind", "stacked", "categories", "format", "series", "annotations"],
  waterfall: ["kind", "format", "items"],
  timeline: ["kind", "periods", "rows", "milestones"],
};
const idx = (what: string) => f("number", `0-based index into ${what}.`);

const CHART = f("object", "A chart. Values are written on the data; there is no y-axis to configure. `kind` sets which fields it takes.", {
  required: true,
  fields: {
    kind: f("enum", "`bars` (default): bar and line series over categories. `waterfall`: a bridge from one total to another. `timeline`: workstreams over periods (a Gantt).", { values: KINDS, default: "bars" }),
    stacked: f("enum", "Bars only. Bar series stacked into one column per category (true), side by side (false), or stacked as shares of 100% (\"100\"). \"auto\": code decides by the chart guide.", { values: [true, false, "100", "auto"], default: false }),
    categories: f("list", "Bars only. X-axis labels, in order. Short: 'Year 1', 'Q2', 'Q1 ’27'.", { items: { min: 2, max: 12 }, of: f("text", "Category label.", { max: 10 }) }),
    format: f("text", "Value format; `{v}` is replaced by the number. E.g. '£{v}m', '{v}%'.", { default: "{v}" }),
    series: f("list", "Bars only. Data series. One series is the focus: the one the title is about.", {
      items: { min: 1, max: 6 },
      of: f("object", "One series.", { fields: {
        name: f("text", "Series name, shown in the legend or end label.", { required: true, max: 24 }),
        values: f("list", "One number per category, same order. Plain numbers, no units.", { required: true, of: f("number", "Value.") }),
        mark: f("enum", "`bar` or `line` for this series. \"auto\": code decides by the chart guide. Write bar or line only when the user named it.", { required: true, values: ["bar", "line", "auto"] }),
        color: f("enum", "`focus`: the series the slide is about. `neutral`: context. `contrast`: a secondary series that must still read clearly. Leave it out when the slide has focus \"auto\".", { values: ["focus", "neutral", "contrast"] }),
        format: f("text", "Overrides the chart format for this series (a % line over £ bars)."),
        area: f("boolean", "Line series in a chart of only lines: shade the area under it. Focus series only.", { default: false }),
        dashed: f("boolean", "Line series only: dashed, for a forecast, a scenario or a reference (target, average).", { default: false }),
      } }),
    }),
    annotations: f("list", "Bars only. Figures code computes and draws on the chart; you never write the figure.", {
      items: { max: 3 },
      of: f("object", "One annotation.", { fields: {
        type: f("enum", "`cagr`: growth rate per period between two categories. `difference`: the change between two categories. `target`: a dashed goal line.", { required: true, values: ["cagr", "difference", "target"] }),
        from: idx("chart.categories (cagr, difference)"),
        to: idx("chart.categories, after `from` (cagr, difference)"),
        series: idx("chart.series, a bar series. Leave it out for the focus series (or the stack total when stacked)"),
        relative: f("boolean", "difference only: show the % change instead of the absolute change.", { default: false }),
        value: f("number", "target only: the goal, in the bars' unit."),
        label: f("text", "target only: the line's name. Default 'Target'.", { max: 16 }),
      } }),
    }),
    items: f("list", "Waterfall only. The start total, the signed changes, then totals. Subtotals may sit in between.", {
      items: { min: 3, max: 10 },
      of: f("object", "One bar of the bridge.", { fields: {
        label: f("text", "Bar label: 'FY24', 'Price', 'FX'.", { required: true, max: 12 }),
        value: f("number", "The first item: the starting total. A change: signed (3.1 or -1.2). A total: leave it out and code computes it."),
        total: f("boolean", "A subtotal or end total: code draws it from zero at the running sum.", { default: false }),
        focus: f("boolean", "Highlight the driver the title is about. At most one.", { default: false }),
      } }),
    }),
    periods: f("list", "Timeline only. Column labels, in order: 'Q1', 'Q2', 'Jan'.", { items: { min: 3, max: 16 }, of: f("text", "Period label.", { max: 8 }) }),
    rows: f("list", "Timeline only. One bar per workstream.", {
      items: { min: 2, max: 8 },
      of: f("object", "One workstream.", { fields: {
        label: f("text", "Workstream name.", { required: true, max: 28 }),
        start: f("number", "0-based index of its first period.", { required: true }),
        end: f("number", "0-based index of its last period (inclusive).", { required: true }),
        focus: f("boolean", "Highlight the workstream the title is about. At most one.", { default: false }),
      } }),
    }),
    milestones: f("list", "Timeline only. Optional diamonds on the time axis.", {
      items: { max: 4 },
      of: f("object", "One milestone.", { fields: {
        label: f("text", "What happens.", { required: true, max: 16 }),
        at: f("number", "0-based index of the period it falls at the end of.", { required: true }),
      } }),
    }),
  },
});

/* Notes are an optional field of chart and table, never a routing decision (D16). */
const notes = (withPoint: boolean) => f("list", "Optional numbered observations beside the chart or table. Add them only if each says something the body does not already show; in pitch, prefer none. Numbers are added automatically.", {
  items: { min: 2, max: 4 },
  of: f("object", "One observation.", { fields: {
    title: f("markup", "The observation as a short headline.", { required: true, max: 28 }),
    text: f("markup", "Optional supporting sentence.", { max: 80, styles: CONSULTING }),
    ...(withPoint ? { point: f("object", "Optional: pin this note's number onto a data point (charts with bars only).", { fields: {
      series: f("number", "0-based index into chart.series.", { required: true }),
      index: f("number", "0-based index into chart.categories.", { required: true }),
    } }) } : {}),
  } }),
});

/* ─────────────── The menu: 7 entries, each a key component ───────────────
   `variant(slide)` is how code picks the internal layout; the agent never sees it. */
export const MENU: Record<TemplateId, MenuEntry> = {
  chart: {
    summary: "A chart with a title: bars and lines, a waterfall (bridge) or a timeline (Gantt); optional numbered notes beside it.",
    use: "Data over categories or time: a trend, a comparison of sizes, a crossover, a bridge between two totals, or overlapping workstreams.",
    fields: { chart: CHART, focus: FOCUS, notes: notes(true) },
    variant: (s) => (s.notes?.length ? "split" : "full"),
    rules: ["With notes: at most 6 categories (7 waterfall items; a timeline takes 8 periods and 4 workstreams of up to 20 characters).", "`notes[].point` only works on a bars chart with bar series.", "At most 3 notes when any note has text, and at most 3 in pitch.", ...CHART_GUIDE],
  },
  table: {
    summary: "A typeset table with optional sub-notes under values and a total row; optional notes beside it.",
    use: "Exact figures the reader needs to compare across rows.",
    fields: {
      table: f("object", "The table.", { required: true, fields: {
        columns: f("list", "Column headers, left to right. The first column is usually the row label.", { required: true, items: { min: 2, max: 5 }, of: f("object", "Column.", { fields: {
          label: f("text", "Header text. The first (label) column's header may be left out.", { max: 26 }),
          focus: f("boolean", "Highlight this column. At most one.", { default: false }),
        } }) }),
        rows: f("list", "Rows, top to bottom.", { required: true, items: { min: 1, max: 8 }, of: f("object", "Row.", { fields: {
          cells: f("list", "One cell per column. A string, or { value, note } for a small note under the value.", { required: true, of: f("cell", "Cell.", { max: 40 }) }),
          style: f("enum", "`muted`: a context row, hidden in pitch. `total`: the bottom line, drawn with a rule above.", { values: ["muted", "total"] }),
        } }) }),
      } }),
      focus: FOCUS,
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
      focus: FOCUS,
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
        icon: f("enum", "Icon lead: an icon from the curated set, or \"auto\" to let code pick one from the card's text. Not with `value` or `framed`.", { values: [...ICONS, "auto"] }),
        value: f("text", "Value lead: a big number with its unit, e.g. '5 min', '19%'. Not with `icon` or `framed`.", { max: 6 }),
        label: f("text", "Framed only: who or what this case is, e.g. 'Credit-only lenders'.", { max: 30 }),
        title: f("markup", "Card title. Framed: a big 2-word headline, plain text.", { required: true, max: { consulting: 24, pitch: 22 } }),
        bullets: f("list", "1–3 bullets. Not with `text`.", { items: { min: 1, max: 3 }, of: f("markup", "Bullet.", { max: 60 }), styles: CONSULTING }),
        text: f("markup", "One short line. Not with `bullets`. Value cards: one sentence of context.", { max: { consulting: 80, pitch: 50 } }),
        tone: f("enum", "`focus`: the card the title is about. `neg`: only the losing case in a two-card contrast, or when the user asks for red. `neutral`: the rest.", { values: ["neutral", "focus", "neg"], default: "neutral" }),
        facts: f("list", "Framed only, optional: up to 2 labelled facts at the bottom of the card.", { items: { min: 1, max: 2 }, styles: CONSULTING, of: f("object", "Fact.", { fields: {
          label: f("text", "Short label: 'Outcome', 'Proof'.", { required: true, max: 14 }),
          text: f("markup", "The fact.", { required: true, max: 38 }),
        } }) }),
      } }) }),
      focus: FOCUS,
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
      title: f("text", "Section name, 1–3 words: 'The problem', 'Business model'. Exactly 1 line.", { required: true, max: { consulting: 24, pitch: 14 } }),
      subtitle: f("markup", "Optional: the one-sentence answer this section will prove.", { max: { consulting: 110, pitch: 60 } }),
    },
    variant: () => "section",
    rules: ["Sections are numbered automatically. Do not put numbers in the title."],
  },
};

/* The picking guide (spec 9.2): used by the router prompt and when Jev is unsure. */
export const PICKING_GUIDE: [string, TemplateId][] = [
  ["the first slide of a deck", "cover"],
  ["the start of a new part in a deck of 8+ slides", "section"],
  ["one number that proves the argument (a size, a cost, a gap)", "number"],
  ["data over categories or time (a series): a trend, a comparison of sizes, a crossover; a bridge between two totals; workstreams overlapping in time", "chart"],
  ["exact figures the reader needs to compare", "table"],
  ["a sequence in time: plan, roadmap, process, history (2–5 steps)", "steps"],
  ["2–4 parallel things: options, pillars, features, several independent numbers, or a two-way contrast", "cards"],
];

/* ─────────────── Resolving fields for one style ─────────────── */

const isStyleMap = <T>(v: ByStyle<T>): v is Partial<Record<Style, T>> =>
  !!v && typeof v === "object" && !Array.isArray(v) && ("consulting" in v || "pitch" in v);
const byStyle = <T>(v: ByStyle<T> | undefined, style: Style): T | undefined => (v !== undefined && isStyleMap(v) ? v[style] : (v as T | undefined));
const inStyle = (def: FieldDef, style: Style) => !def.styles || def.styles.includes(style);

/** Own keys only, so "constructor" or "toString" is never a template. */
export const isTemplate = (id: unknown): id is TemplateId => typeof id === "string" && Object.hasOwn(MENU, id);

/** The fields of one entry for one style: frame + body, with style-only fields removed. */
export function fieldsFor(id: string, style: Style): Record<string, FieldDef> {
  const entry = isTemplate(id) ? MENU[id] : undefined;
  if (!entry) throw new Error(`Unknown template "${id}". Known: ${Object.keys(MENU).join(", ")}`);
  const all = entry.frame === false ? entry.fields : { ...FRAME, ...entry.fields };
  return Object.fromEntries(Object.entries(all).filter(([, d]) => inStyle(d, style)));
}

/** One line per entry: what the router and planning prompt see. */
export function catalogue(): string {
  return Object.entries(MENU).map(([id, t]) => `${id}: ${t.summary} Use when: ${t.use}`).join("\n");
}

/** A field definition resolved for one style: plain numbers, no style maps. */
function view(def: FieldDef, style: Style): FieldView {
  const out: FieldView = { type: def.type };
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
export function describe(id: TemplateId, style: Style = "consulting"): TemplateCard {
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

export const plain = (s: unknown): string => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(.+?)\]\]/g, "$1").replace(/\[-(.+?)-\]/g, "$1").replace(/\[\+(.+?)\+\]/g, "$1");
const MARKUP_RE = /\*\*|\[\[|\]\]|\[-|-\]|\[\+|\+\]/;

type Out = Validation;
/** Fields of an object value the validator walks; the value is unvalidated input. */
const fieldsOf = (v: object) => v as Record<string, unknown>;
const cellOf = (v: unknown) => (typeof v === "object" && v !== null ? v : { value: v }) as { value?: unknown; note?: unknown };

function check(def: FieldDef, value: unknown, path: string, style: Style, out: Out): void {
  if (value === undefined || value === null || value === "") {
    if (byStyle(def.required, style)) out.errors.push(`${path}: required. ${byStyle(def.desc, style)}`);
    return;
  }
  const max = byStyle(def.max, style);
  switch (def.type) {
    case "text":
    case "markup": {
      if (typeof value !== "string") { out.errors.push(`${path}: must be a string.`); return; }
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
      if (!def.values?.includes(value)) out.errors.push(`${path}: "${String(value)}" is not allowed. Use one of: ${def.values?.join(", ")}.`);
      break;
    case "cell": {
      const v = cellOf(value);
      if (typeof v.value !== "string" && typeof v.value !== "number") out.errors.push(`${path}: a cell is a string or { "value": "…", "note": "…" }.`);
      else if (max && String(v.value).length > max) out.errors.push(`${path}: ${String(v.value).length} characters, limit ${max}.`);
      if (v.note !== undefined && String(v.note).length > 32) out.errors.push(`${path}.note: limit is 32 characters.`);
      break;
    }
    case "list": {
      if (!Array.isArray(value)) { out.errors.push(`${path}: must be a list.`); return; }
      const min = byStyle(def.items?.min, style), maxItems = byStyle(def.items?.max, style);
      if (min && value.length < min) out.errors.push(`${path}: needs at least ${min} items (got ${value.length}).`);
      if (maxItems && value.length > maxItems) out.errors.push(`${path}: at most ${maxItems} items (got ${value.length}). Cut or merge.`);
      const of = def.of;
      if (!of) break;
      value.forEach((item: unknown, i) => {
        // A list of numbers has no gaps: a chart draws every value, and a missing one cannot be drawn.
        if (of.type === "number" && (item === null || item === undefined)) return out.errors.push(`${path}[${i}]: missing; every category needs a number. For a single goal or plan figure, use an annotation { "type": "target", "value": … } instead of a series.`);
        check(of, item, `${path}[${i}]`, style, out);
      });
      break;
    }
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) { out.errors.push(`${path}: must be an object.`); return; }
      const all = def.fields ?? {};
      const fields = Object.fromEntries(Object.entries(all).filter(([, d]) => inStyle(d, style)));
      const obj = fieldsOf(value);
      for (const [k, sub] of Object.entries(fields)) check(sub, obj[k], `${path}.${k}`, style, out);
      for (const k of Object.keys(obj)) if (!fields[k]) out.errors.push(`${path}.${k}: not a field here${all[k] ? ` in ${style}` : ""}. Allowed: ${Object.keys(fields).join(", ")}.`);
      break;
    }
  }
}

const fmtOf = (c: Chart, s?: Series) => s?.format || c.format || "{v}";
const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);

/* The rule checks below run after the field checks, on input that may still be
   malformed (a null series, a missing list), so they guard every access. */
function checkChart(c: Chart | undefined, path: string, out: Out, focusAuto: boolean): void {
  if (!c || typeof c !== "object") return;
  const kind = c.kind || "bars";
  if (!isKind(kind)) return;
  const chartFields = CHART.fields ?? {};
  for (const k of Object.keys(c)) if (!KIND_FIELDS[kind].includes(k) && chartFields[k])
    out.errors.push(`${path}.${k}: not used by kind "${kind}". Remove it${kind === "bars" ? "" : `; a ${kind} takes ${KIND_FIELDS[kind].filter((x) => x !== "kind").join(", ")}`}.`);
  if (c.format && !String(c.format).includes("{v}")) out.errors.push(`${path}.format: must contain {v}, e.g. "£{v}m".`);
  if (kind === "waterfall") return checkWaterfall(c, path, out);
  if (kind === "timeline") return checkTimeline(c, path, out);
  if (!Array.isArray(c.categories)) out.errors.push(`${path}.categories: required. X-axis labels, in order.`);
  if (!Array.isArray(c.series)) out.errors.push(`${path}.series: required. Data series.`);
  if (!Array.isArray(c.series) || !Array.isArray(c.categories)) return;
  const categories = c.categories, series = c.series;
  const bars = series.filter((s) => s?.mark === "bar");
  series.forEach((s, i) => {
    if (Array.isArray(s?.values) && s.values.length !== categories.length)
      out.errors.push(`${path}.series[${i}].values: ${s.values.length} values, but there are ${categories.length} categories. Give exactly one value per category.`);
    if (s?.mark === "bar" && (s.area || s.dashed)) out.errors.push(`${path}.series[${i}]: \`area\` and \`dashed\` are only for line series.`);
    if (s?.area && bars.length) out.errors.push(`${path}.series[${i}].area: only when every series is a line.`);
  });
  if (bars.length > 3) out.errors.push(`${path}.series: at most 3 bar series (got ${bars.length}). Cut or merge.`);
  const names = series.map((s) => s?.name), dup = names.find((x, i) => x && names.indexOf(x) !== i);
  if (dup) out.errors.push(`${path}.series: two series are named "${dup}"; each series needs its own name (the legend and colours follow it).`);
  const formats = new Set(series.map((s) => fmtOf(c, s)));
  if (formats.size > 2) out.errors.push(`${path}.series: ${formats.size} units (${[...formats].join(", ")}); a chart shows at most 2. Move the third to another slide.`);
  if (series.length && series.every((s) => s?.mark === "line") && formats.size > 1)
    out.errors.push(`${path}.series: a chart of only lines shares one scale, so every series uses one format. Make one unit bars, or plot it on another slide.`);
  if ((c.stacked === true || c.stacked === "100") && (bars.length < 2 || new Set(bars.map((s) => fmtOf(c, s))).size > 1))
    out.errors.push(`${path}.stacked: stacking needs 2 or more bar series in one unit. Set it to false.`);
  const focus = series.filter((s) => s?.color === "focus").length;
  if (!focusAuto && focus !== 1) out.warnings.push(`${path}.series: ${focus} series are "focus"; exactly one should be.`);
  checkAnnotations(c, categories, series, series.filter((s) => s?.mark !== "line"), path, out);
}

function checkAnnotations(c: Chart, categories: string[], series: Series[], bars: Series[], path: string, out: Out): void {
  const n = categories.length, inRange = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  (c.annotations || []).forEach((a, i) => {
    if (!a || !a.type) return;
    const at = `${path}.annotations[${i}]`;
    if (!bars.length) return out.errors.push(`${at}: annotations need a bar series; this chart has only lines.`);
    if (a.type === "target") {
      if (typeof a.value !== "number") out.errors.push(`${at}.value: required for a target (the goal, in the bars' unit).`);
      for (const k of ["from", "to", "series", "relative"] as const) if (a[k] !== undefined) out.errors.push(`${at}.${k}: not used by a target; remove it.`);
      return;
    }
    for (const k of ["value", "label"] as const) if (a[k] !== undefined) out.errors.push(`${at}.${k}: only for a target; remove it.`);
    const { from, to } = a;
    if (!inRange(from) || !inRange(to)) return out.errors.push(`${at}: \`from\` and \`to\` must be category indices 0–${n - 1} (got ${from}, ${to}).`);
    if (from >= to) out.errors.push(`${at}: \`from\` (${from}) must come before \`to\` (${to}).`);
    if (a.series !== undefined && (!series[a.series] || series[a.series].mark === "line")) out.errors.push(`${at}.series: ${a.series} is not a bar series. Point at a bar series or leave it out.`);
    if (a.relative && a.type !== "difference") out.errors.push(`${at}.relative: only for a difference; remove it.`);
    if (a.type === "cagr") {
      const s = a.series !== undefined ? series[a.series] : c.stacked === true ? null : bars.find((x) => x.color === "focus") || bars[0];
      const v = s ? [s.values?.[from], s.values?.[to]] : [from, to].map((j) => bars.reduce((sum, x) => sum + (x.values?.[j] || 0), 0));
      if (!(Number(v[0]) > 0 && Number(v[1]) > 0)) out.errors.push(`${at}: a CAGR needs positive values at both ends (got ${v.join(" and ")}). Use a difference instead.`);
    }
  });
  if (c.stacked === "100" && (c.annotations || []).some((a) => a?.type !== undefined)) out.errors.push(`${path}.annotations: not on a 100% stacked chart (the bars are shares, not values).`);
}

function checkWaterfall(c: Chart, path: string, out: Out): void {
  if (!Array.isArray(c.items)) { out.errors.push(`${path}.items: required. The start total, the signed changes, then the end total.`); return; }
  waterfall(c.items, `${path}.items`).errors.forEach((e) => out.errors.push(e));
  if (c.items.length && !c.items.at(-1)?.total) out.warnings.push(`${path}.items: the last item is a change; a bridge usually ends with a total ({ "label": "…", "total": true }).`);
  if (count(c.items, "focus") > 1) out.errors.push(`${path}.items: at most one focus item.`);
}

function checkTimeline(c: Chart, path: string, out: Out): void {
  if (!Array.isArray(c.periods)) out.errors.push(`${path}.periods: required. Column labels, in order.`);
  if (!Array.isArray(c.rows)) out.errors.push(`${path}.rows: required. One bar per workstream.`);
  if (!Array.isArray(c.periods) || !Array.isArray(c.rows)) return;
  const n = c.periods.length, ok = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  c.rows.forEach((r, i) => {
    if (!r) return;
    if (!ok(r.start) || !ok(r.end)) out.errors.push(`${path}.rows[${i}]: \`start\` and \`end\` must be period indices 0–${n - 1} (got ${r.start}, ${r.end}).`);
    else if (r.start > r.end) out.errors.push(`${path}.rows[${i}]: \`start\` (${r.start}) is after \`end\` (${r.end}).`);
  });
  (c.milestones || []).forEach((m, i) => { if (m && !ok(m.at)) out.errors.push(`${path}.milestones[${i}].at: must be a period index 0–${n - 1} (got ${m.at}).`); });
  if (count(c.rows, "focus") > 1) out.errors.push(`${path}.rows: at most one focus row.`);
}

const count = <T extends object>(list: readonly (T | null | undefined)[] | undefined, key: keyof T) => (list || []).filter((x) => x && x[key]).length;

function checkNotes(s: Slide, style: Style, out: Out): void {
  const list = s.notes || [];
  if (list.length > 3 && (style === "pitch" || list.some((n) => n?.text))) out.errors.push(`notes: ${list.length} notes; at most 3 when notes have text${style === "pitch" ? " or in pitch" : ""}. Merge or cut the weakest.`);
  const textLen = list.reduce((sum, n) => sum + (n?.text ? plain(n.text).length : 0), 0);
  if (s.takeaway && textLen > 200) out.errors.push(`notes[].text: ${textLen} characters in total; with a takeaway the limit is 200. Shorten the notes or drop the takeaway.`);
}

function checkRules(s: Slide, style: Style, out: Out): void {
  switch (s.template) {
    case "chart": {
      checkChart(s.chart, "chart", out, s.focus === "auto");
      if (!s.notes?.length) break;
      checkNotes(s, style, out);
      const kind = s.chart?.kind || "bars", cats = s.chart?.categories || [], series = s.chart?.series || [];
      const items = s.chart?.items || [], periods = s.chart?.periods || [], rows = s.chart?.rows || [], annotations = s.chart?.annotations || [];
      if (kind === "waterfall" && items.length > 7) out.errors.push(`chart.items: ${items.length} items; with notes at most 7. Drop notes or merge small drivers.`);
      if (kind === "timeline" && periods.length > 8) out.errors.push(`chart.periods: ${periods.length} periods; with notes at most 8. Drop notes or use wider periods.`);
      if (kind === "timeline" && rows.length > 4) out.errors.push(`chart.rows: ${rows.length} workstreams; with notes at most 4. Drop notes or merge workstreams.`);
      if (kind === "timeline") rows.forEach((r, i) => { if (r?.label && r.label.length > 20) out.errors.push(`chart.rows[${i}].label: ${r.label.length} characters; with notes at most 20. Shorten it.`); });
      if (kind === "bars" && cats.length > 6) out.errors.push(`chart.categories: ${cats.length} categories; with notes at most 6. Drop notes or group categories.`);
      if (kind === "bars" && annotations.length > 2) out.errors.push(`chart.annotations: ${annotations.length}; with notes at most 2.`);
      s.notes.forEach((n, i) => {
        if (!n?.point) return;
        if (kind !== "bars" || series.every((x) => x?.mark === "line")) return out.errors.push(`notes[${i}].point: points only work on a bars chart with bar series; remove it.`);
        if (!(n.point.series >= 0 && n.point.series < series.length)) out.errors.push(`notes[${i}].point.series: ${n.point.series} is out of range; the chart has ${series.length} series (0–${series.length - 1}).`);
        if (!(n.point.index >= 0 && n.point.index < cats.length)) out.errors.push(`notes[${i}].point.index: ${n.point.index} is out of range; the chart has ${cats.length} categories (0–${cats.length - 1}).`);
      });
      break;
    }
    case "table": {
      const t: Partial<NonNullable<Slide["table"]>> = s.table || {}, n = (t.columns || []).length;
      (t.rows || []).forEach((r, i) => {
        if (Array.isArray(r?.cells) && r.cells.length !== n) out.errors.push(`table.rows[${i}].cells: ${r.cells.length} cells, but there are ${n} columns. Use "—" for an empty cell.`);
      });
      if (count(t.columns, "focus") > 1) out.errors.push("table.columns: at most one focus column.");
      (Array.isArray(t.columns) ? t.columns : []).forEach((c, j) => { if (j > 0 && c && !c.label) out.errors.push(`table.columns[${j}].label: required. Header text.`); });
      const rows = (t.rows || []).filter((r) => r && !(style === "pitch" && r.style === "muted"));
      const noted = (r: (typeof rows)[number]) => style === "consulting" && (r.cells || []).some((c) => c && typeof c === "object" && c.note);
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
      if (style === "pitch" && s.takeaway && (s.steps || []).length > 3) out.errors.push(`steps: pitch steps with a takeaway are at most 3 (got ${s.steps?.length}).`);
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
      const textMax = ({ framed: 50, value: style === "pitch" ? 44 : 80, icon: four ? 30 : 50 } as Record<string, number>)[look];
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
  const spans = (String(s.title || "").match(/\[\[.+?\]\]/g) || []).length;
  if (spans > 1) out.warnings.push(`title: ${spans} focus spans; highlight at most one phrase with [[…]].`);
  if (MENU[s.template].frame !== false && s.title) {
    const words = plain(s.title).trim().split(/\s+/).length;
    if (style === "consulting" && words < 5) out.warnings.push("title: consulting titles are full-sentence action titles (usually 8–16 words). This reads like a topic.");
    if (style === "pitch" && words > 3) out.warnings.push(`title: ${words} words; a pitch title is the topic in 1–3 words. Move the claim to the subtitle.`);
  }
}

/** Validate one slide for the deck style. The slide is unvalidated input (usually model output). */
export function validate(slide: unknown, style: Style = "consulting"): Validation {
  const out: Out = { errors: [], warnings: [] };
  if (!slide || typeof slide !== "object") return { errors: ["slide: must be an object."], warnings: [] };
  const obj = fieldsOf(slide);
  if (!isTemplate(obj.template)) return { errors: [`template: "${String(obj.template)}" does not exist. Use one of: ${Object.keys(MENU).join(", ")}.`], warnings: [] };
  const fields = fieldsFor(obj.template, style);
  for (const [k, def] of Object.entries(fields)) check(def, obj[k], k, style, out);
  for (const k of Object.keys(obj)) if (k !== "template" && !fields[k]) out.errors.push(`${k}: not a field of "${obj.template}" in ${style}. Allowed: ${Object.keys(fields).join(", ")}.`);
  // The field checks above reported any shape problems; the rule checks guard their own access.
  checkRules(slide as Slide, style, out);
  return out;
}

/** Validate a deck: every slide plus deck-level rules. */
export function validateDeck(deck: { style: Style; slides?: readonly Slide[] }): Validation {
  const out: Out = { errors: [], warnings: [] };
  const slides = deck.slides || [];
  slides.forEach((s, i) => {
    const r = validate(s, deck.style);
    r.errors.forEach((e) => out.errors.push(`slides[${i}].${e}`));
    r.warnings.forEach((w) => out.warnings.push(`slides[${i}].${w}`));
  });
  if (slides.filter((s) => s.template === "cover").length > 1) out.errors.push("slides: only one cover.");
  return out;
}

/* Shapes saved before the 2026-09-27 chart change. */
type LegacyChart = Omit<Chart, "series"> & { type?: string; series?: (Series & { line?: boolean })[] };
type LegacyColumn = { label?: string; focus?: boolean; num?: unknown };

/** Slides saved before the 2026-09-27 chart change: chart.type and series.line become marks; table columns lose `num`. */
export function upgrade(slide: Slide): Slide {
  const s = structuredClone(slide), c: LegacyChart | undefined = s.chart;
  if (c?.type) {
    (c.series || []).forEach((x) => { x.mark = c.type === "lines" || x.line ? "line" : "bar"; delete x.line; });
    if (c.type === "bars") c.stacked = false;
    delete c.type;
  }
  (s.table?.columns || []).forEach((col: LegacyColumn) => delete col.num);
  return s;
}
