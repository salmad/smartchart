import { describe, expect, it } from 'vitest'
import { decide, type Done, type Facts } from '../../api/_lib/emails/series'
import { renderEmail } from '../../api/_lib/emails/templates'

const day = (n: number) => new Date(Date.UTC(2026, 10, 7 + n, 9))
const start = new Date('2026-11-07T00:00:00Z')
const fresh: Facts = { connected: false, templates: 0, docs: 0 }
const sent = (slot: number, d: number): Done => ({ slot, at: day(d), sent: true })

describe('engagement email series', () => {
  it('sends the welcome on day 0', () => {
    expect(decide(start, day(0), [], fresh)).toEqual({ kind: 'send', slot: 1, key: '1-connect', skipped: [] })
  })

  it('waits for the next slot, and never sends twice within two days', () => {
    expect(decide(start, day(1), [sent(1, 0)], fresh)).toEqual({ kind: 'wait', skipped: [] })
    expect(decide(start, day(2), [sent(1, 0)], fresh)).toMatchObject({ kind: 'send', key: '2-line' })
    // A late first send pushes the next one back rather than doubling up.
    expect(decide(start, day(3), [sent(1, 2)], fresh)).toEqual({ kind: 'wait', skipped: [] })
  })

  it('skips what the maker has already done, and moves the next email up', () => {
    const connected = { ...fresh, connected: true }
    // Ahead of the series: connected on day 0, so the titles guide comes now instead of the setup email.
    expect(decide(start, day(0), [], connected)).toEqual({ kind: 'send', slot: 2, key: '2-line', skipped: [1] })
    expect(decide(start, day(6), [sent(1, 0), sent(2, 2), sent(3, 4)], connected)).toMatchObject({ key: '4b-so-what' })
    expect(decide(start, day(4), [sent(1, 0), sent(2, 2)], { ...fresh, templates: 3 })).toEqual({ kind: 'send', slot: 4, key: '4-connect-again', skipped: [3] })
    expect(decide(start, day(11), [1, 2, 3, 4, 5].map((s) => sent(s, (s - 1) * 2)), { ...fresh, docs: 1 })).toEqual({ kind: 'send', slot: 7, key: '7-partner', skipped: [6] })
  })

  it('waits for a maker whose start day is still ahead', () => {
    expect(decide(new Date('2026-11-09T00:00:00Z'), day(0), [], fresh)).toEqual({ kind: 'wait', skipped: [] })
  })

  it('catches up one email at a time after a missed run', () => {
    expect(decide(start, day(5), [], fresh)).toMatchObject({ kind: 'send', slot: 1 })
  })

  it('is done after the last slot', () => {
    expect(decide(start, day(20), [1, 2, 3, 4, 5, 6, 7].map((s) => sent(s, s * 2)), fresh)).toEqual({ kind: 'done' })
  })
})

describe('engagement email templates', () => {
  const vars = { first: 'Ada', existing: false, deck: null, unsubscribeUrl: 'https://www.occamslides.com/api/unsubscribe?t=x' }

  it('sends every site link through its /em/ entry path, for analytics', () => {
    const { html } = renderEmail('1-connect', vars)
    const links = [...html.matchAll(/href="(https:\/\/www\.occamslides\.com[^"]*)"/g)].map((m) => m[1]).filter((l) => !l.includes('/api/'))
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) expect(l).toMatch(/^https:\/\/www\.occamslides\.com\/em\/1-connect\//)
  })

  it('greets returning makers differently on day 0 and carries unsubscribe', () => {
    expect(renderEmail('1-connect', { ...vars, existing: true }).text).toContain('You can now use Occam from Claude')
    expect(renderEmail('7-partner', vars).html).toContain('api/unsubscribe?t=x')
  })
})
