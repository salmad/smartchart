import { test, expect } from 'vitest'
import { contexts, slideHTML } from '@/engine/slides/render'
import { validate, validateDeck } from '@/engine/slides/schema'
import { figureOf } from '@/engine/slides/align'
import type { Slide, Table } from '@/engine/types'

const deck = (slides: Slide[]) => ({ style: 'consulting' as const, theme: 'ink' as const, footer: 'Acme', slides })
const section = (title: string, subtitle?: string): Slide => ({ template: 'section', title, ...(subtitle ? { subtitle } : {}) })
// The agenda has no title of its own unless one is given ("Agenda" by default).
const AGENDA = { template: 'agenda' } as Slide
const agendaAt = (slides: Slide[]) => { const d = deck(slides), i = slides.findIndex((s) => s.template === 'agenda'); return slideHTML(slides[i], contexts(d)[i], d) }

test('the agenda is the deck\'s chapter dividers, numbered; the agent writes none of it', () => {
  const html = agendaAt([AGENDA, section('The problem', 'SMEs fund growth on personal credit.'), section('The market')])
  expect(html).toContain('>Agenda<')
  expect(html.match(/<li/g)).toHaveLength(2)
  expect(html).toContain('<span class="n">02</span><span class="t">The market</span>')
  expect(html).toContain('SMEs fund growth on personal credit.')
  expect(html).not.toMatch(/class="(next|done)"/)
  expect(validate({ template: 'agenda', title: 'Contents' }, 'consulting').errors).toEqual([])
  expect(validate({ template: 'agenda', items: ['x'] }, 'consulting').errors[0]).toMatch(/items: not a field/)
})

test('after chapter k the agenda highlights the next chapter and quiets the ones covered; after the last, it is plain', () => {
  const html = agendaAt([section('A'), section('B'), AGENDA, section('C'), section('D')])
  expect(html).toMatch(/<li class="done"><span class="n">01/)
  expect(html).toMatch(/<li class="next"><span class="n">03/)
  expect(agendaAt([section('A'), section('B'), AGENDA])).not.toMatch(/class="(next|done)"/)
})

test('an agenda in a deck without chapters says so, and the deck warns', () => {
  expect(agendaAt([AGENDA])).toContain('No chapters yet')
  expect(validateDeck(deck([AGENDA])).warnings.join(' ')).toMatch(/agenda lists the chapter dividers/)
})

test('cards: a lead of number or none, four cards two over two, and what each needs', () => {
  const title = 'SMEs choose Acme because it solves three problems their bank leaves open'
  const card = (extra: object = {}) => ({ title: 'A limit that grows', bullets: ['Banks cap cards at £25k', 'Acme raises it with revenue'], ...extra })
  const s = (cards: object[], extra: Partial<Slide> = {}): Slide => ({ template: 'cards', title, cards, ...extra } as Slide)
  expect(validate(s([card(), card(), card()], { lead: 'number' }), 'consulting').errors).toEqual([])
  expect(validate(s([card(), card()], { lead: 'none' }), 'consulting').errors).toEqual([])
  expect(validate(s([card(), card(), card(), card()], { lead: 'number', arrange: 'grid' }), 'consulting').errors).toEqual([])
  expect(validate(s([card({ icon: 'zap' }), card()], { lead: 'number' }), 'consulting').errors[0]).toMatch(/lead "number" has no icon, value or logo/)
  expect(validate(s([card(), card()]), 'consulting').errors[0]).toMatch(/exactly one of "icon", "value" or "logo" \(or set lead to "number" or "none"\)/)
  expect(validate(s([card(), card(), card()], { lead: 'number', arrange: 'grid' }), 'consulting').errors[0]).toMatch(/"grid" is for exactly 4 cards/)
  expect(validate(s([card({ bullets: undefined }), card()], { lead: 'none' }), 'consulting').errors[0]).toMatch(/plain cards need "bullets" or "text"/)
  // A grid card has the room of a card in a row of three: 52-character bullets pass there, not in a row of four.
  const wide = card({ bullets: ['x'.repeat(52), 'y'.repeat(52)] })
  expect(validate(s([wide, wide, wide, wide], { lead: 'number', arrange: 'grid' }), 'consulting').errors).toEqual([])
  expect(validate(s([wide, wide, wide, wide], { lead: 'number' }), 'consulting').errors.join(' ')).toMatch(/at most 48 here/)
})

const tbl = (vals: string[], bars = true): Table => ({ columns: [{ label: 'Provider' }, { label: 'Book', bars }], rows: vals.map((v, i) => ({ cells: [`P${i}`, v] })) })
const tableSlide = (t: Table): Slide => ({ template: 'table', title: 'Acme has the largest book of the four SME lenders by 2030', table: t })

test('a figure is read for its bar: currency, units, separators; brackets and minus are negative', () => {
  expect(figureOf('£1,240k')).toBe(1240)
  expect(figureOf('31%')).toBe(31)
  expect(figureOf('(12)')).toBe(-12)
  expect(figureOf('−3.5')).toBe(-3.5)
  expect(figureOf('—')).toBeNull()
})

test('bars are drawn to scale with the column\'s largest, from one edge, with the figures in one width', () => {
  const html = slideHTML(tableSlide(tbl(['£1,240k', '£620k', '£2,480k'])), contexts(deck([]))[0] ?? { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect([...html.matchAll(/<i style="width:([\d.]+)%"><\/i>/g)].map((m) => Number(m[1]))).toEqual([50, 25, 100])
  expect(html).toContain('style="--vc:7"')
})

test('bars only on a column of figures of 0 or more', () => {
  expect(validate(tableSlide(tbl(['£1,240k', '£620k'])), 'consulting').errors).toEqual([])
  expect(validate(tableSlide(tbl(['High', 'Low'])), 'consulting').errors.join(' ')).toMatch(/bars need a column of figures; this one reads as words/)
  expect(validate(tableSlide(tbl(['£1,240k', '(£20k)'])), 'consulting').errors.join(' ')).toMatch(/negative figure/)
  const t = tbl(['£1k', '£2k']); t.columns[0].bars = true
  expect(validate(tableSlide(t), 'consulting').errors.join(' ')).toMatch(/label column has no bars/)
})

test('a team slide with a missing person still renders (model output is not trusted to be whole)', () => {
  const s = { template: 'team', title: 'The team', people: [null, { name: 'Priya Shah', role: 'CEO' }] } as unknown as Slide
  expect(slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })).toContain('Priya Shah')
})
