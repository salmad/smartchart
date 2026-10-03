// The code checks (spec §4): only what is exact and stable. What depends on the slide schema's details (focus,
// marks, totals) is a case question for the judge, so a schema change breaks nothing here.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { plain, validate } from '@/engine/slides/schema'
import type { Slide } from '@/engine/types'
import type { Case, Check, Deck, Measured, Transcript } from './types'

const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }
const FIGURE = /(?<![\w.])[£$€]?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(bn|b|m|k|%|x)?(?!\w)/gi
/** Figures in a text: separators and currency dropped, scale applied, % and x kept as units, sign ignored, never rounded. */
export function figures(text: string): { key: string; text: string }[] {
  return [...text.matchAll(FIGURE)].map((m) => {
    const unit = (m[3] ?? '').toLowerCase(), value = Number(`${m[1].replace(/,/g, '')}${m[2] ?? ''}`) * (SCALE[unit] ?? 1)
    return { key: `${Number(value.toPrecision(12))}${unit === '%' || unit === 'x' ? unit : ''}`, text: m[0] }
  })
}

// Positions and indices, not figures a reader sees.
const NOT_SHOWN = new Set(['from', 'to', 'start', 'end', 'x', 'y', 'series'])
/** Every piece of text on the slide, plain; a number under a `format` is written both raw and through it (18, £18m). */
export function slideText(s: Slide): string {
  const out: string[] = []
  const walk = (v: unknown, format: string | null, key: string): void => {
    if (typeof v === 'string') out.push(plain(v))
    else if (typeof v === 'number') { if (!NOT_SHOWN.has(key)) out.push(String(v), ...(format ? [format.replace('{v}', String(v))] : [])) }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, format, key))
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>, f = typeof o.format === 'string' ? o.format : format
      for (const [k, x] of Object.entries(o)) if (k !== 'format') walk(x, f, k)
    }
  }
  walk(s, null, '')
  return out.join('\n')
}

/** What the user gave: the prompt, plus the files the case puts in the folder. */
export const requestText = (c: Case, filesDir: string): string =>
  [c.prompt, ...c.files.map((f) => `${f}:\n${readFileSync(path.join(filesDir, f), 'utf8')}`)].join('\n\n')

/** F1–F2: the request's figures and names are on the slide; figures it doesn't state go to the judge (F3). */
export function factChecks(c: Case, s: Slide, request: string): { checks: Check[]; unknown: string[] } {
  const text = slideText(s), shown = figures(text), have = new Set(shown.map((f) => f.key)), asked = new Set(figures(request).map((f) => f.key))
  const lost = c.facts.numbers.filter((n) => figures(n).some((f) => !have.has(f.key)))
  const lostNames = c.facts.names.filter((n) => !text.toLowerCase().includes(n.toLowerCase()))
  const unknown = [...new Map(shown.filter((f) => !asked.has(f.key)).map((f) => [f.key, f.text])).values()]
  return { unknown, checks: [
    { id: 'F1', ok: !lost.length, msg: lost.length ? `Figures from the request missing: ${lost.join(', ')}` : 'Every figure from the request is on the slide' },
    { id: 'F2', ok: !lostNames.length, msg: lostNames.length ? `Names from the request missing: ${lostNames.join(', ')}` : 'Every name from the request is on the slide' },
  ] }
}

const tool = (name: string) => name.replace(/^mcp__smartchart__/, '')
const SLIDE_WRITES = ['create_slide', 'update_slide', 'change_template']
const asks = (text: string) => text.trim().split('\n').slice(-3).join(' ').includes('?')

/** S1–S4: the right kind of slide, one of it, asked only when the case is unclear, the expected style. */
export function choiceChecks(c: Case, t: Transcript, deck: Deck | null): Check[] {
  const slides = deck?.slides ?? [], wrote = t.calls.some((x) => SLIDE_WRITES.includes(tool(x.name)) && !x.isError), asked = asks(t.finalText), out: Check[] = []
  if (!c.ask) {
    const tpl = slides[0]?.slide.template, ok = !!tpl && (tpl === c.gold || c.acceptable.includes(tpl))
    out.push({ id: 'S1', ok, msg: `${tpl ?? 'No slide'}; expected ${[c.gold, ...c.acceptable].join(' or ')}` })
  }
  const want = c.ask ? 0 : 1
  out.push({ id: 'S2', ok: slides.length === want, msg: `${slides.length} slides; expected ${want}` })
  out.push(c.ask
    ? { id: 'S3', ok: asked && !wrote, msg: wrote ? 'Wrote a slide instead of asking' : asked ? 'Asked first' : 'Neither asked nor wrote' }
    : { id: 'S3', ok: wrote || !asked, msg: wrote ? 'Wrote the slide' : 'Asked instead of writing a clear request' })
  if (deck) out.push({ id: 'S4', ok: deck.style === c.style, msg: `Style ${deck.style}; expected ${c.style}` })
  return out
}

