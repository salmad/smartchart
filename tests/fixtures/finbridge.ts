/* FinBridge deck, slides 3 and 4 (docs/temp/new-templates/finbridge.*): a table with a target line and a flow beside
   it, and a heat table with a flow on its left. Shared by the unit and browser tests. */
import type { Flow } from '../../src/engine/types'

export const FLOW: Flow = { tiers: [
  { boxes: ['Accounts', 'Age', 'Industry', 'Directors', 'Web presence', 'Web traffic'].map((text) => ({ text })) },
  { boxes: [{ text: 'Acquisition engine scores every company' }], tone: 'strong' },
  { boxes: [{ text: 'Will they activate?' }, { text: 'What are they worth?' }], tone: 'light' },
  { boxes: [{ text: 'Predicted payback sets the ranking' }], tone: 'outline' },
  { boxes: [{ text: 'Direct mail' }, { text: 'Outbound sales' }], label: 'Feeds' },
] }
export const S3 = { template: 'table', kicker: '01 · Marketing', title: 'We will optimise marketing by targeting the companies that pay back fastest first',
  caption: 'Mailing rounds, best-scored first · illustrative', notesTitle: 'How we rank', flow: FLOW,
  takeaway: '**~2,500 customers** a round inside the hurdle, at a blended £800 each.',
  table: { columns: [{ label: 'Companies' }, { label: 'Months to pay back', bars: true, target: { value: 20, label: '20-month hurdle', better: 'below' } }, { label: 'Cost per customer' }, { label: 'Customers, total' }],
    rows: [['Top 0.5m', '5', '£500', '1,000'], ['0.5m–1m', '7', '£700', '1,700'], ['1m–1.5m', '11', '£1,000', '2,200'], ['1.5m–2m', '19', '£1,700', '2,500'], ['2m–2.5m', '31', '£2,500', '2,700'], ['2.5m–3m', '48', '£3,300', '2,850']].map((cells, i) => ({ cells, ...(i > 3 ? { style: 'muted' } : {}) })) } }
const g = (f: (r: number, c: number) => number) => [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => f(r, c)))
const money = (v: number) => (v < 0 ? `−£${-v}` : `£${v}`)
const GRID: [string, number[], number][] = [['£2.5k', [18, 53, 34, 15, 5], 1], ['£5k', [60, 189, 157, 79, 30], 1], ['£7.5k', [32, 279, 308, 190, 83], 1], ['£10k', [-61, 278, 433, 342, 171], 2], ['£15k', [-121, 366, 632, 606, 367], 2]]
export const S4 = { template: 'table', kicker: '02 · Origination', title: 'We set limit and price together, so every offer is the most profitable one that passes both tests',
  caption: 'Expected profit a year · £', notesTitle: 'How cells are priced', flowSide: 'left',
  flow: { tiers: [
    { boxes: [{ label: 'Take-up', grid: g((r, c) => 50 - c * 9 + r * 4) }, { label: 'Balance', grid: g((r) => 10 + r * 10) }, { label: 'Losses', grid: g((r, c) => 5 + r * 3 + c * 2) }], op: '·' },
    { boxes: [{ text: 'Expected profit for every limit and price' }], tone: 'strong' },
    { boxes: [{ text: 'Return ≥ 5%' }, { text: 'Recession profit' }], tone: 'outline', label: 'Tests' },
    { boxes: [{ text: 'Most profitable cell that passes' }], tone: 'light' },
  ] },
  takeaway: 'Our offer: **£15k at 39.9%**. Most lenders’ 19.9% fails at every limit.',
  table: { columns: [{ label: 'Limit' }, ...['19.9%', '29.9%', '39.9%', '49.9%', '59.9%'].map((label, j) => ({ label, heat: true, ...(j === 0 ? { outline: true } : {}) }))],
    rows: GRID.map(([l, vs, fails]) => ({ cells: [l, ...vs.map((v, j) => (j < fails ? { value: money(v), struck: true } : v === 632 ? `[[${money(v)}]]` : money(v)))] })),
    key: { focus: 'Our offer', struck: 'Fails a test', outline: 'Most lenders' } } }

