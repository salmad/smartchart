/* ═══════════════════════════════════════════════════════════════════════════
   Slide system v5: the contract between the agent and the renderer.

   The agent picks ONE entry from a flat menu of templates and writes fields
   named after the content: { "template": "<id>", ...fields }. It never sees
   layouts, areas or block kinds; code picks the layout variant from the
   content (a chart with notes becomes a split). See the spec, sections 3.4–3.5.

   Fields can be limited to one style (`styles`). Limits are { consulting, pitch }
   or a number. Prototype limits are hand-tuned and proven by the stress deck;
   the product computes them from geometry (spec 4.3).
   ═══════════════════════════════════════════════════════════════════════════ */
import { timelineLines } from "./charts/timeline-rows.js";
import { waterfall } from "./charts/chart-math.js";
import { markKinds, markOf } from "./marks.js";
import { groupLayout, roomOf } from "./groups.js";
import { iconsMayStack } from "./head-icons.js";
import { columnAlign } from "./align.js";
import { CAPABILITIES, SHAPES } from "./capabilities.js";
import type { Capability, Shape } from "./capabilities.js";
import type { Cell, Chart, Half, Series, Slide, Style, Table, TemplateId, Validation } from "../types.js";

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
  capabilities?: Capability[];
  shapes?: Shape[];
}
export type { Capability, Shape } from "./capabilities.js";
export interface StyleGuide { summary: string; rules: string[] }
export interface TemplateCard { template: TemplateId; summary: string; use: string; fields: Record<string, FieldView>; rules: string[]; capabilities?: Omit<Capability, "styles">[]; shapes?: Shape[] }

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
      "One idea per slide. Prefer a big figure over a paragraph. Cut every word that does not change the meaning.",
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
  { syntax: "[-text-]", effect: "negative colour", use: "Rarely: a loss the user named, or when the user asks for red. Never in a title or subtitle unless the user asks. A problem slide does not need it; [[…]] is the default emphasis." },
  { syntax: "[+text+]", effect: "positive colour", use: "Rarely: a gain the user named, or when the user asks for green. Never in a title or subtitle unless the user asks; [[…]] is the default emphasis." },
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
  subtitle: f("markup", "The claim in one short sentence, ending with a full stop. Required; one line.", { required: true, max: 60, styles: PITCH }),
  takeaway: f("markup", "Optional one-line conclusion at the bottom. Must fit on ONE line.", { max: { consulting: 75, pitch: 42 } }),
  footnote: f("markup", "Optional footnote: definitions, caveats, assumptions.", { max: 110 }),
  source: f("markup", "Optional source line, rendered as 'Source: …'. Do not write the prefix.", { max: 110 }),
};

const TONE = f("enum", "Colour of the value. `focus` by default; `neg` or `pos` only for a loss or gain the user named, or when they ask for red or green.", { values: ["focus", "neg", "pos"], default: "focus" });

/* The chart guide (spec 9.1): in the chart card for the agent, and in Jev's mark and stacking questions. */
export const CHART_GUIDE: string[] = [
  "Comparable series share one mark: series that measure the same thing in the same unit (our revenue vs a competitor's, revenue by segment, scenarios) are all bars or all lines.",
  "Bars for sizes, lines for trends: bars compare sizes across categories or a few periods (up to about 6); lines show a trend over many periods (7 or more), forecasts and scenarios.",
  "A different unit can be a line over bars: a series in another unit (a margin % or a growth rate over £m revenue) is a line on its own scale over the bars. At most two units per chart; a third needs another slide.",
  "A reference series can differ: a target, benchmark or average in the same unit may be a dashed line over bars.",
  "Stack only parts of a whole: stack bar series that add up to a total that matters (revenue by segment); keep them side by side when the point is comparing them (us vs them). Never stack rates or percentages that do not sum to a whole; lines never stack.",
  "Pitch: one series, two at most.",
  "Edits keep the rules: when the user switches one series of a comparable group, switch the whole group and say so, unless the user said only that series. A new series in another unit on a bar chart is a line.",
  "Shares of a whole that change over time (mix, market share) are `stacking: \"percent\"`: write the raw values; code converts them to %.",
];

/* `auto` hands a choice to code (spec 9.1): Jev picks, and the pick comes back in `resolved`. */
const FOCUS = f("enum", "A top-level slide field, next to `title` (never inside `chart`). Write \"auto\" to let code pick and highlight the one item the title is about (a series, column, step or card). Leave it out when the user named the focus, and set it on that item yourself.", { values: ["auto"] });

const KINDS = ["bars", "waterfall", "timeline", "ranked", "matrix"] as const;
type Kind = (typeof KINDS)[number];
/* Fields each chart kind uses; any other chart field is an error for that kind. */
export const KIND_FIELDS: Record<Kind, string[]> = {
  bars: ["kind", "stacking", "categories", "format", "series", "annotations"],
  waterfall: ["kind", "format", "items"],
  timeline: ["kind", "periods", "rows", "milestones"],
  ranked: ["kind", "format", "ranking"],
  matrix: ["kind", "axes", "quadrants", "points"],
};
const idx = (what: string) => f("number", `0-based index into ${what}.`);

