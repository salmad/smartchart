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

// A plain letter from Sam: system type, no layout tables, one slide, links as text. Gmail files designed, image-led
// emails under Promotions; this reads as person-to-person mail.
const C = { type: '#121211', type2: '#3F3E3A', type3: '#8A8984', rule: '#E1E0DB' }
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Inline marks in copy: **b** → bold.
const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1')

/** One piece of an email body, kept as data so the HTML and the plain-text part come from the same copy. */
type Block =
  | { p: string } | { small: string } | { quote: string } | { list: string[] }
  | { slide: string; alt: string; label: string } | { link: string; href: string }

function html(b: Block): string {
  if ('p' in b) return `<p style="margin:0 0 14px">${md(b.p)}</p>`
  if ('small' in b) return `<p style="margin:0 0 14px;color:${C.type3}">${md(b.small)}</p>`
  if ('quote' in b) return `<p style="margin:0 0 14px;padding:2px 0 2px 12px;border-left:3px solid ${C.rule};color:${C.type}">${md(b.quote)}</p>`
  if ('list' in b) return `<ul style="margin:0 0 14px;padding-left:20px">${b.list.map((it) => `<li style="margin:0 0 6px">${md(it)}</li>`).join('')}</ul>`
  if ('slide' in b) return `<p style="margin:6px 0 4px"><img src="${IMG}${b.slide}" width="560" alt="${esc(b.alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid ${C.rule};border-radius:6px"></p>
<p style="margin:0 0 16px;font-size:12px;color:${C.type3}">Made in Occam: ${esc(b.label)}</p>`
  return `<p style="margin:0 0 14px"><a href="${esc(b.href)}" style="color:${C.type};font-weight:600">${esc(b.link)} &rarr;</a></p>`
}

function text(b: Block): string {
  if ('p' in b) return plain(b.p)
  if ('small' in b) return plain(b.small)
  if ('quote' in b) return `> ${plain(b.quote)}`
  if ('list' in b) return b.list.map((it) => `- ${plain(it)}`).join('\n')
  if ('slide' in b) return `[Made in Occam: ${b.label}]`
  return `${b.link}: ${b.href}`
}

interface Spec { subject: string; preview: string; body: Block[] }

/** A link into the site through /em/<email>: the app records that path as the visit (Vercel Web Analytics shows
    visits per email in Pages), then moves on to `rest`. src/app/email-entry.ts does the move. */
export const entry = (key: EmailKey, rest = '/') => `${SITE}/em/${key}${rest}`
/** A short video, through the site first so the click is counted like any other (email-entry.ts forwards it). */
const watch = (key: EmailKey, id: string) => entry(key, `/watch/${id}`)