/** R1–R3: the existing fixture's fit issues and layout lints, and validate(). */
export function renderChecks(deck: Deck | null, measured: Measured[]): Check[] {
  if (!deck?.slides.length) return []
  const fit = measured.flatMap((m) => m.fit), lints = measured.flatMap((m) => m.issues)
  const errors = deck.slides.flatMap((s) => validate(s.slide, deck.style).errors.map(String))
  return [
    { id: 'R1', ok: !fit.length, msg: fit.length ? fit.join('; ') : 'Fits: no overflow or overlap' },
    { id: 'R2', ok: !lints.length, msg: lints.length ? lints.join('; ') : 'Layout lints clean' },
    { id: 'R3', ok: !errors.length, msg: errors.length ? errors.join('; ') : 'Validates' },
  ]
}

const LOOK = ['style', 'theme', 'accent', 'layout', 'color', 'colors', 'colour', 'colours', 'page', 'footer']
const keysOf = (v: unknown): string[] => (v && typeof v === 'object' ? Object.keys(v) : [])
const json = (s: string): Record<string, unknown> => { try { const v: unknown = JSON.parse(s); return v && typeof v === 'object' ? (v as Record<string, unknown>) : {} } catch { return {} } }

/** P1–P7, did the server's instructions land: read before writing, fix issues, check, pass the request, leave the look
    alone, reply briefly with the link, need no other tool. */
export function wiringChecks(c: Case, t: Transcript, deck: Deck | null): Check[] {
  const calls = t.calls.map((x) => ({ ...x, tool: tool(x.name) })), writes = calls.filter((x) => SLIDE_WRITES.includes(x.tool)), out: Check[] = []
  const add = (id: string, ok: boolean, pass: string, fail: string) => out.push({ id, ok, msg: ok ? pass : fail })
  if (writes.length) {
    const first = calls.indexOf(writes[0]), before = calls.slice(0, first), tpl = deck?.slides[0]?.slide.template
    const guide = before.some((x) => x.tool === 'get_guide'), card = before.some((x) => x.tool === 'get_template' && x.input.template === tpl)
    add('P1', guide && card, 'Read the guide and the card before writing', `Wrote before reading ${[!guide && 'the guide', !card && `the ${tpl ?? ''} card`].filter(Boolean).join(' and ')}`)
    const last = writes[writes.length - 1], issues = json(last.result).issues
    const left = Array.isArray(issues) ? issues.map((i) => (typeof i === 'string' ? i : JSON.stringify(i))) : []
    add('P2', !last.isError && !left.length, 'The last write returned no issues', last.isError ? `The last write failed: ${last.result.slice(0, 200)}` : `The last write left: ${left.join('; ')}`)
    add('P3', calls.slice(calls.indexOf(last) + 1).some((x) => x.tool === 'check_slide'), 'Checked the slide after the last write', 'No check_slide after the last write')
    const bare = writes.filter((x) => { const r = x.input.request; return typeof r !== 'string' || !r.trim() }).length
    add('P4', !bare, 'Every write passed the request', `${bare} of ${writes.length} writes without the request`)
  }
  const touched = calls.flatMap((x) => {
    if (x.tool === 'create_deck' || x.tool === 'update_deck') return keysOf(x.input).filter((k) => k === 'theme' || k === 'accent')
    if (x.tool === 'create_slide' || x.tool === 'change_template') return keysOf(x.input.slide).filter((k) => LOOK.includes(k))
    if (x.tool === 'update_slide') return keysOf(x.input.set).filter((p) => LOOK.includes(p.split(/[.[]/)[0]))
    return []
  })
  add('P5', !touched.length, 'Left the look to SmartChart', `Set ${[...new Set(touched)].join(', ')}`)
  if (!c.ask) {
    const text = t.finalText.trim(), words = text.split(/\s+/).filter(Boolean).length, hasJson = /[{[]\s*"/.test(text), link = !!deck && text.includes(deck.edit)
    add('P6', words <= 120 && !hasJson && link, 'Short reply with the editor link', [words > 120 && `${words} words`, hasJson && 'JSON in the reply', !link && 'no editor link'].filter(Boolean).join(', '))
  }
  const denied = t.outcome?.denials ?? []
  add('P7', !denied.length, 'No tool call needed approval', `Denied: ${denied.join(', ')}`)
  return out
}