const CHART = f("object", "A chart. Values are written on the data; there is no y-axis to configure. `kind` sets which fields it takes.", {
  required: true,
  fields: {
    kind: f("enum", "`bars` (default): bar and line series over categories. `waterfall`: a bridge from one total to another. `timeline`: workstreams over periods (a Gantt). `ranked`: horizontal bars by named item. `matrix`: a 2×2.", { values: KINDS, default: "bars" }),
    stacking: f("enum", "Bars only. \"stacked\": bar series stacked into one column per category; \"none\": side by side; \"percent\": stacked as shares of 100%. \"auto\": code decides by the chart guide.", { values: ["none", "stacked", "percent", "auto"], default: "none" }),
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
        tone: f("enum", "A change only, and only when the user asks for red or green: `neg` or `pos`. Steps are grey by default; the focus carries the colour.", { values: ["neg", "pos"] }),
      } }),
    }),
    periods: f("list", "Timeline only. Column labels, in order: 'Q1', 'Q2', 'Jan'.", { items: { min: 3, max: 16 }, of: f("text", "Period label.", { max: 8 }) }),
    rows: f("list", "Timeline only. One bar per workstream. A workstream made of smaller steps is a group: give the steps `level: 1` directly after it and leave the group's own `start` and `end` out (it spans its steps).", {
      items: { min: 2, max: 12 },
      of: f("object", "One workstream or step.", { fields: {
        label: f("text", "Workstream name.", { required: true, max: 28 }),
        level: f("number", "`1` makes this a step of the nearest workstream above it. Leave out for a workstream.", { default: 0 }),
        start: f("number", "0-based index of its first period. Not on a group."),
        end: f("number", "0-based index of its last period (inclusive). Not on a group."),
        focus: f("boolean", "Highlight the workstream the title is about. At most one.", { default: false }),
      } }),
    }),
    milestones: f("list", "Timeline only. Optional diamonds on the time axis.", {
      items: { max: 6 },
      of: f("object", "One milestone.", { fields: {
        label: f("text", "What happens.", { required: true, max: 16 }),
        at: f("number", "0-based index of the period it falls at the end of.", { required: true }),
      } }),
    }),
    ranking: f("list", "Ranked only. Largest first.", {
      items: { min: 2, max: 8 },
      of: f("object", "Item.", { fields: {
        label: f("text", "Label.", { required: true, max: 30 }),
        value: f("number", "0 or more.", { required: true }),
        focus: f("boolean", "The item the title is about. At most one."),
      } }),
    }),
    axes: f("object", "Matrix only. Axis names, low to high.", { fields: {
      x: f("text", "Horizontal.", { required: true, max: 16 }),
      y: f("text", "Vertical.", { required: true, max: 16 }),
    } }),
    quadrants: f("list", "Matrix only, optional: top left, top right, bottom left, bottom right.", {
      items: { min: 4, max: 4 }, of: f("text", "Quadrant name.", { max: 16 }),
    }),
    points: f("list", "Matrix only.", {
      items: { min: 2, max: 8 },
      of: f("object", "Point.", { fields: {
        label: f("text", "Name.", { required: true, max: 20 }),
        x: f("number", "0–100, left to right.", { required: true }),
        y: f("number", "0–100, bottom to top.", { required: true }),
        focus: f("boolean", "The point the title is about. At most one."),
      } }),
    }),
  },
});

/* Half a slide's chart (the pair): only the kinds that read at half width, so the card offers nothing it refuses. */
const HALF = ["kind", "stacking", "categories", "format", "series", "items", "ranking"];
const HALF_CHART = f("object", "A chart for half the slide.", { fields: {
  ...Object.fromEntries(HALF.map((k) => [k, CHART.fields?.[k] as FieldDef])),
  kind: f("enum", "`bars` (default): bar and line series over categories. `waterfall`: a bridge between two totals. `ranked`: horizontal bars by named item.", { values: ["bars", "waterfall", "ranked"], default: "bars" }),
} });

/* An exhibit caption over a chart or table, and an optional heading over its notes. */
const CAPTION = f("text", "What the chart or table shows, stated plainly: the measure, its scope and period, then ' · ' and the unit. 'Annual recurring revenue, FY25–FY26 · £m', 'SME cards compared'. One line. Consulting: always write one. Pitch: leave it out unless the user asks.", { max: 48 });
const NOTES_TITLE = f("text", "A one- or two-word heading over the notes: 'Notes', 'What drives it'. Only when the user asks for it; never by default. Not with a takeaway.", { max: 20 });

/* Notes are an optional field of chart and table, never a routing decision (D16). */
/** Note numbers pinned on the chart's data points. Off for now: the circles read as clutter on the bars. */
export const NOTE_POINTS = false;
const notes = (withPoint: boolean) => f("list", "Optional numbered observations beside the chart or table: 3, or none. Numbered automatically.", {
  items: { min: 2, max: 4 },
  of: f("object", "One observation.", { fields: {
    title: f("markup", "The observation as a short headline.", { required: true, max: 28 }),
    text: f("markup", "Optional supporting sentence.", { max: 120, styles: CONSULTING }),
    ...(withPoint ? { point: f("object", "Optional: pin this note's number onto a data point (charts with bars only).", { fields: {
      series: f("number", "0-based index into chart.series.", { required: true }),
      index: f("number", "0-based index into chart.categories.", { required: true }),
    } }) } : {}),
  } }),
});

/* Table pieces, shared by the table template and a half table in the pair. */
const COLUMN_FIELDS = {
  label: f("text", "Header text. The first (label) column's header may be left out.", { max: 26 }),
  focus: f("boolean", "Highlight this column. Not with `muted`.", { default: false }),
  muted: f("boolean", "A quieter column, for context. Not with `focus`.", { default: false }),
};
const TABLE_COLUMN = f("object", "Column.", { fields: {
  ...COLUMN_FIELDS,
  icon: f("enum", "Optional icon over the header, from the curated set: on every column after the first, or none.", { values: ICONS }),
  bold: f("boolean", "Set the whole column in bold.", { default: false }),
  italic: f("boolean", "Set the whole column in italic.", { default: false }),
} });
const TABLE_CELLS = f("list", "One cell per column. A string (it may use the inline markup: **bold**, [[focus]] to highlight one cell), or an object: { value, note } puts a small note under the value; { value?, bullets } adds 1–3 short bullets explaining the position; { value, status: true } draws a status label (Live, Pilot). A score is a cell holding only a mark: a Harvey ball ○ ◔ ◑ ◕ ● (none to full), or ✓ / ✗; a mark may take a note. A group row has one cell: its heading.", { required: true, of: f("cell", "Cell.", { max: 40 }) });

/* A small table for half a slide: no icons, no group headings, no bullets in cells (checked in checkGrid). */
const HALF_TABLE = f("object", "A small table for half the slide: 2–3 columns, at most 5 rows. Marks, cell notes and status labels work; bullets, icons and group headings do not.", { fields: {
  columns: f("list", "Column headers, left to right.", { required: true, items: { min: 2, max: 3 }, of: f("object", "Column.", { fields: COLUMN_FIELDS }) }),
  rows: f("list", "Rows, top to bottom.", { required: true, items: { min: 1, max: 5 }, of: f("object", "Row.", { fields: {
    cells: TABLE_CELLS,
    style: f("enum", "`muted`: context, hidden in pitch. `total`: the bottom line.", { values: ["muted", "total"] }),
    focus: f("boolean", "Highlight this row.", { default: false }),
  } }) }),
} });
/** Halves other than charts (a table, a number, points). Off for now: a chart beside a table or a number reads
    unbalanced, so agents see only two-chart pairs until the layout is fixed. The renderer and editor keep them. */
