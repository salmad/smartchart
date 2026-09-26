/* Example deck and stress deck. Each example holds what the agent writes per style;
   shared keys (template, chart, table) are written once because the review page shows both styles. */
import { fieldsFor } from "./schema.js";

export const FOOTER = "FinBridge · Seed memorandum";

const UNIT_BARS = {
  categories: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"], format: "£{v}m",
  series: [
    { name: "Interest income", mark: "bar", color: "neutral", values: [0.4, 3.1, 14, 42, 85] },
    { name: "Interchange", mark: "bar", color: "focus", values: [0.3, 2.2, 11, 36, 80] },
    { name: "Gross margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31, 36, 38] },
  ],
};

export const EXAMPLES = [
  {
    template: "cover", name: "Cover",
    consulting: { title: "FinBridge", subtitle: "A revolving credit card and business account for UK small and medium-sized businesses." },
    pitch: { title: "The card that [[runs the business.]]", subtitle: "Credit, cashflow and rewards for UK small businesses. In one app." },
  },
  {
    template: "section", name: "Section",
    consulting: { title: "The problem", subtitle: "SME founders fund the business on personal credit because no provider bundles credit with banking." },
    pitch: { title: "The problem" },
  },
  {
    template: "number", name: "Number",
    consulting: {
      title: "UK SMEs fund growth on [-personal-] cards because no provider bundles business credit with daily banking",
      body: ["Founders put business spend on personal cards. They carry the **personal guarantee** and the limit risk, and the rewards leak out of the business.", "Banks won’t lend below £50k, neobanks only offer debit, and legacy card issuers were built for large corporates."],
      number: { value: "£540k", caption: "typical annual card spend that earns the business nothing back" },
      takeaway: "The gap is not credit or banking alone. It is **both, in one product.**",
      source: "FinBridge SME interviews (n = 42); British Business Bank, Small Business Finance Markets 2026.",
    },
    pitch: {
      title: "The problem",
      subtitle: "Your business runs on your [-personal-] Amex.",
      body: ["Three logins. One personal guarantee. **Nothing back.**"],
      number: { value: "£0", tone: "neg", caption: "back on £540k a year of business spend" },
    },
  },
  {
    template: "chart", name: "Chart · with notes (split)",
    chart: UNIT_BARS,
    consulting: {
      kicker: "Unit economics",
      title: "[[Interchange]] catches up with interest by year 4, lifting gross margin from 12% to 38%",
      notes: [
        { title: "Interest leads early", text: "Revolvers are **40–60%** of customers and carry margin while spend ramps.", point: { series: 0, index: 1 } },
        { title: "Interchange compounds", text: "Spend per customer grows **3×** as the card replaces the personal Amex.", point: { series: 1, index: 3 } },
        { title: "Margin settles at 38%", text: "Bad debt stabilises near **10%** of revolver balances from year 4.", point: { series: 2, index: 4 } },
      ],
      takeaway: "Spend, not lending, is what makes the book profitable.",
      footnote: "Gross margin = revenue less funding cost, rewards and bad debt, as a share of revenue.",
      source: "FinBridge financial model, base case. Illustrative.",
    },
    pitch: {
      title: "Unit economics",
      subtitle: "[[Interchange]] triples the margin.",
      notes: [{ title: "Matches interest by year 4", point: { series: 1, index: 3 } }, { title: "Gross margin reaches [[38%]]", point: { series: 2, index: 4 } }],
      takeaway: "Interest first. [[Spend pays forever.]]",
    },
  },
  {
    template: "cards", name: "Cards · icon lead",
    consulting: {
      kicker: "The solution",
      title: "One account replaces the bank, the card platform and the lender that SMEs juggle today",
      cards: [
        { icon: "zap", title: "Approved in five minutes", bullets: ["Limits up to **£250k**, spend the same day", "Underwritten on live Shopify and ad data, not filed accounts"] },
        { icon: "wallet", title: "Cashflow in one place", bullets: ["Pay bills, get paid and control team spend", "Move between debit and credit funds per payment"] },
        { icon: "refresh-cw", title: "Earn on every pound", bullets: ["**1% cashback** on all card spend", "Rewards attract transactors, lowering adverse selection"] },
      ],
      takeaway: "Three providers today. **FinBridge replaces all of them.**",
    },
    pitch: {
      title: "The solution",
      subtitle: "Bank. Card. Lender. [[One app.]]",
      cards: [
        { value: "5 min", title: "to a credit line", text: "Up to £250k. Spend the same day." },
        { value: "1 app", title: "for all cashflow", text: "Pay, get paid, control team spend." },
        { value: "1%", tone: "focus", title: "back on everything", text: "Rewards bring the right customers." },
      ],
      takeaway: "Today: three companies. [[We are one.]]",
    },
  },
  {
    template: "cards", name: "Cards · framed contrast",
    consulting: {
      kicker: "The insight",
      title: "Credit-only lenders attract adverse selection; [[bundling spend and rewards]] fixes the funnel",
      framed: true,
      cards: [
        { tone: "neg", label: "Credit-only lenders", title: "Adverse loop", bullets: ["Expensive acquisition of desperate borrowers", "Little data beyond filed accounts", "High risk drives high prices, then higher risk"],
          facts: [{ label: "Outcome", text: "Rising losses, rising prices" }, { label: "Examples", text: "OnDeck, Kabbage, Silvr: none survived" }] },
        { tone: "focus", label: "FinBridge", title: "Positive loop", bullets: ["Customers arrive for non-credit reasons", "Credit funds the cashflow of a working business", "More data, better pricing, better customers"],
          facts: [{ label: "Outcome", text: "Falling losses, better pricing" }, { label: "Proof", text: "Capital on Tap, YouLend are profitable" }] },
      ],
      takeaway: "Why customers join decides how much credit loses.",
    },
    pitch: {
      title: "The insight",
      subtitle: "Credit alone attracts the [-wrong borrowers.-]",
      framed: true,
      cards: [
        { tone: "neg", label: "Credit only", title: "Adverse loop", text: "Desperate borrowers, thin data, rising prices." },
        { tone: "focus", label: "FinBridge", title: "Positive loop", text: "Good businesses arrive first. Credit follows." },
      ],
    },
  },
  {
    template: "table", name: "Table · full width",
    table: {
      columns: [{ label: "£ per customer per month" }, { label: "Revolver", focus: true }, { label: "Transactor" }, { label: "Super-transactor" }],
      rows: [
        { cells: ["Share of customers", "40–60%", "40–60%", "~10%"], style: "muted" },
        { cells: ["Interest revenue", { value: "267", note: "40% APR × £8.0k" }, "—", "—"] },
        { cells: ["Cost of funding", { value: "(53)", note: "8% × £8.0k" }, { value: "(33)", note: "8% × £5.0k" }, { value: "(70)", note: "8% × £10.5k" }] },
        { cells: ["Interchange revenue", { value: "90", note: "1.8% × £5.0k spend" }, { value: "120", note: "1.8% × £6.7k" }, { value: "480", note: "1.8% × £26.7k" }] },
        { cells: ["Cost of rewards", "(50)", "(67)", "(267)"] },
        { cells: ["Bad debt", { value: "(70)", note: "~10% of balance p.a." }, "(5)", "(10)"] },
        { cells: ["Monthly gross margin", "£179", "£10", "£128"], style: "total" },
      ],
    },
    consulting: {
      kicker: "Business model",
      title: "[[Revolvers]] carry the margin; super-transactors earn theirs on interchange alone",
      takeaway: "A 50/50 revolver–transactor mix earns ~£95 a month each.",
      footnote: "Balances and spend are monthly averages per active customer.",
      source: "FinBridge model; funding cost assumes an 8% warehouse rate.",
    },
    pitch: { title: "Business model", subtitle: "Every customer [+makes money.+]" },
  },
  {
    template: "table", name: "Table · with notes (split)",
    table: {
      columns: [{ label: "Provider" }, { label: "Credit limit" }, { label: "Fee" }, { label: "Cashback", focus: true }],
      rows: [
        { cells: ["High-street bank", "£25k", "£120/yr", "0%"] },
        { cells: ["Neobank (debit)", "—", "£0", "0.5%"] },
        { cells: ["Corporate Amex", "£50k", "£550/yr", "1%"] },
        { cells: ["FinBridge", "£250k", "£0", "1%"], style: "total" },
      ],
    },
    consulting: {
      kicker: "Competition",
      title: "FinBridge offers [[five times the limit]] of the nearest SME card at no annual fee",
      notes: [
        { title: "Banks cap at £25k", text: "Underwriting on filed accounts limits young firms." },
        { title: "Neobanks stop at debit", text: "No credit line, so spend leaves for personal cards." },
        { title: "Amex charges for rewards", text: "**£550 a year** before the first pound of cashback." },
      ],
      source: "Provider websites, September 2026.",
    },
    pitch: {
      title: "Competition",
      subtitle: "[[5×]] the limit. No fee.",
      notes: [{ title: "Banks cap at £25k" }, { title: "Amex charges £550 a year" }],
    },
  },
  {
    template: "chart", name: "Chart · full width",
    chart: {
      categories: ["Q1 ’27", "Q2", "Q3", "Q4", "Q1 ’28", "Q2", "Q3", "Q4"], format: "£{v}m",
      series: [
        { name: "Base case", mark: "line", color: "focus", area: true, values: [1, 4, 10, 22, 40, 62, 88, 120] },
        { name: "Downside", mark: "line", color: "contrast", dashed: true, values: [0.8, 3, 7, 15, 27, 41, 56, 72] },
      ],
    },
    consulting: {
      kicker: "Growth",
      title: "The [[base case]] reaches a £120m book by Q4 2028; the downside still clears £70m",
      takeaway: "Even the downside case fills a warehouse facility in 2028.",
      footnote: "Downside assumes 40% lower acquisition and twice the bad debt.",
      source: "FinBridge model.",
    },
    pitch: { title: "Growth", subtitle: "A [[£120m]] book in two years." },
  },
  {
    template: "steps", name: "Steps",
    consulting: {
      kicker: "Plan and ask",
      title: "£5m funds [[18 months]] to a £10m book and a drawn warehouse facility",
      steps: [
        { when: "0–6 mo", title: "Build", text: "Card issuing, partners and underwriting engine live. **First 100 cards.**" },
        { when: "6–18 mo", title: "Prove", text: "Book reaches **£10m**; gross-margin run-rate ~£1.5m; warehouse drawn.", focus: true },
        { when: "Year 2", title: "Scale", text: "£120m book; direct-mail acquisition at 2,000+ customers a month." },
        { when: "Year 3+", title: "Expand", text: "£250m+ book; gross margin covers opex and CAC; EU entry." },
      ],
      takeaway: "The ask: **£5m for 18 months** to reach a funded book.",
    },
    pitch: {
      title: "The plan",
      subtitle: "[[£5m]] to a funded book.",
      steps: [
        { when: "0–6 mo", title: "Build", text: "First 100 cards." },
        { when: "6–18 mo", title: "Prove", text: "£10m book.", focus: true },
        { when: "Year 2", title: "Scale", text: "£120m book." },
      ],
      takeaway: "The ask: [[£5m for 18 months.]]",
    },
  },
  {
    template: "cards", name: "Cards · value lead",
    consulting: {
      kicker: "Appendix · Market",
      title: "Demand is documented: most UK SMEs need revolving credit and [[a fifth]] already use a card",
      cards: [
        { value: "5.7M", title: "UK SMEs", text: "Private-sector businesses; 34M more across the EU." },
        { value: "19%", tone: "focus", title: "Use a credit card", text: "The most-used external finance product, ahead of overdrafts." },
        { value: "30–40%", title: "Need revolving", text: "The most frequent financing need in ECB SAFE and our surveys." },
        { value: "€400bn", title: "SME credit gap", text: "Estimated across the EU and UK." },
      ],
      takeaway: "The product sits where card use and revolving need overlap.",
      source: "EC SME Annual Report 2025/26; UK DBT Business Population 2025; ECB SAFE; EIB Group.",
    },
    pitch: {
      title: "Market",
      subtitle: "A market [[already on cards.]]",
      cards: [
        { value: "5.7M", title: "UK SMEs" },
        { value: "19%", tone: "focus", title: "Use a credit card" },
        { value: "30–40%", title: "Need revolving" },
        { value: "€400bn", title: "Credit gap" },
      ],
      takeaway: "The product is [[the intersection.]]",
    },
  },
];

/* ═════════════ Stress deck (?stress=1): every field filled to its limit, within the rules ═════════════
   The claim under test: if a slide passes validate(), it fits. */
const WORDS = ["market", "credit", "the", "growth", "customers", "revenue", "and", "for", "business", "card", "a", "lending", "of", "spend"];
const W = (n) => { let t = "", i = 0; while (t.length < n) t += (t ? " " : "") + WORDS[i++ % WORDS.length]; return t.slice(0, n).trim(); };
const TIMES = (n) => Array.from({ length: n });

/** The limit of a field path for a style, read from the registry so the stress deck follows the schema. */
function max(id, style, ...path) {
  let d = { fields: fieldsFor(id, style) };
  for (const k of path) d = d.fields?.[k] || d.of?.fields?.[k];
  if (d.type === "list") d = d.of;
  return typeof d.max === "object" ? d.max[style] : d.max;
}

export function stressFor(st) {
  const c = st === "consulting";
  const frame = (id) => ({
    ...(c ? { kicker: W(40) } : { subtitle: W(max(id, st, "subtitle")) }),
    title: W(max(id, st, "title")), takeaway: W(max(id, st, "takeaway")), footnote: W(110), source: W(110),
  });
  const bars = { categories: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"], format: "£{v}m", series: [
    { name: "Interest income", mark: "bar", color: "neutral", values: [1, 3, 14, 42, 85, 99] }, { name: "Interchange", mark: "bar", color: "focus", values: [1, 2, 11, 36, 80, 95] },
    { name: "Gross margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31, 36, 38, 40] }] };
  const notes = (n, withPoint) => TIMES(n).map((_, i) => ({ title: W(28), ...(c ? { text: W(i ? 75 : 50) } : {}), ...(withPoint ? { point: { series: 1, index: i + 2 } } : {}) }));
  const rows = (n, noted) => TIMES(n).map(() => ({ cells: [W(noted ? 40 : 24), noted ? { value: "(1,234)", note: "8% × £10.5k" } : "(1,234)", "12,345", "(34)"] }));
  return [
    { template: "cover", name: "Stress · cover", title: W(max("cover", st, "title")), subtitle: W(max("cover", st, "subtitle")) },
    { template: "section", name: "Stress · section", title: W(max("section", st, "title")), subtitle: W(max("section", st, "subtitle")) },
    { template: "number", name: "Stress · number", ...frame("number"), body: TIMES(c ? 2 : 1).map(() => W(max("number", st, "body"))), number: { value: "€400bn", caption: W(max("number", st, "number", "caption")) } },
    { template: "chart", name: "Stress · chart + notes", ...frame("chart"), chart: bars, notes: notes(3, true) },
    { template: "chart", name: "Stress · chart full", ...frame("chart"), chart: { categories: TIMES(12).map((_, i) => `Q${i % 4 + 1} ’${27 + (i >> 2)}`), format: "£{v}m",
      series: [{ name: "Base case", mark: "line", color: "focus", area: true, values: TIMES(12).map((_, i) => (i + 1) ** 2) }, { name: "Downside", mark: "line", color: "contrast", dashed: true, values: TIMES(12).map((_, i) => (i + 1) ** 2 * .6) }, { name: "Market", mark: "line", color: "neutral", values: TIMES(12).map((_, i) => 20 + i * 5) }] } },
    { template: "chart", name: "Stress · chart stacked", ...frame("chart"), chart: { stacked: true, categories: TIMES(6).map((_, i) => `Year ${i + 1}`), format: "£{v}m",
      series: [{ name: W(24), mark: "bar", color: "focus", values: [4, 9, 15, 24, 33, 41] }, { name: W(24), mark: "bar", color: "neutral", values: [2, 5, 9, 14, 20, 26] },
        { name: W(24), mark: "bar", color: "contrast", values: [1, 2, 4, 7, 11, 15] }, { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 18, 24, 29, 33, 36] }] } },
    { template: "table", name: "Stress · table full", ...frame("table"), table: { columns: [{ label: W(26) }, ...TIMES(4).map((_, i) => ({ label: W(12), focus: i === 0 }))],
      rows: c ? [...TIMES(5).map(() => ({ cells: [W(40), { value: "(1,234)", note: "8% × £10.5k" }, "12,345", "(34)", "—"] })), { cells: [W(30), "£179", "£10", "£128", "£95"], style: "total" }]
              : [...TIMES(4).map(() => ({ cells: [W(30), "(1,234)", "12,345", "(34)", "—"] })), { cells: [W(24), "£179", "£10", "£128", "£95"], style: "total" }] } },
    { template: "table", name: "Stress · table + notes", ...frame("table"), notes: notes(3, false), table: { columns: [{ label: W(20) }, ...TIMES(3).map((_, i) => ({ label: W(12), focus: i === 0 }))],
      rows: c ? [...rows(5, false), { cells: [W(24), "£179", "£10", "£128"], style: "total" }] : [...rows(4, false), { cells: [W(24), "£179", "£10", "£128"], style: "total" }] } },
    { template: "steps", name: "Stress · steps", ...frame("steps"), steps: TIMES(c ? 5 : 3).map((_, i) => ({ when: "Q3 2027+", title: W(max("steps", st, "steps", "title")), text: W(max("steps", st, "steps", "text")), focus: i === 1 })) },
    { template: "cards", name: "Stress · cards icon ×3", ...frame("cards"), cards: TIMES(3).map(() => c ? { icon: "zap", title: W(24), bullets: TIMES(3).map(() => W(40)) } : { icon: "zap", title: W(22), text: W(50) }) },
    { template: "cards", name: "Stress · cards icon ×4", ...frame("cards"), cards: TIMES(4).map(() => c ? { icon: "zap", title: W(24), bullets: TIMES(2).map(() => W(48)) } : { icon: "zap", title: W(22), text: W(30) }) },
    { template: "cards", name: "Stress · cards value ×4", ...frame("cards"), cards: TIMES(4).map((_, i) => ({ value: "€400bn", title: W(c ? 24 : 22), text: W(c ? 80 : 44), tone: i === 1 ? "focus" : "neutral" })) },
    { template: "cards", name: "Stress · cards framed", ...frame("cards"), framed: true, cards: TIMES(2).map((_, i) => ({ tone: i ? "focus" : "neg", label: W(30), title: W(14),
      ...(c ? { bullets: TIMES(3).map(() => W(48)), facts: TIMES(2).map(() => ({ label: W(14), text: W(38) })) } : { text: W(50) }) })) },
  ];
}
