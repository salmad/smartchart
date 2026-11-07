// The engagement emails (FUTURE #31): Occam's Paper look, a finished slide in each, one action.
// Email clients drop <style> blocks and classes unevenly, so styles are inline here (email HTML, not app UI).
// Images are served from public/email/ on the site.

export type EmailKey = '1-connect' | '2-line' | '3-templates' | '4-connect-again' | '4b-so-what' | '5-cagr' | '6-docs' | '7-partner'

export interface EmailVars {
  /** First name, or '' when unknown. */
  first: string
  /** Signed up before the series started: day 0 greets them as a returning maker. */
  existing: boolean
  /** Their latest deck, for email 5. */
  deck: { name: string; id: string } | null
  unsubscribeUrl: string
}

export interface RenderedEmail { subject: string; html: string; text: string }

export const SITE = 'https://www.occamslides.com'
const IMG = `${SITE}/email/`

const C = { paper: '#F5F5F3', card: '#FFFFFF', type: '#121211', type2: '#5C5B57', type3: '#8A8984', rule: '#E1E0DB', gold: '#E8B94A' }
const DISPLAY = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const SANS = "'Geist', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "'Geist Mono', ui-monospace, Menlo, Consolas, monospace"

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Inline marks in copy: *em* → the one emphasis (grey, as the site's headings), **b** → strong.
const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.type};font-weight:600">$1</strong>`).replace(/\*(.+?)\*/g, `<span style="color:${C.type3}">$1</span>`)
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')

/** One piece of an email body, kept as data so the HTML and the plain-text part come from the same copy. */
type Block =
  | { p: string } | { small: string } | { quote: string } | { list: string[] }
  | { slide: string; alt: string; label: string } | { button: string; href: string }

