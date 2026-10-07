import { describe, expect, it } from 'vitest'
import { markSeen, place, seen, TOUR } from '@/app/tour'

const view = { width: 1400, height: 900 }, card = { width: 340, height: 180 }
describe('tour', () => {
  it('has seven steps and ends at Connect an agent', () => {
    expect(TOUR).toHaveLength(7)
    expect(TOUR.at(-1)?.id).toBe('account')
  })
  it('steps that talk about something say what to show, and where to look', () => {
    expect(TOUR.filter((t) => t.show).map((t) => [t.id, t.show, t.target ?? t.id, t.via ?? null])).toEqual([
      ['chat', 'chat', 'chat', null], ['comments', 'comments', 'comments-panel', 'comments'], ['views', 'grid', 'grid', 'views']])
  })
  it('places the card below, above, beside, or centred, inside the viewport', () => {
    expect(place({ top: 100, left: 600, width: 200, height: 40 }, card, view)).toEqual({ top: 152, left: 530, side: 'below' })
    expect(place({ top: 800, left: 600, width: 200, height: 40 }, card, view)).toEqual({ top: 608, left: 530, side: 'above' })
    expect(place({ top: 10, left: 1350, width: 40, height: 30 }, card, view).left).toBe(1400 - 340 - 16)
    expect(place({ top: 56, left: 0, width: 400, height: 844 }, card, view)).toMatchObject({ left: 412 })
    expect(place(null, card, view)).toEqual({ top: 360, left: 530, side: 'center' })
  })
  it('remembers it was seen; blocked storage counts as seen so the nudge never nags', () => {
    const m: Record<string, string> = {}
    const s = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } }
    expect(seen(s)).toBe(false)
    markSeen(s)
    expect(seen(s)).toBe(true)
    expect(seen({ getItem: () => { throw new Error('blocked') } })).toBe(true)
  })
})
