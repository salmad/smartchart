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

function specFor(key: EmailKey, v: EmailVars): Spec {
  const at = (rest?: string) => entry(key, rest)
  switch (key) {
    case '1-connect': return {
      subject: 'Your agent can make the slides now', preview: 'Connect Occam to Claude in about a minute.',
      eyebrow: v.existing ? 'New in Occam' : 'Welcome to Occam', title: 'Your agent writes the deck. *Occam makes it right.*',
      body: [
        { p: `${v.existing ? 'You’ve made slides in Occam; now let your agent make them.' : 'Thanks for trying Occam.'} Most people now make their slides by asking an agent: Claude, ChatGPT or Cursor. Connect Occam once and your agent builds the deck here, while you watch it change live.` },
        { slide: 's3-consulting.jpg', alt: 'A slide whose title states the point, proved by a bar and line chart with three notes on the right', label: 'Chart with notes, written by an agent' },
        { p: 'Every slide is checked before you see it: the title makes the point, the numbers fit, nothing spills.' },
        { button: 'Connect your agent', href: at('/?connect=1') },
        { small: 'No agent? Start in Occam’s own chat instead.' },
      ] }
    case '2-line': return {
      subject: 'Your boss didn’t read your bullets', preview: 'A 29-second fix for the slide everyone skims.',
      eyebrow: 'One fix, 29 seconds', title: 'Put the point in the title. *Let the chart prove it.*',
      body: [
        { p: 'Most slides hide their point in the third bullet. The room reads the title, skims the rest and moves on. The fix: say the point up top, then let the chart show the evidence.' },
        { slide: 's13-consulting.jpg', alt: 'A line chart slide titled: The base case reaches a £120m book by Q4 2028; the downside still clears £70m', label: 'Line chart, two scenarios' },
        { button: 'Watch the fix (29s)', href: 'https://youtube.com/shorts/NwgboFYXgcY' },
        { p: 'Occam flags a title that isn’t a claim before anyone else sees it. Try it on the busiest slide you have.' },
      ] }
    case '3-templates': return {
      subject: '30 slide shapes, already designed', preview: 'Pick what the slide needs to show. The layout is done.',
      eyebrow: 'What Occam can do', title: 'Pick the shape. *Occam does the rest.*',
      body: [
        { p: 'Every slide in Occam starts from a template built for one job. You never pick fonts, colours or spacing, and every deck keeps one look.' },
        { slide: 'templates-grid.jpg', alt: 'Four Occam slides: a scoring table, a matrix with notes on the right, a margin table and a launch timeline', label: 'Scoring, matrix, table, timeline' },
        { list: ['**Scoring table:** options compared with ✓, ✗ and Harvey balls', '**Matrix with notes:** where each option sits, and notes on the right saying why the gap is open', '**Table:** unit economics or plans, side by side', '**Timeline:** workstreams that run side by side, and the one on the critical path'] },
        { button: 'Browse all 30 templates', href: at('/new') },
      ] }
    case '4-connect-again': return {
      subject: 'One sentence to your agent, a finished deck here', preview: 'Paste this into Claude once you’ve connected.',
      eyebrow: 'Connect your agent', title: 'One sentence in. *A checked deck out.*',
      body: [
        { p: 'Once Occam is connected, this is all it takes:' },
        { quote: 'Make me a 6-slide deck from this report for the leadership meeting. Put the point of each slide in its title.' },
        { slide: 's21-consulting.jpg', alt: 'A next-steps slide: four steps take you from a blank page to a deck you can present', label: 'Next steps table' },
        { p: 'Your agent writes, Occam checks every slide, and you watch it happen. Then leave a comment (“too wordy”, “use Q3’s number”) and your agent fixes it.' },
        { button: 'Connect your agent', href: at('/?connect=1') },
      ] }
    case '4b-so-what': return {
      subject: '“What’s the so what?”', preview: 'What your boss means, and the 25-second fix.',
      eyebrow: 'One fix, 25 seconds', title: '“Revenue by region” is a topic. *“New customers drove growth” is a point.*',
      body: [
        { p: 'When someone asks “what’s the so-what?”, the title says what the slide is about, not what it means.' },
        { slide: 's15-consulting.jpg', alt: 'A waterfall slide whose title states that new customers add £6.2m of the £7.7m growth', label: 'Waterfall with a claim title' },
        { button: 'Watch the fix (25s)', href: 'https://youtube.com/shorts/T-4zj3FsNeA' },
        { p: 'Next time, ask your agent to retitle your deck so every title makes a point. Occam flags any that still don’t.' },
      ] }
    case '5-cagr': return {
      subject: 'The number your room checks first', preview: 'Growth rates, gaps and targets, drawn on the chart.',
      eyebrow: 'Advanced charts', title: 'Say “86% a year”. *The chart proves it.*',
      body: [
        { p: 'When a title claims a growth rate, the room looks for proof. Occam draws the CAGR between the two bars and works out the rate from your numbers, so the title and the chart always agree.' },
        { slide: 's14-consulting.jpg', alt: 'A bar chart of a loan book from 2026 to 2030 with an 86% CAGR line and a £100m plan line', label: 'Chart with CAGR and target' },
        { list: ['**Difference:** the gap between two bars, labelled', '**Target:** a goal line, and how far you are from it', '**Notes:** three observations that say what the chart doesn’t show'] },
        { quote: `Add a CAGR from 2024 to 2026 on the revenue chart${v.deck ? ` in ${v.deck.name}` : ''}.` },
        v.deck ? { button: `Open ${v.deck.name}`, href: at(`/d/${encodeURIComponent(v.deck.id)}`) } : { button: 'Open Occam', href: at() },
      ] }
    case '6-docs': return {
      subject: 'When the room needs to read, not watch', preview: 'Occam makes docs too: PRDs, memos, teardowns.',
      eyebrow: 'Docs', title: 'Not everything should be a deck. *Some things get read.*',
      body: [
        { p: 'A PRD, a memo or a competitor teardown gets read, not presented. Occam docs use the same charts, tables and checks as your slides, laid out as pages, and your agent writes them the same way.' },
        { slide: 'doc-prd.jpg', alt: 'An Occam doc: a product requirements document with goals and a decision callout', label: 'Product requirements doc' },
        { p: 'A doc can sit under a deck as the detail behind it. Start from a PRD, a competitor teardown or a legal memo.' },
        { button: 'Start a doc', href: at('/?new=doc') },
      ] }
    case '7-partner': return {
      subject: 'The intern’s slide vs the partner’s', preview: 'Same data, very different slide. 32 seconds.',
      eyebrow: 'One fix, 32 seconds', title: 'Same numbers, two slides. *The room remembers one.*',
      body: [
        { p: 'One slide lists everything. The other makes one point and proves it.' },
        { slide: 's10-consulting.jpg', alt: 'A ranked bar slide titled: Low limits are the top reason SMEs turn down a business card, ahead of fees', label: 'Ranked bars' },
        { button: 'Watch the difference (32s)', href: 'https://youtube.com/shorts/9oMUFAJIgLQ' },
        { p: 'Every slide in Occam is checked like a partner would check it: does the title make the point, do the numbers back it, is there one point per slide.' },
        { p: 'If Occam isn’t working for you yet, reply and tell me why. I read every reply.' },
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