export const MIXED_HALVES = false;
type HalfBody = "chart" | "table" | "number" | "points";
export const HALF_BODIES: readonly HalfBody[] = MIXED_HALVES ? ["chart", "table", "number", "points"] : ["chart"];
const MIXED_NUMBER = f("object", "A big figure and what it means.", { fields: {
  value: f("text", "The number with its unit: '£3.6bn', '7%'.", { required: true, max: 7 }),
  caption: f("markup", "What it means, as one sentence.", { required: true, max: 80 }),
  tone: TONE,
} });
const MIXED_POINTS = f("list", "2–4 short points; a **bold** lead-in is allowed.", { items: { min: 2, max: 4 }, of: f("markup", "Point.", { max: 70 }) });

/* How to write each chart kind: enforced or mechanical, so rules. When to choose one is in the chart's capabilities. */
const CHART_KINDS = [
  "Waterfall: write the start total, then each driver as a signed change, and end with `{ \"label\": \"FY25\", \"total\": true }`: code computes the total. Never write a total you have not checked.",
  "Ranked: largest first, 'Other' last.",
  "Matrix: positions 0–100 on both axes.",
  "Timeline: a workstream made of smaller steps is a group (the steps have `level: 1`).",
  "Annotations are computed by code; never write their figure yourself. At most 3 (2 with notes); only when the user asked for them.",
];

/* ─────────────── The menu: 7 entries, each a key component ───────────────
   `variant(slide)` is how code picks the internal layout; the agent never sees it. */