function html(b: Block): string {
  if ('p' in b) return `<p style="margin:0 0 16px;font:400 16px/1.6 ${SANS};color:${C.type2}">${md(b.p)}</p>`
  if ('small' in b) return `<p style="margin:-12px 0 24px;font:400 14px/1.5 ${SANS};color:${C.type3}">${md(b.small)}</p>`
  if ('quote' in b) return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px"><tr>
  <td width="3" style="background:${C.gold};border-radius:2px"></td>
  <td style="padding:12px 16px;background:${C.paper};font:400 15px/1.55 ${SANS};color:${C.type}">${md(b.quote)}</td></tr></table>`
  if ('list' in b) return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px">${b.list.map((it, i) => `
  <tr><td valign="top" width="34" style="padding:10px 0;border-top:1px solid ${C.rule};font:500 12px/1.6 ${MONO};color:${C.type3}">${String(i + 1).padStart(2, '0')}</td>
  <td style="padding:10px 0;border-top:1px solid ${C.rule};font:400 15px/1.55 ${SANS};color:${C.type2}">${md(it)}</td></tr>`).join('')}</table>`
  if ('slide' in b) return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0"><tr><td style="border-radius:12px;box-shadow:0 0 0 1px ${C.rule},0 18px 40px -24px rgba(18,18,17,.45)">
    <img src="${IMG}${b.slide}" width="520" alt="${esc(b.alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:12px">
  </td></tr></table>
  <p style="margin:0 0 28px;font:500 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${C.type3}">Made in Occam · ${esc(b.label)}</p>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px"><tr>
    <td style="border-radius:999px;background:${C.type}"><a href="${esc(b.href)}" style="display:inline-block;padding:13px 22px;font:500 15px/1 ${SANS};color:${C.paper};text-decoration:none;border-radius:999px">${esc(b.button)} &rarr;</a></td></tr></table>`
}

function text(b: Block): string {
  if ('p' in b) return plain(b.p)
  if ('small' in b) return plain(b.small)
  if ('quote' in b) return `> ${plain(b.quote)}`
  if ('list' in b) return b.list.map((it) => `- ${plain(it)}`).join('\n')
  if ('slide' in b) return `[Made in Occam: ${b.label}]`
  return `${b.button}: ${b.href}`
}

interface Spec { subject: string; preview: string; eyebrow: string; title: string; body: Block[] }

/** A link into the site through /em/<email>: the app records that path as the visit (Vercel Web Analytics shows
    visits per email in Pages), then moves on to `rest`. src/app/email-entry.ts does the move. */
export const entry = (key: EmailKey, rest = '/') => `${SITE}/em/${key}${rest}`
/** A short video, through the site first so the click is counted like any other (email-entry.ts forwards it). */
const watch = (key: EmailKey, id: string) => entry(key, `/watch/${id}`)

function specFor(key: EmailKey, v: EmailVars): Spec {
  const at = (rest?: string) => entry(key, rest)
  switch (key) {
    case '1-connect': return {
      subject: 'Set up Occam in Claude', preview: 'Connect your Occam account to Claude, ChatGPT or Cursor.',
      eyebrow: 'Setup', title: 'Set up Occam in Claude. *It takes about a minute.*',
      body: [
        { p: v.existing ? 'You can now use Occam from Claude, ChatGPT or Cursor. To set it up:' : 'Thanks for signing up. You can use Occam from Claude, ChatGPT or Cursor. To set it up:' },
        { list: ['**Make a key:** in Occam, open your account menu and choose Connect an agent.', '**Add it to your agent:** copy the setup shown for Claude, ChatGPT or Cursor.', '**Ask for a deck:** for example, “Make a 6-slide deck from this report.” It appears in Occam as your agent writes it.'] },
        { slide: 's3-consulting.jpg', alt: 'A slide whose title states the point, proved by a bar and line chart with three notes on the right', label: 'Chart with notes, written by an agent' },
        { p: 'Each slide is checked as it is written: the title states the point, the numbers fit and nothing overflows.' },
        { button: 'Connect your agent', href: at('/?connect=1') },
        { small: 'No agent? You can use Occam’s own chat instead.' },
      ] }
    case '2-line': return {
      subject: 'How to write slide titles in Occam', preview: 'Write the point in the title, and let the chart prove it.',
      eyebrow: 'Guide', title: 'Write the point in the title. *The chart proves it.*',
      body: [
        { p: 'A slide title works best as a full sentence that states the conclusion, not as a label. For example:' },
        { list: ['**Label:** Loan book, 2027 to 2028', '**Point:** The base case reaches a £120m book by Q4 2028; the downside still clears £70m'] },
        { slide: 's13-consulting.jpg', alt: 'A line chart slide titled: The base case reaches a £120m book by Q4 2028; the downside still clears £70m', label: 'Line chart, two scenarios' },
        { p: 'Occam flags titles that are labels, so you can fix them before you share the deck.' },
        { button: 'Watch a 29-second example', href: watch(key, 'NwgboFYXgcY') },
      ] }
    case '3-templates': return {
      subject: 'How to pick a slide template in Occam', preview: 'Choose the template by what the slide needs to show.',
      eyebrow: 'Guide', title: 'Pick a template by what the slide shows.',
      body: [
        { p: 'When you add a slide in Occam, you choose a template first. Pick it by what the slide needs to show:' },
        { list: ['**Comparing options:** scoring table, with ✓, ✗ and Harvey balls', '**Positioning:** matrix, with notes on the right saying why', '**Numbers side by side:** table', '**Plans over time:** timeline, with the critical path marked'] },
        { slide: 'templates-grid.jpg', alt: 'Four Occam slides: a scoring table, a matrix with notes on the right, a margin table and a launch timeline', label: 'Scoring, matrix, table, timeline' },
        { p: 'To add one, open a deck and choose Add slide, or ask your agent: “Add a scoring table comparing the four options.”' },
        { button: 'Open the template list', href: at('/new') },
      ] }
    case '4-connect-again': return {
      subject: 'Finish setting up Occam in Claude', preview: 'Your account isn’t connected to an agent yet.',
      eyebrow: 'Setup', title: 'Finish setting up Occam. *One step left.*',
      body: [
        { p: 'Your Occam account isn’t connected to an agent yet. Once it is, you can ask for a deck in one sentence:' },
        { quote: 'Make me a 6-slide deck from this report for the leadership meeting. Put the point of each slide in its title.' },
        { slide: 's21-consulting.jpg', alt: 'A next-steps slide: four steps take you from a blank page to a deck you can present', label: 'Next steps table' },
        { p: 'To connect, open your account menu in Occam, choose Connect an agent and copy the setup for your agent. After that, comments you leave on a slide (“too wordy”, “use Q3’s number”) can be fixed by your agent too.' },
        { button: 'Connect your agent', href: at('/?connect=1') },
      ] }
    case '4b-so-what': return {
      subject: 'Slide titles: topic or point?', preview: 'How to check your titles, with an example.',
      eyebrow: 'Guide', title: 'Topic or point? *Check your titles.*',
      body: [
        { p: 'Readers take in the title first. If it only names the topic, they have to work out the conclusion from the chart. Compare:' },
        { list: ['**Topic:** ARR bridge, FY25 to FY26', '**Point:** ARR reaches £17.5m in FY26; new customers add £6.2m of the £7.7m growth'] },
        { slide: 's15-consulting.jpg', alt: 'A waterfall slide whose title states that new customers add £6.2m of the £7.7m growth', label: 'Waterfall with a point as its title' },
        { p: 'To check a deck, read only the titles in order. If they don’t tell the story, ask your agent: “Rewrite each title as the point the slide proves.”' },
        { button: 'Watch a 25-second example', href: watch(key, 'T-4zj3FsNeA') },
      ] }
    case '5-cagr': return {
      subject: 'How to show a growth rate on an Occam chart', preview: 'Add a CAGR mark; Occam works out the rate from your numbers.',
      eyebrow: 'Guide', title: 'Show the growth rate on the chart. *Occam works it out.*',
      body: [
        { p: 'When a title states a growth rate, add a CAGR mark to the chart. Occam calculates the rate from your numbers and draws it between the two bars, so the title and the chart agree.' },
        { slide: 's14-consulting.jpg', alt: 'A bar chart of a loan book from 2026 to 2030 with an 86% CAGR line and a £100m plan line', label: 'Chart with CAGR and target' },
        { p: 'Other marks work the same way:' },
        { list: ['**Difference:** the gap between two bars, labelled', '**Target:** a goal line, and how far you are from it', '**Notes:** short observations beside the chart on what it doesn’t show'] },
        { quote: `Add a CAGR from 2024 to 2026 on the revenue chart${v.deck ? ` in ${v.deck.name}` : ''}.` },
        v.deck ? { button: `Open ${v.deck.name}`, href: at(`/d/${encodeURIComponent(v.deck.id)}`) } : { button: 'Open Occam', href: at() },
      ] }
    case '6-docs': return {
      subject: 'Writing docs in Occam', preview: 'When to use a doc instead of a deck, and how to start one.',
      eyebrow: 'Guide', title: 'Use a doc when it will be read, not presented.',
      body: [
        { p: 'Occam has docs as well as decks. Use one for a PRD, a memo or a competitor teardown.' },
        { slide: 'doc-prd.jpg', alt: 'An Occam doc: a product requirements document with goals and a decision callout', label: 'Product requirements doc' },
        { p: 'Docs take the same charts and tables as slides, and Occam checks them the same way. To start one, choose New doc in the sidebar and pick a starter, or ask your agent: “Write a one-page PRD for …”.' },
        { button: 'Start a doc', href: at('/?new=doc') },
      ] }
    case '7-partner': return {
      subject: 'What Occam checks on each slide', preview: 'The checks every slide goes through, with an example.',
      eyebrow: 'Checks', title: 'What Occam checks. *On every slide.*',
      body: [
        { p: 'Every slide in Occam goes through the same checks:' },
        { list: ['**The title states the point,** not the topic.', '**The numbers back it:** the chart or table shows what the title claims.', '**One point per slide.**', '**Nothing overflows** or overlaps.'] },
        { slide: 's10-consulting.jpg', alt: 'A ranked bar slide titled: Low limits are the top reason SMEs turn down a business card, ahead of fees', label: 'Ranked bars' },
        { button: 'Watch a 32-second example', href: watch(key, '9oMUFAJIgLQ') },
        { p: 'If something in Occam isn’t working for you, reply to this email. I read every reply.' },
      ] }
  }
}

export function renderEmail(key: EmailKey, v: EmailVars): RenderedEmail {
  const s = specFor(key, v)
  const hi = v.first ? `Hi ${v.first},` : 'Hi,'
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(s.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">
<style>@media (max-width:480px){.card{padding:28px 20px 4px !important}.h1{font-size:32px !important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(s.preview)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.paper}"><tr><td align="center" style="padding:32px 16px 40px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px">
    <tr><td style="padding:0 8px 20px">
      <a href="${entry(key)}" style="text-decoration:none;color:${C.type}"><img src="${IMG}mark.png" width="24" height="24" alt="" style="vertical-align:middle;border:0;border-radius:6px">
      <span style="vertical-align:middle;margin-left:8px;font:800 20px/1 ${DISPLAY};font-stretch:78%;letter-spacing:-.01em;color:${C.type}">Occam</span></a>
    </td></tr>
    <tr><td class="card" style="background:${C.card};border-radius:20px;box-shadow:0 0 0 1px ${C.rule},0 1px 2px rgba(18,18,17,.04);padding:40px 40px 12px">
      <p style="margin:0 0 14px;font:500 11px/1.4 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:${C.type3}">${esc(s.eyebrow)}</p>
      <h1 class="h1" style="margin:0 0 24px;font:400 38px/1.02 ${DISPLAY};font-stretch:78%;letter-spacing:-.02em;color:${C.type}">${md(s.title)}</h1>
      <p style="margin:0 0 16px;font:400 16px/1.6 ${SANS};color:${C.type2}">${esc(hi)}</p>
      ${s.body.map(html).join('\n      ')}
      <p style="margin:0 0 28px;font:400 16px/1.6 ${SANS};color:${C.type2}">Sam<br><span style="color:${C.type3}">Founder, Occam</span></p>
    </td></tr>
    <tr><td style="padding:24px 8px 0;font:400 12px/1.6 ${SANS};color:${C.type3}">
      If it isn’t beautiful, it’s probably wrong.<br>
      You’re getting this because you signed up for Occam. <a href="${esc(v.unsubscribeUrl)}" style="color:${C.type3}">Unsubscribe</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
  const body = [hi, '', ...s.body.map(text).flatMap((t) => [t, '']), 'Sam', 'Founder, Occam', '', '—', `Unsubscribe: ${v.unsubscribeUrl}`].join('\n')
  return { subject: s.subject, html: page, text: body }
}
