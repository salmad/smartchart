/* What each template can do, and when to use each capability (spec 2). The agent reads these on the template
   card whatever the gallery shows. Judgement only: what validate() enforces is in the template's rules.
   Each sample is a complete body for its template (no frame); tests/unit/capabilities.test.ts validates them. */
import type { Style, TemplateId } from "../types.js";

export interface Capability { name: string; use: string; avoid: string; sample: Record<string, unknown>; styles?: readonly Style[] }
export interface Shape { content: string; shape: string }

const bars = { categories: ["2024", "2025", "2026"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [12, 18, 26] }] };
const notes = { name: "Notes", use: "Observations beside the exhibit that say what it does not show: a cause, a caveat, an implication.", avoid: "Restating the title, the takeaway or a value the reader can see; in pitch, prefer none." };

export const CAPABILITIES: Partial<Record<TemplateId, Capability[]>> = {
  chart: [
    { name: "Waterfall", use: "A bridge from one total to another by driver: revenue FY24 to FY25, a cost walk, an EBITDA bridge.", avoid: "Parts that do not add up to the change; use bars.", sample: { chart: { kind: "waterfall", format: "£{v}m", items: [{ label: "FY24", value: 40 }, { label: "Price", value: 6 }, { label: "Churn", value: -3 }, { label: "FY25", total: true }] } } },
    { name: "Ranked", use: "Named items ordered by one measure: share by provider, spend by category.", avoid: "Items with a natural order, such as years or stages; use bars.", sample: { chart: { kind: "ranked", format: "{v}%", ranking: [{ label: "Acme", value: 31, focus: true }, { label: "Bank", value: 24 }, { label: "Other", value: 12 }] } } },
    { name: "Timeline", use: "Workstreams that run in parallel or overlap in time.", avoid: "2–5 phases one after another; use the steps template.", sample: { chart: { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [{ label: "Build", start: 0, end: 2 }, { label: "Pilot", start: 1, end: 3 }] } } },
    { name: "Matrix", use: "Items placed on two judged dimensions, such as impact against effort.", avoid: "Measured values on both axes; a matrix shows judgement, not data.", sample: { chart: { kind: "matrix", axes: { x: "Effort", y: "Impact" }, points: [{ label: "Pricing", x: 20, y: 80, focus: true }, { label: "Rewards", x: 70, y: 40 }] } } },
    { name: "Annotations", use: "The title claims a growth rate over a period (cagr), a gap between two categories (difference) or a comparison with a goal (target).", avoid: "Year-on-year rates for each year, which are a % line instead; annotations as decoration.", sample: { chart: { ...bars, annotations: [{ type: "cagr", from: 0, to: 2 }] } } },
    { ...notes, sample: { chart: bars, notes: [{ title: "Price drove half" }, { title: "Churn fell to 2%" }, { title: "Mix is shifting" }] } },
  ],
  table: [
    { name: "Scoring", use: "✓ / ✗ for has or lacks; Harvey balls for degree; the figure when the value matters; \"—\" for not applicable.", avoid: "Marks for figures, ✗ for not applicable, or mixing balls and ticks.", sample: { table: { columns: [{ label: "Provider" }, { label: "Fast" }, { label: "Limit" }], rows: [{ cells: ["Acme", "✓", "●"], focus: true }, { cells: ["Bank", "✗", "◑"] }] } } },
    { name: "Cell note", use: "The `note` under a value or mark, a short qualifier (\"from Q2\" under a ✓).", avoid: "Repeating the header; notes in more than about 1 cell in 3.", sample: { table: { columns: [{ label: "Provider" }, { label: "No fee" }], rows: [{ cells: ["Bank", { value: "✗", note: "£120 a year" }] }] } } },
    { name: "Bullets in a cell", use: "A row that explains a position, usually in the last column.", avoid: "Two columns of bullets (that is cards or notes), or a phrase would do.", sample: { table: { columns: [{ label: "Rival" }, { label: "Play" }], rows: [{ cells: ["Bank", { bullets: ["Branches", "Loan bundles"] }] }] } }, styles: ["consulting"] },
    { name: "Header icons", use: "Columns that are categories scanned across, mainly columns of marks.", avoid: "Number columns, or icons on only some columns.", sample: { table: { columns: [{ label: "Provider" }, { label: "Limit", icon: "wallet" }, { label: "Speed", icon: "zap" }], rows: [{ cells: ["Acme", "●", "●"] }] } } },
    { name: "Status labels", use: "A stage the reader filters by (Live, Pilot, Planned).", avoid: "Good or bad judgements, which are marks; more than 4 labels.", sample: { table: { columns: [{ label: "Action" }, { label: "Status" }], rows: [{ cells: ["Sign issuer", { value: "Under way", status: true }] }] } } },
    { name: "Group headings", use: "6 or more rows in 2–3 named groups.", avoid: "Short tables, or a group of one row.", sample: { table: { columns: [{ label: "Term" }, { label: "Acme" }], rows: [{ cells: ["Fees"], style: "group" }, { cells: ["Annual", "£0"] }, { cells: ["Limits"], style: "group" }, { cells: ["Credit", "£250k"] }] } }, styles: ["consulting"] },
    { ...notes, sample: { table: { columns: [{ label: "Provider" }, { label: "Limit" }], rows: [{ cells: ["Bank", "£25k"] }] }, notes: [{ title: "Banks cap" }, { title: "Neobanks lack" }, { title: "Charge cards cost" }] } },
  ],
  pair: [
    { name: "Chart half", use: "A measure that needs its own chart beside another exhibit.", avoid: "Timelines and matrices, which need the full width.", sample: { halves: [{ caption: "Market · £bn", chart: { ...bars, series: [{ ...bars.series[0], color: "neutral" }] } }, { caption: "Acme share · %", chart: { categories: ["2024", "2025", "2026"], format: "{v}%", series: [{ name: "Share", mark: "bar", color: "focus", values: [1, 3, 7] }] } }] } },
    { name: "Table half", use: "The exact figures or breakdown behind the other half.", avoid: "A table that explains positions or groups rows; use the table template.", sample: { halves: [{ caption: "Market · £bn", chart: bars }, { caption: "Spend book · £bn", table: { columns: [{ label: "Year" }, { label: "Share" }, { label: "Book" }], rows: [{ cells: ["2026", "7%", "£3.6bn"], focus: true }] } }] } },
    { name: "Number half", use: "A headline figure beside the trend or breakdown that produced it.", avoid: "A number that is the whole point on its own; use the number template.", sample: { halves: [{ number: { value: "7%", caption: "Acme’s share of spend by 2030." } }, { caption: "Market · £bn", chart: bars }] } },
    { name: "Points half", use: "2–4 short reasons or a side of a contrast in prose, with a **bold** lead-in.", avoid: "Numbered observations about a chart (a chart with notes), or two short sides (framed cards).", sample: { halves: [{ caption: "Problem", points: ["**Banks** cap limits at £25k", "**Neobanks** offer debit only"] }, { caption: "Acme", points: ["**£250k** limits from day one", "**No fee**, 1% back"] }] } },
  ],
  cards: [
    { name: "Icon cards", use: "Parallel ideas (pillars, features, options) where a symbol helps recognition; icon \"auto\" lets code pick.", avoid: "Ideas that are really figures; use value cards.", sample: { cards: [{ icon: "zap", title: "Fast", text: "Approval in minutes." }, { icon: "wallet", title: "Big limits", text: "Up to £250k." }] } },
    { name: "Value cards", use: "Independent figures, each with one line of context.", avoid: "One figure that makes the point alone (number template) or figures on one measure (a chart).", sample: { cards: [{ value: "5 min", title: "To approve", text: "From application to card." }, { value: "£250k", title: "Top limit", text: "Ten times a bank's." }] } },
    { name: "Framed contrast", use: "A two-way contrast, them against us or before against after: the losing case left, the winning case right with tone focus.", avoid: "More than two sides, or sides that are not opposed; use icon cards.", sample: { framed: true, cards: [{ label: "Banks", title: "Too slow", text: "Weeks to approve.", tone: "neutral" }, { label: "Acme", title: "Instant", text: "Minutes to approve.", tone: "focus" }] } },
    { name: "Bullets or text", use: "Bullets when each card holds 2–3 separate facts (consulting); one line of text when it holds one.", avoid: "Mixing bullets and text across cards.", sample: { cards: [{ icon: "zap", title: "Fast", bullets: ["Minutes to approve", "Cards issued same day"] }, { icon: "wallet", title: "Big limits", bullets: ["Up to £250k", "Raised with spend"] }] }, styles: ["consulting"] },
  ],
  steps: [
    { name: "Steps", use: "A sequence in time: a plan, a process, a history.", avoid: "Workstreams that overlap (a chart timeline) or items with no order (cards).", sample: { steps: [{ when: "Q4 2026", title: "Build", text: "Issuer signed." }, { when: "Q1 2027", title: "Prove", text: "First 100 customers." }] } },
    { name: "Focus step", use: "Highlight the one phase the slide is about: where we are, or what comes next.", avoid: "Steps of equal weight; then no focus.", sample: { steps: [{ when: "Q4 2026", title: "Build", text: "Issuer signed.", focus: true }, { when: "Q1 2027", title: "Prove", text: "First 100 customers." }] } },
  ],
};

export const SHAPES: Partial<Record<TemplateId, Shape[]>> = {
  table: [
    { content: "Options against criteria", shape: "Marks, header icons, a focus column or row on ours." },
    { content: "Exact figures", shape: "Words and figures, a total row, no marks." },
    { content: "Explaining positions", shape: "A short first column and one of bullets." },
    { content: "Actions", shape: "Owner, date and status columns; cell notes for detail." },
  ],
  pair: [
    { content: "Two related measures (market and share)", shape: "chart + chart" },
    { content: "A trend and the figures behind it", shape: "chart + table" },
    { content: "A chart and its reasons", shape: "chart + points (numbered observations: a chart with notes instead)" },
    { content: "A headline figure and the trend that produced it", shape: "number + chart" },
    { content: "Before and after, or us and them, in the same columns", shape: "table + table" },
    { content: "A two-way contrast in prose", shape: "points + points (short sides: framed cards instead)" },
  ],
};
