import { expect, test } from 'vitest'
import { asTalk, parseRehearsal, rehearseMessages } from '@/engine/agent/rehearse'
import { STARTERS, starterSlide } from '@/engine/starters'

const slides = ['cover', 'chart-notes', 'table'].map((id, i) => ({ id: `s${i}`, slide: starterSlide(STARTERS.find((s) => s.id === id) ?? STARTERS[0], 'consulting') }))

test('the room reads the deck as shown, with the maker\'s notes, and never a file name', () => {
  const withTalk = slides.map((x, i) => (i === 1 ? { ...x, slide: { ...x.slide, talk: 'Pause on the crossover.' } } : x))
  const [system, user] = rehearseMessages(withTalk, 'pitch')
  expect(system.content).toMatch(/venture fund/)
  expect(user.content).toContain("The maker's notes for it: Pause on the crossover.")
  expect(user.content).not.toContain('"talk"')
})

test('only questions on content slides that exist, whole, at most two per slide, in deck order', () => {
  const text = 'Sure: {"slides":[{"n":3,"questions":[{"q":"Why revolvers?","answer":"They carry the margin.","gap":false},{"q":"Bad debt?","answer":"The deck does not show it; a loss curve would.","gap":true},{"q":"Third?","answer":"x"}]},{"n":1,"questions":[{"q":"Cover?","answer":"x"}]},{"n":9,"questions":[{"q":"Ghost","answer":"x"}]},{"n":2,"questions":[{"q":"","answer":"x"}]}]}'
  const r = parseRehearsal(text, slides)
  expect(r.map((x) => x.id)).toEqual(['s2'])
  expect(r[0].questions).toEqual([{ q: 'Why revolvers?', answer: 'They carry the margin.', gap: false }, { q: 'Bad debt?', answer: 'The deck does not show it; a loss curve would.', gap: true }])
  expect(parseRehearsal('not json', slides)).toEqual([])
  expect(asTalk(r[0].questions[0])).toBe('If asked "Why revolvers?": They carry the margin.')
})
