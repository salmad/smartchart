import { describe, expect, it } from 'vitest'
import { EMOJI, isLetterMark, markOf, PICKER_EMOJI, suggestEmoji } from '../../src/engine/roadmaps/emoji'
import type { JevFn } from '../../src/engine/agent/llm'

/** A stand-in for Jev: answers each question by its kind (k place, f flag, m marker) and option, and records the questions. */
const fakeJev = (picks: Record<string, [string, number]>): { jev: JevFn; asked: Record<string, { options: Record<string, string> }> } => {
  const asked: Record<string, { options: Record<string, string> }> = {}
  const jev: JevFn = async (_state, questions) => {
    Object.assign(asked, questions)
    const out = Object.fromEntries(Object.keys(questions).map((id) => {
      const [choice, p] = picks[id] ?? ['none', 0.9]
      return [id, { choice, p, probabilities: {} }]
    }))
    return Object.assign(out, { _ms: 1 })
  }
  return { jev, asked }
}

describe('option marks', () => {
  it('keeps one emoji, or one or two letters or digits in capitals; nothing else', () => {
    expect(markOf(' 🇬🇧 ')).toBe('🇬🇧')
    expect(markOf('🚀')).toBe('🚀')
    expect(markOf('uk')).toBe('UK')
    expect(markOf('P1')).toBe('P1')
    expect(markOf('é')).toBe('É')
    expect(markOf('USA')).toBeNull()
    expect(markOf('🚀🚀')).toBeNull()
    expect(markOf('a!')).toBeNull()
    expect(markOf('')).toBeNull()
    expect([isLetterMark('UK'), isLetterMark('🇬🇧')]).toEqual([true, false])
  })
})

describe('emoji suggestions', () => {
  it('the catalogue makes real flags with names, keeps every question under 255 choices, and the picker shows only catalogue emoji', () => {
    expect(EMOJI.find((e) => e.id === 'cGB')).toMatchObject({ emoji: '🇬🇧', name: 'flag of United Kingdom (GB)' })
    expect(PICKER_EMOJI.every((e) => e !== '')).toBe(true)
    expect(new Set(EMOJI.map((e) => e.id)).size).toBe(EMOJI.length)
    expect(EMOJI.filter((e) => e.kind === 'flag').length + 1).toBeLessThanOrEqual(255)
    expect(EMOJI.filter((e) => e.kind === 'marker').length + 1).toBeLessThanOrEqual(255)
  })

  it('a place takes its flag, anything else its marker, in one call', async () => {
    const { jev, asked } = fakeJev({ k0: ['place', 0.9], f0: ['cGB', 0.9], k1: ['other', 0.9], m1: ['shield', 0.8] })
    const got = await suggestEmoji(jev, 'Workstream', [{ id: 'uk', name: 'UK' }, { id: 'risk', name: 'Risk' }])
    expect(got).toEqual({ uk: '🇬🇧', risk: '🛡️' })
    expect(Object.keys(asked)).toEqual(['k0', 'f0', 'm0', 'k1', 'f1', 'm1'])
  })

  it('leaves an option alone when nothing fits or the answer is weak', async () => {
    const { jev } = fakeJev({ k0: ['other', 0.9], m0: ['none', 0.9], k1: ['other', 0.9], m1: ['rocket', 0.3] })
    expect(await suggestEmoji(jev, 'Stage', [{ id: 'a', name: 'Misc' }, { id: 'b', name: 'Other' }])).toEqual({})
  })
})