function specFor(key: EmailKey, v: EmailVars): Spec {
  const at = (rest?: string) => entry(key, rest)
  switch (key) {
    case '1-connect': return {
      subject: 'Your agent can make the slides now', preview: 'Connect Occam to Claude in about a minute.',
      body: [
        { p: `${v.existing ? 'You’ve made slides in Occam; now let your agent make them.' : 'Thanks for trying Occam.'} Most people now make their slides by asking an agent: Claude, ChatGPT or Cursor. Connect Occam once and your agent builds the deck here, while you watch it change live.` },
        { slide: 's3-consulting.jpg', alt: 'A slide whose title states the point, proved by a bar and line chart with three notes on the right', label: 'Chart with notes, written by an agent' },
        { p: 'Every slide is checked before you see it: the title makes the point, the numbers fit, nothing spills.' },
        { link: 'Connect your agent', href: at('/?connect=1') },
        { small: 'No agent? Start in Occam’s own chat instead.' },
      ] }
    case '2-line': return {
      subject: 'Your boss didn’t read your bullets', preview: 'A 29-second fix for the slide everyone skims.',
      body: [
        { p: 'Most slides hide their point in the third bullet. The room reads the title, skims the rest and moves on. The fix: say the point up top, then let the chart show the evidence.' },
        { slide: 's13-consulting.jpg', alt: 'A line chart slide titled: The base case reaches a £120m book by Q4 2028; the downside still clears £70m', label: 'Line chart, two scenarios' },
        { link: 'Watch the fix (29s)', href: watch(key, 'NwgboFYXgcY') },
        { p: 'Occam flags a title that isn’t a claim before anyone else sees it. Try it on the busiest slide you have.' },
      ] }
    case '3-templates': return {
      subject: '30 slide shapes, already designed', preview: 'Pick what the slide needs to show. The layout is done.',
      body: [
        { p: 'Every slide in Occam starts from a template built for one job. You never pick fonts, colours or spacing, and every deck keeps one look.' },
        { slide: 'templates-grid.jpg', alt: 'Four Occam slides: a scoring table, a matrix with notes on the right, a margin table and a launch timeline', label: 'Scoring, matrix, table, timeline' },
        { list: ['**Scoring table:** options compared with ✓, ✗ and Harvey balls', '**Matrix with notes:** where each option sits, and notes on the right saying why the gap is open', '**Table:** unit economics or plans, side by side', '**Timeline:** workstreams that run side by side, and the one on the critical path'] },
        { link: 'Browse all 30 templates', href: at('/new') },
      ] }
    case '4-connect-again': return {
      subject: 'One sentence to your agent, a finished deck here', preview: 'Paste this into Claude once you’ve connected.',
      body: [
        { p: 'Once Occam is connected, this is all it takes:' },
        { quote: 'Make me a 6-slide deck from this report for the leadership meeting. Put the point of each slide in its title.' },
        { slide: 's21-consulting.jpg', alt: 'A next-steps slide: four steps take you from a blank page to a deck you can present', label: 'Next steps table' },
        { p: 'Your agent writes, Occam checks every slide, and you watch it happen. Then leave a comment (“too wordy”, “use Q3’s number”) and your agent fixes it.' },
        { link: 'Connect your agent', href: at('/?connect=1') },
      ] }
    case '4b-so-what': return {
      subject: '“What’s the so what?”', preview: 'What your boss means, and the 25-second fix.',
      body: [
        { p: 'When someone asks “what’s the so-what?”, the title says what the slide is about, not what it means.' },
        { slide: 's15-consulting.jpg', alt: 'A waterfall slide whose title states that new customers add £6.2m of the £7.7m growth', label: 'Waterfall with a claim title' },
        { link: 'Watch the fix (25s)', href: watch(key, 'T-4zj3FsNeA') },
        { p: 'Next time, ask your agent to retitle your deck so every title makes a point. Occam flags any that still don’t.' },
      ] }
    case '5-cagr': return {
      subject: 'The number your room checks first', preview: 'Growth rates, gaps and targets, drawn on the chart.',
      body: [
        { p: 'When a title claims a growth rate, the room looks for proof. Occam draws the CAGR between the two bars and works out the rate from your numbers, so the title and the chart always agree.' },
        { slide: 's14-consulting.jpg', alt: 'A bar chart of a loan book from 2026 to 2030 with an 86% CAGR line and a £100m plan line', label: 'Chart with CAGR and target' },
        { list: ['**Difference:** the gap between two bars, labelled', '**Target:** a goal line, and how far you are from it', '**Notes:** three observations that say what the chart doesn’t show'] },
        { quote: `Add a CAGR from 2024 to 2026 on the revenue chart${v.deck ? ` in ${v.deck.name}` : ''}.` },
        v.deck ? { link: `Open ${v.deck.name}`, href: at(`/d/${encodeURIComponent(v.deck.id)}`) } : { link: 'Open Occam', href: at() },
      ] }
    case '6-docs': return {
      subject: 'When the room needs to read, not watch', preview: 'Occam makes docs too: PRDs, memos, teardowns.',
      body: [
        { p: 'A PRD, a memo or a competitor teardown gets read, not presented. Occam docs use the same charts, tables and checks as your slides, laid out as pages, and your agent writes them the same way.' },
        { slide: 'doc-prd.jpg', alt: 'An Occam doc: a product requirements document with goals and a decision callout', label: 'Product requirements doc' },
        { p: 'A doc can sit under a deck as the detail behind it. Start from a PRD, a competitor teardown or a legal memo.' },
        { link: 'Start a doc', href: at('/?new=doc') },
      ] }
    case '7-partner': return {
      subject: 'The intern’s slide vs the partner’s', preview: 'Same data, very different slide. 32 seconds.',
      body: [
        { p: 'One slide lists everything. The other makes one point and proves it.' },
        { slide: 's10-consulting.jpg', alt: 'A ranked bar slide titled: Low limits are the top reason SMEs turn down a business card, ahead of fees', label: 'Ranked bars' },
        { link: 'Watch the difference (32s)', href: watch(key, '9oMUFAJIgLQ') },
        { p: 'Every slide in Occam is checked like a partner would check it: does the title make the point, do the numbers back it, is there one point per slide.' },
        { p: 'If Occam isn’t working for you yet, reply and tell me why. I read every reply.' },
      ] }
  }
}

export function renderEmail(key: EmailKey, v: EmailVars): RenderedEmail {
  const s = specFor(key, v)
  const hi = v.first ? `Hi ${v.first},` : 'Hi,'
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.subject)}</title></head>
<body style="margin:0;padding:0">
<div style="display:none;max-height:0;overflow:hidden">${esc(s.preview)}</div>
<div style="max-width:560px;padding:16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.type2}">
<p style="margin:0 0 14px">${esc(hi)}</p>
${s.body.map(html).join('\n')}
<p style="margin:18px 0 0">Sam<br>Founder, Occam</p>
<p style="margin:28px 0 0;font-size:12px;color:${C.type3}">You’re getting this because you signed up for Occam. <a href="${esc(v.unsubscribeUrl)}" style="color:${C.type3}">Unsubscribe</a></p>
</div>
</body></html>`
  const body = [hi, '', ...s.body.map(text).flatMap((t) => [t, '']), 'Sam', 'Founder, Occam', '', '—', `Unsubscribe: ${v.unsubscribeUrl}`].join('\n')
  return { subject: s.subject, html: page, text: body }
}