export const MENU: Record<TemplateId, MenuEntry> = {
  chart: {
    summary: "One chart, with optional notes beside it.",
    use: "Data over categories or time: a trend, sizes compared, a bridge, workstreams, a ranking or a 2×2. Two measures: pair. Exact figures: table.",
    fields: { chart: CHART, caption: CAPTION, focus: FOCUS, notes: notes(NOTE_POINTS), notesTitle: NOTES_TITLE },
    variant: (s) => (s.notes?.length ? "split" : "full"),
    rules: ["With notes: at most 6 categories (7 waterfall items; a timeline takes 8 periods and 6 lines of up to 20 characters; ranked 7 items of up to 24 characters; a matrix 6 points).", "Ranked: pitch with a takeaway at most 6 items. Matrix: notes or a takeaway, not both.", ...(NOTE_POINTS ? ["`notes[].point` only works on a bars chart with bar series."] : []), "Notes: 3 or none.", "Note text: 300 characters in total, 200 with a takeaway.", ...CHART_GUIDE, ...CHART_KINDS],
  },
  pair: {
    summary: MIXED_HALVES ? "Two halves, each a chart, a table, a number or points." : "Two charts side by side, each with a caption and points.",
    use: MIXED_HALVES ? "Two related things, an exhibit each: market and share. One exhibit: chart or table." : "Two related measures, each with its own chart (market and share). One measure: chart.",
    fields: {
      halves: f("list", MIXED_HALVES ? "The two halves, left then right. Each has exactly one of chart, table, number or points." : "The two charts, left then right.", { required: true, items: { min: 2, max: 2 }, of: f("object", "One half.", { fields: {
        caption: f("text", MIXED_HALVES ? "What this half shows, then ' · ' and the unit: 'UK SME card spend · £bn'. Required with a chart or table; optional with a number or points." : "What this chart shows, then ' · ' and the unit: 'UK SME card spend · £bn'. Required in both styles: two charts need telling apart.", { max: 40 }),
        chart: MIXED_HALVES ? HALF_CHART : { ...HALF_CHART, required: true },
        bullets: f("list", MIXED_HALVES ? "Chart halves only: 1–2 points under the chart, one line each." : "Optional: 1–2 points under the chart, one line each.", { items: { min: 1, max: 2 }, of: f("markup", "Point.", { max: { consulting: 55, pitch: 40 } }) }),
        ...(MIXED_HALVES ? { table: HALF_TABLE, number: MIXED_NUMBER, points: MIXED_POINTS } : {}),
      } }) }),
    },
    variant: () => "pair",
    rules: [...(MIXED_HALVES ? ["Each half has exactly one body: chart, table, number or points."] : []),
      "Chart half: bars (at most 6 categories and 2 series, names of up to 16 characters), a waterfall (at most 6 items, pitch 5, labels of up to 8 characters) or ranked (at most 6 items of up to 20 characters).",
      MIXED_HALVES ? "One focus across the slide: the series, item or row the title is about, in one of the two halves." : "One focus across the slide: the series or item the title is about, in one of the two charts.", "With a takeaway: at most 1 bullet per chart.", ...CHART_GUIDE.slice(0, 3)],
  },
  table: {
    summary: "A table, with optional notes beside it.",
    use: "Exact figures across rows, options scored (Harvey balls, ticks), or actions with owners and dates.",
    fields: {
      table: f("object", "The table.", { required: true, fields: {
  columns: f("list", "Column headers, left to right. The first column is usually the row label.", { required: true, items: { min: 2, max: 5 }, of: TABLE_COLUMN }),
  rows: f("list", "Rows, top to bottom: at most 8, plus group headings.", { required: true, items: { min: 1, max: 10 }, of: f("object", "Row.", { fields: {
    cells: TABLE_CELLS,
    style: f("enum", "`muted`: a context row, hidden in pitch. `total`: the bottom line, drawn with a rule above. `group`: a heading over the rows below it (one cell).", { values: ["muted", "total", "group"] }),
    focus: f("boolean", "Highlight this row.", { default: false }),
  } }) }),
      } }),
      caption: CAPTION,
      focus: FOCUS,
      notes: notes(false),
      notesTitle: NOTES_TITLE,
    },
    variant: (s) => (s.notes?.length ? "split" : "full"),
    rules: [
      "Budget: a row costs 1, a row with a mark (✓ ✗ or a Harvey ball) 1.15, a row with a cell note 1.5, a row with bullets 1.2 + 0.75 per bullet line (a bullet wraps past about 48 characters in a 3-column table, 34 in a 4-column one), a group heading 1 as a row but 0 when every heading is short enough to sit in a first column beside its rows (at most 18 characters; 12 beside notes or in a 2-column table), header icons 0 inline but 1 when a label is too long to sit beside its icon (the icons then go above the labels), a takeaway 1.5, a caption 1, the Harvey-ball key 1 (consulting). Consulting: at most 10.5. Pitch: at most 7 (cell notes, bullets and muted rows are hidden in pitch).",
      "Scores: one kind of mark per table, Harvey balls or ticks, not both.",
      "Bullets in cells: one column at most, in a table of at most 4 columns; 1–3 bullets of up to 50 characters; not with a note in the same cell.",
      "Header icons: on every column after the first, or none.",
      "With notes: at most 4 columns, 3 notes, and first-column text of at most 24 characters. Note text: 300 characters in total, 200 with a takeaway.",
    ],
  },
  number: {
    summary: "One big number and a sentence saying what it means; no title.",
    use: "One figure makes the point alone. Several figures: cards.",
    frame: false,
    fields: {
      number: f("object", "The number.", { required: true, fields: {
        value: f("text", "The number with its unit: '£1.4bn', '19%', '5 min'.", { required: true, max: 7 }),
        caption: f("markup", "What it means, as a full sentence: the slide's line in the storyline.", { required: true, max: { consulting: 110, pitch: 80 } }),
        tone: TONE,
      } }),
      footnote: FRAME.footnote,
      source: FRAME.source,
    },
    variant: () => "number",
  },
  quote: {
    summary: "A large quote and who said it; no title.",
    use: "A customer's or expert's own words make the point.",
    frame: false,
    fields: {
      quote: f("markup", "The words, without quotation marks.", { required: true, max: { consulting: 150, pitch: 110 } }),
      who: f("text", "Who said it, and where: 'Founder, 12-person logistics firm · Acme interviews, 2026'.", { required: true, max: 70 }),
      footnote: FRAME.footnote,
    },
    variant: () => "quote",
  },
  steps: {
    summary: "Phases in rows: when, a name, what happens.",
    use: "A sequence in time in 2–5 phases: plan, roadmap, process. Overlapping workstreams: chart timeline.",
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
    summary: "2–4 cards, each led by an icon or a big value, or two framed cards.",
    use: "2–4 parallel options, pillars or figures, or a two-way contrast (them vs us).",
    fields: {
      framed: f("boolean", "Two framed cards side by side, for a contrast: the losing case left (tone `neutral`), the winning case right (tone `focus`). Red (`neg`) only when the user asks for it.", { default: false }),
      cards: f("list", "The cards, left to right.", { required: true, items: { min: 2, max: 4 }, of: f("object", "One card.", { fields: {
        icon: f("enum", "Icon lead: an icon from the curated set, or \"auto\" to let code pick one from the card's text. Not with `value` or `framed`.", { values: [...ICONS, "auto"] }),
        value: f("text", "Value lead: a big number with its unit, e.g. '5 min', '19%'. Not with `icon` or `framed`.", { max: 6 }),
        label: f("text", "Framed only: who or what this case is, e.g. 'Credit-only lenders'.", { max: 30 }),
        title: f("markup", "Card title. Framed: a big 2-word headline, plain text.", { required: true, max: { consulting: 24, pitch: 22 } }),
        bullets: f("list", "1–3 bullets. Not with `text`.", { items: { min: 1, max: 3 }, of: f("markup", "Bullet.", { max: 60 }), styles: CONSULTING }),
        text: f("markup", "One short line. Not with `bullets`. Value cards: one sentence of context.", { max: { consulting: 80, pitch: 50 } }),
        tone: f("enum", "`focus`: the card the title is about. `neg`: only when the user asks for red. `neutral`: the rest, including the losing case in a two-card contrast.", { values: ["neutral", "focus", "neg"], default: "neutral" }),
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
  summary: {
    summary: "The answer in the title, then 2–4 numbered points with evidence.",
    use: "The whole argument on one slide, near the start of a consulting deck.",
    fields: {
      points: f("list", "The supporting points, in the order the deck proves them. Together they prove the title; they do not overlap.", { required: true, items: { min: 2, max: 4 }, of: f("object", "One point.", { fields: {
        title: f("markup", "The claim, as a short headline: 'Bundling fixes adverse selection'.", { required: true, max: 40 }),
        text: f("markup", "One sentence of evidence for it, with a figure where there is one.", { required: true, max: 100 }),
      } }) }),
    },
    variant: () => "full",
    rules: ["With a takeaway: at most 3 points.", "Each claim fits on two lines: at most 40 characters."],
  },
  cover: {
    summary: "The deck title and a one-line subtitle.",
    use: "The first slide, once.",
    frame: false,
    fields: {
      title: f("markup", "Company, product or report name, or (pitch) a short bold claim.", { required: true, max: { consulting: 24, pitch: 32 } }),
      subtitle: f("markup", "One sentence saying what this is and for whom. No figures.", { required: true, max: { consulting: 120, pitch: 80 } }),
    },
    variant: () => "cover",
    rules: ["The cover never carries numbers, dates or bylines."],
  },
  section: {
    summary: "A numbered section divider.",
    use: "Starts each part of a deck of 8+ slides; consulting decks need them.",
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
  ["the executive summary: the answer and the 2–4 points that prove it", "summary"],
  ["the start of a new part in a deck of 8+ slides", "section"],
  ["data over categories or time (a series): a trend, a comparison of sizes, a crossover; a bridge between two totals; workstreams overlapping in time; named items ranked by one measure; items placed on two dimensions (a 2×2)", "chart"],
  [MIXED_HALVES ? "two related things that each need their own exhibit, side by side" : "two related measures that each need their own chart, side by side", "pair"],
  ["exact figures the reader needs to compare", "table"],
  ["a sequence in time: plan, roadmap, process, history (2–5 steps)", "steps"],
  ["one figure that makes the point on its own", "number"],
  ["a customer's or expert's own words", "quote"],
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

/** Templates the agent does not create while their layout is being redone. Existing slides still render and
    validate. None at present. */
export const ARCHIVED: readonly TemplateId[] = [];
/** The templates the agent may pick: the menu minus the archived ones. */
export const OFFERED = (Object.keys(MENU) as TemplateId[]).filter((id) => !ARCHIVED.includes(id));

/** One line per offered entry: what the router and planning prompt see. */
export function catalogue(): string {
  return OFFERED.map((id) => `${id}: ${MENU[id].summary} Use when: ${MENU[id].use}`).join("\n");
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
  const caps = (t.capabilities ?? []).filter((c) => !c.styles || c.styles.includes(style)).map(({ name, use, avoid, sample }) => ({ name, use, avoid, sample }));
  return {
    template: id, summary: t.summary, use: t.use,
    fields: Object.fromEntries(Object.entries(fieldsFor(id, style)).map(([k, v]) => [k, view(v, style)])),
    rules: [...(t.rules || []), `Markup: ${MARKUP.map((m) => `${m.syntax} = ${m.effect}`).join("; ")}. ${MARKUP_NOTE}`],
    ...(caps.length ? { capabilities: caps } : {}),
    ...(t.shapes ? { shapes: t.shapes } : {}),
  };
}

/* ─────────────── Validation ───────────────
   validate(slide, style) -> { errors, warnings }. Messages name the exact path,
   what was measured, the limit and the fix (spec 9.4).                        */

/** The slide's line in the storyline: its title, or (no title) the number's caption or the quote. */
export const headline = (s: Partial<Slide> | null | undefined): string => plain(s?.title || s?.number?.caption || s?.quote || "");

export const plain = (s: unknown): string => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(.+?)\]\]/g, "$1").replace(/\[-(.+?)-\]/g, "$1").replace(/\[\+(.+?)\+\]/g, "$1");
const MARKUP_RE = /\*\*|\[\[|\]\]|\[-|-\]|\[\+|\+\]/;

type Out = Validation;
/** Fields of an object value the validator walks; the value is unvalidated input. */
const fieldsOf = (v: object) => v as Record<string, unknown>;
const CELL_KEYS = ["value", "note", "bullets", "status"];

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
      if (typeof value === "string" || typeof value === "number") {
        const len = plain(String(value)).length;
        if (max && len > max) out.errors.push(`${path}: ${len} characters, limit ${max}.`);
        break;
      }
      if (typeof value !== "object" || Array.isArray(value)) { out.errors.push(`${path}: a cell is a string, or an object with value, note, bullets or status.`); break; }
      const v = fieldsOf(value);
      for (const k of Object.keys(v)) if (!CELL_KEYS.includes(k)) out.errors.push(`${path}.${k}: not a cell field. Allowed: ${CELL_KEYS.join(", ")}.`);
      if (v.value === undefined && !Array.isArray(v.bullets)) out.errors.push(`${path}.value: required (a cell with bullets may leave it out).`);
      else if (v.value !== undefined && typeof v.value !== "string" && typeof v.value !== "number") out.errors.push(`${path}.value: must be text.`);
      else if (v.value !== undefined && max && plain(String(v.value)).length > max) out.errors.push(`${path}: ${plain(String(v.value)).length} characters, limit ${max}.`);
      if (v.note !== undefined && String(v.note).length > 32) out.errors.push(`${path}.note: limit is 32 characters.`);
      if (v.bullets !== undefined) {
        if (!Array.isArray(v.bullets) || v.bullets.length < 1 || v.bullets.length > 3) out.errors.push(`${path}.bullets: 1–3 bullets.`);
        else v.bullets.forEach((b: unknown, k: number) => {
          if (typeof b !== "string") out.errors.push(`${path}.bullets[${k}]: must be text.`);
          else if (plain(b).length > 50) out.errors.push(`${path}.bullets[${k}]: ${plain(b).length} characters, limit 50.`);
        });
      }
      if (v.status !== undefined && typeof v.status !== "boolean") out.errors.push(`${path}.status: must be true or false.`);
      if (v.status && v.bullets) out.errors.push(`${path}: a status label has no bullets.`);
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
  if (kind === "ranked") return checkRanked(c, path, out);
  if (kind === "matrix") return checkMatrix(c, path, out);
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
  if ((c.stacking === "stacked" || c.stacking === "percent") && (bars.length < 2 || new Set(bars.map((s) => fmtOf(c, s))).size > 1))
    out.errors.push(`${path}.stacking: stacking needs 2 or more bar series in one unit. Set it to "none".`);
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
      const s = a.series !== undefined ? series[a.series] : c.stacking === "stacked" ? null : bars.find((x) => x.color === "focus") || bars[0];
      const v = s ? [s.values?.[from], s.values?.[to]] : [from, to].map((j) => bars.reduce((sum, x) => sum + (x.values?.[j] || 0), 0));
      if (!(Number(v[0]) > 0 && Number(v[1]) > 0)) out.errors.push(`${at}: a CAGR needs positive values at both ends (got ${v.join(" and ")}). Use a difference instead.`);
    }
  });
  if (c.stacking === "percent" && (c.annotations || []).some((a) => a?.type !== undefined)) out.errors.push(`${path}.annotations: not on a 100% stacked chart (the bars are shares, not values).`);
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
  const lines = timelineLines(c.rows.map((r) => r ?? { label: "" }));
  c.rows.forEach((r, i) => {
    if (!r) return;
    if (r.level !== undefined && r.level !== 0 && r.level !== 1) { out.errors.push(`${path}.rows[${i}].level: 0 or 1 (got ${r.level}).`); return; }
    if (r.level === 1 && i === 0) { out.errors.push(`${path}.rows[0]: a sub-row needs a workstream above it.`); return; }
    if (lines[i].group) {
      if (r.start !== undefined || r.end !== undefined) out.errors.push(`${path}.rows[${i}]: a group spans its sub-rows; leave out \`start\` and \`end\`.`);
      return;
    }
    if (!ok(r.start) || !ok(r.end)) out.errors.push(`${path}.rows[${i}]: \`start\` and \`end\` must be period indices 0–${n - 1} (got ${r.start}, ${r.end}).`);
    else if ((r.start as number) > (r.end as number)) out.errors.push(`${path}.rows[${i}]: \`start\` (${r.start}) is after \`end\` (${r.end}).`);
  });
  (c.milestones || []).forEach((m, i) => { if (m && !ok(m.at)) out.errors.push(`${path}.milestones[${i}].at: must be a period index 0–${n - 1} (got ${m.at}).`); });
  if (count(c.rows, "focus") > 1) out.errors.push(`${path}.rows: at most one focus row.`);
  if (lines.filter((l) => l.level === 0).length > 8) out.errors.push(`${path}.rows: at most 8 workstreams (sub-rows are extra, 12 lines in all).`);
}

function checkRanked(c: Chart, path: string, out: Out): void {
  if (!Array.isArray(c.ranking)) { out.errors.push(`${path}.ranking: required. One { label, value } per bar, largest first.`); return; }
  const items = c.ranking;
  items.forEach((x, i) => { if (typeof x?.value === "number" && x.value < 0) out.errors.push(`${path}.ranking[${i}].value: ${x.value}; ranked bars are 0 or more. For gains and losses use a waterfall or bars.`); });
  if (count(items, "focus") > 1) out.errors.push(`${path}.ranking: at most one focus item.`);
  // Largest first; a catch-all at the end is left where it is.
  const ranked = items.filter((x, i) => !(i === items.length - 1 && /^other/i.test(x?.label ?? ""))).map((x) => x?.value);
  if (ranked.some((v, i) => i > 0 && typeof v === "number" && typeof ranked[i - 1] === "number" && v > (ranked[i - 1] as number)))
    out.warnings.push(`${path}.ranking: not largest first. Order the items by value unless the order itself means something.`);
}

function checkMatrix(c: Chart, path: string, out: Out): void {
  if (!c.axes) out.errors.push(`${path}.axes: required. { "x": "…", "y": "…" }, each read low to high.`);
  if (!Array.isArray(c.points)) { out.errors.push(`${path}.points: required. One { label, x, y } per thing placed.`); return; }
  c.points.forEach((p, i) => {
    for (const k of ["x", "y"] as const) if (typeof p?.[k] === "number" && (p[k] < 0 || p[k] > 100)) out.errors.push(`${path}.points[${i}].${k}: ${p[k]}; positions are 0 to 100.`);
  });
  if (count(c.points, "focus") > 1) out.errors.push(`${path}.points: at most one focus point.`);
}

const count = <T extends object>(list: readonly (T | null | undefined)[] | undefined, key: keyof T) => (list || []).filter((x) => x && x[key]).length;

function checkNotes(s: Slide, style: Style, out: Out): void {
  const list = s.notes || [];
  if (list.length > 3 && (style === "pitch" || list.some((n) => n?.text))) out.errors.push(`notes: ${list.length} notes; at most 3 when notes have text${style === "pitch" ? " or in pitch" : ""}. Merge or cut the weakest.`);
  const textLen = list.reduce((sum, n) => sum + (n?.text ? plain(n.text).length : 0), 0);
  // Measured on the review page: the notes column holds about 300 characters of note text, 200 beside a takeaway.
  const total = s.takeaway ? 200 : 300;
  if (textLen > total) out.errors.push(`notes[].text: ${textLen} characters in total; ${s.takeaway ? "with a takeaway " : ""}the limit is ${total}. Shorten the notes${s.takeaway ? " or drop the takeaway" : ""}.`);
  // The heading takes a header row from the notes column; with a takeaway there is no room for both.
  if (s.notesTitle && s.takeaway) out.errors.push("notesTitle: a notes heading and a takeaway do not fit together. Drop the notes heading, or the takeaway.");
}

/* Rules every table shares, the table template's and a half table's: cells per column, column flags, marks,
   header icons, bullets, status labels and group headings. `half`: no bullets at half width. */
function checkGrid(t: Partial<Table>, base: string, style: Style, out: Out, half = false): void {
  const cols = Array.isArray(t.columns) ? t.columns : [], rows = Array.isArray(t.rows) ? t.rows : [], n = cols.length;
  const obj = (c: Cell | undefined) => (c && typeof c === "object" ? c : null);
  rows.forEach((r, i) => {
    if (!r || !Array.isArray(r.cells)) return;
    if (r.style === "group") {
      const extra = Object.keys(obj(r.cells[0]) ?? {}).filter((k) => k !== "value");
      if (extra.length) out.errors.push(`${base}.rows[${i}].cells[0]: a group heading is text only; remove ${extra.join(", ")}.`);
      if (r.cells.length !== 1) out.errors.push(`${base}.rows[${i}].cells: a group row has one cell, its heading (got ${r.cells.length}).`);
      return;
    }
    if (r.cells.length !== n) out.errors.push(`${base}.rows[${i}].cells: ${r.cells.length} cells, but there are ${n} columns. Use "—" for an empty cell.`);
  });
  cols.forEach((c, j) => { if (c?.muted && c.focus) out.errors.push(`${base}.columns[${j}]: muted or focus, not both.`); });
  cols.forEach((c, j) => { if (j > 0 && c && !c.label) out.errors.push(`${base}.columns[${j}].label: required. Header text.`); });
  const data = rows.filter((r) => r?.style !== "group").length;
  if (data > 8) out.errors.push(`${base}.rows: ${data} rows; at most 8 (group headings not counted). Cut or merge rows.`);
  if (markKinds(t).size > 1) out.warnings.push(`${base}: mixes Harvey balls and ticks. Score with one kind of mark per table.`);
  // Header icons: all columns after the first, or none.
  if (cols[0]?.icon) out.errors.push(`${base}.columns[0].icon: the label column has no icon.`);
  const iconed = cols.slice(1).filter((c) => c?.icon).length;
  if (iconed && iconed !== n - 1) out.errors.push(`${base}.columns: ${iconed} of ${n - 1} columns have an icon; give every column after the first an icon, or none.`);
  if (iconed && cols.every(Boolean) && rows.every((r) => r && Array.isArray(r.cells))) {
    const al = columnAlign({ columns: cols, rows: rows as Table["rows"] });
    cols.forEach((c, j) => { if (c?.icon && al[j] === "num") out.warnings.push(`${base}.columns[${j}].icon: an icon on a column of numbers adds nothing; remove it.`); });
  }
  // Bullets in cells.
  const bulletCols = new Set<number>();
  rows.forEach((r, i) => (r?.cells || []).forEach((c, j) => { const o = obj(c); if (o?.bullets) { bulletCols.add(j); if (o.note) out.errors.push(`${base}.rows[${i}].cells[${j}]: bullets or a note, not both.`); } }));
  if (bulletCols.size && half) out.errors.push(`${base}: bullets in cells do not fit half a slide. Use a phrase, or the table template.`);
  else if (bulletCols.size) {
    if (bulletCols.size > 1) out.errors.push(`${base}: bullets in ${bulletCols.size} columns; at most one column of bullets. More than that is cards or notes.`);
    if (n > 4) out.errors.push(`${base}.columns: ${n} columns; a table with bullets in cells takes at most 4.`);
    if (style === "pitch") {
      const bare = rows.flatMap((r, i) => (r?.cells || []).flatMap((c, j) => { const o = obj(c); return o?.bullets && !o.value ? [`rows[${i}].cells[${j}]`] : []; }));
      out.warnings.push(`${base}: pitch hides bullets in cells; say it in the cell or the subtitle${bare.length ? `, and give each such cell a value (${bare.join(", ")} ${bare.length === 1 ? "has" : "have"} none)` : ""}.`);
    }
  }
  // Status labels: a few distinct values per column, so they can be told apart.
  cols.forEach((_, j) => {
    const vals = new Set(rows.flatMap((r) => { const o = obj(r?.cells?.[j]); return o?.status ? [plain(String(o.value ?? ""))] : []; }));
    if (vals.size > 4) out.warnings.push(`${base}.columns[${j}]: ${vals.size} different status labels; use at most 4 so they can be told apart.`);
  });
  // Group headings.
  const groups = rows.map((r, i) => (r?.style === "group" ? i : -1)).filter((i) => i >= 0);
  if (groups.length) {
    if (data < 6) out.warnings.push(`${base}: group headings with ${data} rows; use them only with 6 or more.`);
    groups.forEach((g, k) => {
      const size = (k + 1 < groups.length ? groups[k + 1] : rows.length) - g - 1;
      if (size < 2) out.warnings.push(`${base}.rows[${g}]: a group of ${size} row${size === 1 ? "" : "s"}; a group needs at least 2.`);
    });
  }
}

function checkRules(s: Slide, style: Style, out: Out): void {
  switch (s.template) {
    case "chart": {
      checkChart(s.chart, "chart", out, s.focus === "auto");
      if (style === "pitch" && s.takeaway && s.chart?.kind === "ranked" && (s.chart.ranking || []).length > 6)
        out.errors.push(`chart.ranking: ${s.chart.ranking?.length} items; pitch with a takeaway takes at most 6. Merge the smallest into 'Other' or drop the takeaway.`);
      if (!s.notes?.length) break;
      checkNotes(s, style, out);
      const kind = s.chart?.kind || "bars", cats = s.chart?.categories || [], series = s.chart?.series || [];
      const items = s.chart?.items || [], periods = s.chart?.periods || [], rows = s.chart?.rows || [], annotations = s.chart?.annotations || [];
      if (kind === "waterfall" && items.length > 7) out.errors.push(`chart.items: ${items.length} items; with notes at most 7. Drop notes or merge small drivers.`);
      if (kind === "timeline" && periods.length > 8) out.errors.push(`chart.periods: ${periods.length} periods; with notes at most 8. Drop notes or use wider periods.`);
      if (kind === "timeline" && rows.length > 6) out.errors.push(`chart.rows: ${rows.length} lines; with notes at most 6. Drop notes or merge workstreams.`);
      if (kind === "timeline") rows.forEach((r, i) => { if (r?.label && r.label.length > 20) out.errors.push(`chart.rows[${i}].label: ${r.label.length} characters; with notes at most 20. Shorten it.`); });
      if (kind === "bars" && cats.length > 6) out.errors.push(`chart.categories: ${cats.length} categories; with notes at most 6. Drop notes or group categories.`);
      if (kind === "bars" && annotations.length > 2) out.errors.push(`chart.annotations: ${annotations.length}; with notes at most 2.`);
      const ranking = s.chart?.ranking || [], points = s.chart?.points || [];
      if (kind === "ranked" && ranking.length > 7) out.errors.push(`chart.ranking: ${ranking.length} items; with notes at most 7. Drop notes or merge the smallest into 'Other'.`);
      if (kind === "ranked") ranking.forEach((x, i) => { if (x?.label && x.label.length > 24) out.errors.push(`chart.ranking[${i}].label: ${x.label.length} characters; with notes at most 24. Shorten it.`); });
      if (kind === "matrix" && points.length > 6) out.errors.push(`chart.points: ${points.length} points; with notes at most 6. Drop notes or the least important points.`);
      if (kind === "matrix" && s.takeaway) out.errors.push("takeaway: a matrix with notes has no room for a takeaway. Drop the takeaway, or the notes.");
      s.notes.forEach((n, i) => {
        if (!n?.point) return;
        if (kind !== "bars" || series.every((x) => x?.mark === "line")) return out.errors.push(`notes[${i}].point: points only work on a bars chart with bar series; remove it.`);
        if (!(n.point.series >= 0 && n.point.series < series.length)) out.errors.push(`notes[${i}].point.series: ${n.point.series} is out of range; the chart has ${series.length} series (0–${series.length - 1}).`);
        if (!(n.point.index >= 0 && n.point.index < cats.length)) out.errors.push(`notes[${i}].point.index: ${n.point.index} is out of range; the chart has ${cats.length} categories (0–${cats.length - 1}).`);
      });
      break;
    }
    case "table": {
      const t: Partial<Table> = s.table || {}, n = (t.columns || []).length;
      checkGrid(t, "table", style, out);
      const rows = (t.rows || []).filter((r) => r && !(style === "pitch" && r.style === "muted"));
      // Short group headings sit in a first column beside their rows and cost no height; long ones are heading rows.
      const byColumn = groupLayout(t, roomOf(t, !!s.notes?.length)) === "column";
      const rowCost = (r: Table["rows"][number]) => {
        if (r.style === "group") return byColumn ? 0 : 1;
        if (style === "pitch") return 1;
        const cells = r.cells || [];
        // Bullets are costed by line (measured: a bullet line is 0.75 of a row; a bullet wraps past ~48 characters in a
        // column of a 3-column table, ~34 in a 4-column one).
        const perLine = n <= 3 ? 48 : 34;
        const lines = Math.max(0, ...cells.map((c) => (c && typeof c === "object" && Array.isArray(c.bullets) ? c.bullets.reduce((k, b) => k + Math.max(1, Math.ceil(plain(String(b)).length / perLine)), 0) : 0)));
        if (lines) return 1.2 + 0.75 * lines;
        if (cells.some((c) => c && typeof c === "object" && c.note)) return 1.5;
        // A row holding a mark is taller: 59px against 51px for a row of words (1.16). Rounded so the budget never lets an
        // overflow through; a wrong refusal is cheaper than a slide that runs into its footnote.
        return cells.some((c) => markOf(String(c && typeof c === "object" ? c.value ?? "" : c ?? ""))) ? 1.15 : 1;
      };
      const key = style === "consulting" && markKinds(t).has("balls") ? 1 : 0, icons = iconsMayStack(t, roomOf(t, !!s.notes?.length)) ? 1 : 0;
      const cost = Math.round((rows.reduce((sum, r) => sum + rowCost(r), 0) + (s.takeaway ? 1.5 : 0) + (s.caption ? 1 : 0) + key + icons) * 100) / 100, budget = style === "pitch" ? 7 : 10.5;
      if (cost > budget) out.errors.push(`table: this table costs ${cost} rows, budget ${budget} for ${style} (row = 1, row with a mark = 1.15, row with a cell note = 1.5, row with bullets = 1.2 + 0.75 per bullet line, group heading = 1 as a row, 0 as a column (headings of at most 18 characters), header icons = 0 inline, 1 above, takeaway = 1.5, caption = 1, Harvey-ball key = 1). Cut rows, drop cell notes or bullets, the takeaway or the caption.${groupLayout(t, roomOf(t, !!s.notes?.length)) === "rows" ? ` Or shorten every group heading to ${roomOf(t, !!s.notes?.length) === "full" ? 18 : 12} characters: short headings sit in a first column and cost nothing.` : ""}`);
      if (s.notes?.length) {
        checkNotes(s, style, out);
        if (s.notes.length > 3) out.errors.push(`notes: ${s.notes.length} notes; beside a table at most 3.`);
        if (n > 4) out.errors.push(`table.columns: ${n} columns; with notes at most 4. Drop a column or the notes.`);
        (t.rows || []).forEach((r, i) => { if (r?.style === "group") return; const c = r?.cells?.[0], v = typeof c === "object" ? c?.value : c;
          if (v && String(v).length > 24) out.errors.push(`table.rows[${i}].cells[0]: ${String(v).length} characters; with notes at most 24.`); });
      }
      break;
    }
    case "pair": {
      const bodies = HALF_BODIES.join(", ");
      if ((s as { charts?: unknown }).charts !== undefined) out.errors.push(MIXED_HALVES ? `charts: \`charts\` is now \`halves\`; each half has one of ${bodies}.` : "charts: `charts` is now `halves`; each half has a caption and a chart.");
      (s.halves || []).forEach((h, i) => {
        if (!h || typeof h !== "object") return;
        const p = `halves[${i}]`, found = HALF_BODIES.filter((k) => h[k] !== undefined);
        // Without mixed halves the chart field itself is required, so its own message covers a missing chart.
        if (MIXED_HALVES && found.length !== 1) out.errors.push(`${p}: ${found.length ? `has ${found.join(" and ")}` : "has no body"}; give exactly one of ${bodies}.`);
        if ((h.chart || h.table) && !h.caption) out.errors.push(`${p}.caption: required${MIXED_HALVES ? " with a chart or table" : ""}. What it shows, then ' · ' and the unit.`);
        if (MIXED_HALVES && h.bullets && !h.chart) out.errors.push(`${p}.bullets: only under a chart. A list on its own is points.`);
        if (MIXED_HALVES && h.table && typeof h.table === "object") checkGrid(h.table, `${p}.table`, style, out, true);
        const c = h.chart, at = `${p}.chart`;
        if (!c || typeof c !== "object") return;
        // One focus across the slide is checked by the agent checks, so a chart without one is not flagged here.
        checkChart(c, at, out, true);
        const kind = c.kind || "bars";
        if (kind === "timeline" || kind === "matrix") return out.errors.push(`${at}.kind: "${kind}" is too dense for half a slide. Use bars, a waterfall or ranked, or the chart template.`);
        if (kind === "bars" && (c.categories || []).length > 6) out.errors.push(`${at}.categories: ${c.categories?.length} categories; half a slide takes 6.`);
        if (kind === "bars" && (c.series || []).length > 2) out.errors.push(`${at}.series: ${c.series?.length} series; half a slide takes 2.`);
        if (kind === "bars") (c.series || []).forEach((x, j) => { if (x?.name && x.name.length > 16) out.errors.push(`${at}.series[${j}].name: ${x.name.length} characters; half a slide takes 16.`); });
        if (kind === "waterfall") (c.items || []).forEach((x, j) => { if (x?.label && x.label.length > 8) out.errors.push(`${at}.items[${j}].label: ${x.label.length} characters; half a slide takes 8.`); });
        const wfMax = style === "pitch" ? 5 : 6;
        if (kind === "waterfall" && (c.items || []).length > wfMax) out.errors.push(`${at}.items: ${c.items?.length} items; half a slide takes ${wfMax}.`);
        if (kind === "ranked" && (c.ranking || []).length > 6) out.errors.push(`${at}.ranking: ${c.ranking?.length} items; half a slide takes 6.`);
        if (kind === "ranked") (c.ranking || []).forEach((r, j) => { if (r?.label && r.label.length > 20) out.errors.push(`${at}.ranking[${j}].label: ${r.label.length} characters; half a slide takes 20.`); });
        if (s.takeaway && (h.bullets || []).length > 1) out.errors.push(`${p}.bullets: with a takeaway at most 1 per chart.`);
      });
      break;
    }
    case "summary": {
      if (s.takeaway && (s.points || []).length > 3) out.errors.push(`points: ${s.points?.length} points; with a takeaway at most 3. Merge two points or drop the takeaway.`);
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
  if (!isTemplate(obj.template)) return { errors: [`template: "${String(obj.template)}" does not exist. Use one of: ${OFFERED.join(", ")}.`], warnings: [] };
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
type LegacyChart = Omit<Chart, "series"> & { type?: string; stacked?: boolean | "100" | "auto"; series?: (Series & { line?: boolean })[] };
type LegacyColumn = { label?: string; focus?: boolean; num?: unknown };

/** Slides saved before the 2026-09-27 chart change: chart.type and series.line become marks; table columns lose `num`. */
export function upgrade(slide: Slide): Slide {
  const s = structuredClone(slide), c: LegacyChart | undefined = s.chart;
  const old = s as Slide & { charts?: Half[] };
  if (old.charts && !s.halves) { s.halves = old.charts; delete old.charts; }
  if (c?.type) {
    (c.series || []).forEach((x) => { x.mark = c.type === "lines" || x.line ? "line" : "bar"; delete x.line; });
    if (c.type === "bars") c.stacking = "none";
    delete c.type;
  }
  if (c && c.stacked !== undefined) {
    c.stacking = c.stacked === true ? "stacked" : c.stacked === "100" ? "percent" : c.stacked === "auto" ? "auto" : "none";
    delete c.stacked;
  }
  (s.table?.columns || []).forEach((col: LegacyColumn) => delete col.num);
  if (!NOTE_POINTS) (s.notes || []).forEach((n) => { if (n) delete n.point; });
  return s;
}

/* Judgement guidance (capabilities.ts) is wired in after MENU so that file stays a leaf. */
for (const id of Object.keys(MENU) as TemplateId[]) { MENU[id].capabilities = CAPABILITIES[id]; MENU[id].shapes = SHAPES[id]; }
// Without mixed halves the pair offers only charts: its card keeps the chart guidance and the chart + chart shape.
if (!MIXED_HALVES) {
  MENU.pair.capabilities = MENU.pair.capabilities?.filter((c) => (c.sample.halves as Half[] | undefined)?.every((h) => h.chart));
  MENU.pair.shapes = MENU.pair.shapes?.filter((x) => x.shape === "chart + chart");
}
