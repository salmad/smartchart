/* What each template can do, and when to use each capability (spec 2). The agent reads these on the template
   card whatever the gallery shows. Judgement only: what validate() enforces is in the template's rules.
   Each sample is a complete body for its template (no frame); tests/unit/capabilities.test.ts validates them. */
import type { Style, TemplateId } from "../types.js";

export interface Capability { name: string; use: string; avoid: string; sample: Record<string, unknown>; styles?: readonly Style[] }
export interface Shape { content: string; shape: string }

const bars = { categories: ["2024", "2025", "2026"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [12, 18, 26] }] };
// Samples use the starters' bundled pictures; an agent's own come from add_image.
const NORTHWIND = { src: "/starters/img/northwind-logo-861x192.png" }, PAYROO = { src: "/starters/img/payroo-logo-796x130.png" };
const notes = { name: "Notes", use: "Observations beside the exhibit that say what it does not show: a cause, a caveat, an implication.", avoid: "Restating the title, the takeaway or a value the reader can see; in pitch, prefer none." };

export const CAPABILITIES: Partial<Record<TemplateId, Capability[]>> = {
  chart: [
    { name: "Waterfall", use: "A bridge from one total to another by driver: revenue FY24 to FY25, a cost walk, an EBITDA bridge.", avoid: "Parts that do not add up to the change; use bars.", sample: { chart: { kind: "waterfall", format: "£{v}m", items: [{ label: "FY24", value: 40 }, { label: "Price", value: 6 }, { label: "Churn", value: -3 }, { label: "FY25", total: true }] } } },
    { name: "Ranked", use: "Named items ordered by one measure: share by provider, spend by category.", avoid: "Items with a natural order, such as years or stages; use bars.", sample: { chart: { kind: "ranked", format: "{v}%", ranking: [{ label: "Acme", value: 31, focus: true }, { label: "Bank", value: 24 }, { label: "Other", value: 12 }] } } },
    { name: "Timeline", use: "Workstreams that run in parallel or overlap in time.", avoid: "Phases that follow one another; use the steps template.", sample: { chart: { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [{ label: "Build", start: 0, end: 2 }, { label: "Pilot", start: 1, end: 3 }] } } },
    { name: "Matrix", use: "Items placed on two judged dimensions, such as impact against effort.", avoid: "Measured values on both axes; a matrix shows judgement, not data.", sample: { chart: { kind: "matrix", axes: { x: "Effort", y: "Impact" }, points: [{ label: "Pricing", x: 20, y: 80, focus: true }, { label: "Rewards", x: 70, y: 40 }] } } },
    { name: "Annotations", use: "The title claims a growth rate over a period (cagr), a gap between two categories (difference) or a comparison with a goal (target).", avoid: "Year-on-year rates for each year, which are a % line instead; annotations as decoration.", sample: { chart: { ...bars, annotations: [{ type: "cagr", from: 0, to: 2 }] } } },
    { ...notes, sample: { chart: bars, notes: [{ title: "Price drove half" }, { title: "Churn fell to 2%" }, { title: "Mix is shifting" }] } },
  ],
  table: [
    { name: "Scoring", use: "✓ / ✗ for has or lacks; Harvey balls for degree; the figure when the value matters; \"—\" for not applicable.", avoid: "Marks for figures, or ✗ for not applicable.", sample: { table: { columns: [{ label: "Provider" }, { label: "Fast" }, { label: "Limit" }], rows: [{ cells: ["Acme", "✓", "●"], focus: true }, { cells: ["Bank", "✗", "◑"] }] } } },
    { name: "Cell note", use: "The `note` under a value or mark, a short qualifier (\"from Q2\" under a ✓).", avoid: "Repeating the header; notes in more than about 1 cell in 3.", sample: { table: { columns: [{ label: "Provider" }, { label: "No fee" }], rows: [{ cells: ["Bank", { value: "✗", note: "£120 a year" }] }] } } },
    { name: "Bullets in a cell", use: "A row that explains a position, usually in the last column.", avoid: "When a phrase would do, or when the content is really cards or notes.", sample: { table: { columns: [{ label: "Rival" }, { label: "Play" }], rows: [{ cells: ["Bank", { bullets: ["Branches", "Loan bundles"] }] }] } }, styles: ["consulting"] },
    { name: "Header icons", use: "Columns that are categories scanned across, mainly columns of marks. The icon sits beside its label while labels stay short (about 12 characters in a 5-column table, 17 in 4); longer labels put every icon above and cost a row.", avoid: "Number columns.", sample: { table: { columns: [{ label: "Provider" }, { label: "Limit", icon: "wallet" }, { label: "Speed", icon: "zap" }], rows: [{ cells: ["Acme", "●", "●"] }] } } },
    { name: "Status labels", use: "A stage the reader filters by (Live, Pilot, Planned).", avoid: "Good or bad judgements, which are marks.", sample: { table: { columns: [{ label: "Action" }, { label: "Status" }], rows: [{ cells: ["Sign issuer", { value: "Under way", status: true }] }] } } },
    { name: "Group headings", use: "Long tables whose rows fall into a few named groups (Fees, Limits, Rewards). Keep headings short (at most 18 characters): they then sit in a first column beside their rows and cost no height.", avoid: "Short tables.", sample: { table: { columns: [{ label: "Term" }, { label: "Acme" }], rows: [{ cells: ["Fees"], style: "group" }, { cells: ["Annual", "£0"] }, { cells: ["Limits"], style: "group" }, { cells: ["Credit", "£250k"] }] } }, styles: ["consulting"] },
    { ...notes, sample: { table: { columns: [{ label: "Provider" }, { label: "Limit" }], rows: [{ cells: ["Bank", "£25k"] }] }, notes: [{ title: "Banks cap" }, { title: "Neobanks lack" }, { title: "Charge cards cost" }] } },
  ],
  pair: [
    { name: "Chart half", use: "A measure that needs its own chart beside another chart.", avoid: "Two measures that read better on one chart.", sample: { halves: [{ caption: "Market · £bn", chart: { ...bars, series: [{ ...bars.series[0], color: "neutral" }] } }, { caption: "Acme share · %", chart: { categories: ["2024", "2025", "2026"], format: "{v}%", series: [{ name: "Share", mark: "bar", color: "focus", values: [1, 3, 7] }] } }] } },
    { name: "Table half", use: "The exact figures or breakdown behind the other half.", avoid: "A table that explains positions or groups rows; use the table template.", sample: { halves: [{ caption: "Market · £bn", chart: bars }, { caption: "Spend book · £bn", table: { columns: [{ label: "Year" }, { label: "Share" }, { label: "Book" }], rows: [{ cells: ["2026", "7%", "£3.6bn"], focus: true }] } }] } },
    { name: "Number half", use: "A headline figure beside the trend or breakdown that produced it.", avoid: "A number that is the whole point on its own; use the number template.", sample: { halves: [{ number: { value: "7%", caption: "Acme’s share of spend by 2030." } }, { caption: "Market · £bn", chart: bars }] } },
    { name: "Points half", use: "Short reasons, or one side of a contrast in prose, with a **bold** lead-in.", avoid: "Numbered observations about a chart (a chart with notes), or two short sides (framed cards).", sample: { halves: [{ caption: "Problem", points: ["**Banks** cap limits at £25k", "**Neobanks** offer debit only"] }, { caption: "Acme", points: ["**£250k** limits from day one", "**No fee**, 1% back"] }] } },
  ],
  cards: [
    { name: "Icon cards", use: "Parallel ideas (pillars, features, options) where a symbol helps recognition; icon \"auto\" lets code pick.", avoid: "Ideas that are really figures; use value cards.", sample: { cards: [{ icon: "zap", title: "Fast", text: "Approval in minutes." }, { icon: "wallet", title: "Big limits", text: "Up to £250k." }] } },
    { name: "Logo cards", use: "2–4 companies side by side (partners, rivals), each with something to say; the logo leads in place of an icon.", avoid: "Names with nothing to say about each; use the logos template.", sample: { cards: [{ logo: NORTHWIND, title: "Accounting", text: "Cash data in one click." }, { logo: PAYROO, title: "Payroll", text: "Wages forecast to the day." }] } },
    { name: "Value cards", use: "Independent figures, each with one line of context.", avoid: "One figure that makes the point alone (number template) or figures on one measure (a chart).", sample: { cards: [{ value: "5 min", title: "To approve", text: "From application to card." }, { value: "£250k", title: "Top limit", text: "Ten times a bank's." }] } },
    { name: "Framed contrast", use: "A two-way contrast, them against us or before against after: the losing case left, the winning case right with tone focus.", avoid: "More than two sides, or sides that are not opposed; use icon cards.", sample: { framed: true, cards: [{ label: "Banks", title: "Too slow", text: "Weeks to approve.", tone: "neutral" }, { label: "Acme", title: "Instant", text: "Minutes to approve.", tone: "focus" }] } },
    { name: "Numbered cards", use: "Reasons or steps in an order, led by 01, 02, 03 (code sets the numbers): an argument in two or three points.", avoid: "Unordered options; use icon cards.", sample: { lead: "number", cards: [{ title: "Fast", bullets: ["Minutes to approve", "Cards issued same day"] }, { title: "Big limits", bullets: ["Up to £250k", "Raised with spend"] }] }, styles: ["consulting"] },
    { name: "Two over two", use: "Four cards that each have a few bullets to say: `arrange: \"grid\"` sets cards 1–2 above 3–4 with room for longer bullets.", avoid: "Four short cards; a row of four is quieter.", sample: { lead: "number", arrange: "grid", cards: [{ title: "One", bullets: ["First fact about one", "Second fact about one"] }, { title: "Two", bullets: ["First fact about two", "Second fact about two"] }, { title: "Three", bullets: ["First fact about three", "Second fact about three"] }, { title: "Four", bullets: ["First fact about four", "Second fact about four"] }] }, styles: ["consulting"] },
    { name: "Bullets or text", use: "Bullets when each card holds 2–3 separate facts (consulting); one line of text when it holds one.", avoid: "Bullets for a single fact, or text that runs to several.", sample: { cards: [{ icon: "zap", title: "Fast", bullets: ["Minutes to approve", "Cards issued same day"] }, { icon: "wallet", title: "Big limits", bullets: ["Up to £250k", "Raised with spend"] }] }, styles: ["consulting"] },
  ],
  image: [
    { name: "Screenshot", use: "The product doing the job the title claims: the screen where it happens, not a home page. Code fits it whole on a quiet panel.", avoid: "A screenshot as decoration, or one whose point the title does not name.", sample: { image: { src: "/starters/img/acme-app-screenshot-2400x1500.webp", alt: "The Acme cash flow screen: a 90-day forecast with a VAT dip" } } },
    { name: "Photo", use: "A place, a thing or people at work that the room should see. Code crops it to the frame.", avoid: "Stock photos that prove nothing.", sample: { image: { src: "/starters/img/priya-photo-1024x1024.webp", alt: "Priya Shah presenting to the pilot customers" } } },
    { ...notes, sample: { image: { src: "/starters/img/acme-app-screenshot-2400x1500.webp", alt: "The Acme cash flow screen" }, notes: [{ title: "Live data" }, { title: "The dip, named" }, { title: "Credit in a tap" }] } },
  ],
  team: [
    { name: "Photos", use: "A headshot for every person: code sets them in one tone so they read as a set.", avoid: "Photos for some people only; without photos the row is text over a rule, which reads better than a gap.", sample: { people: [{ photo: { src: "/starters/img/priya-photo-1024x1024.webp" }, name: "Priya Shah", role: "CEO", text: "Built a £1bn SME lending book" }, { photo: { src: "/starters/img/tom-photo-1024x1024.webp" }, name: "Tom Ellison", role: "CTO", text: "Ran card issuing for 4m customers" }] } },
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
