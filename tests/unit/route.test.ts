import { test, expect } from 'vitest'
import { parseRoute } from '@/app/route'

test('/ is home, /new a new deck, /d/:id a saved deck', () => {
  expect(parseRoute('/')).toEqual({ name: 'home' })
  expect(parseRoute('/new')).toEqual({ name: 'new' })
  expect(parseRoute('/d/d_abc-12')).toEqual({ name: 'deck', id: 'd_abc-12' })
})

test('anything else falls back to home', () => {
  for (const p of ['/d/', '/d/a/b', '/d/a.b', '/new/', '/decks', '/src/dev/review.html']) expect(parseRoute(p)).toEqual({ name: 'home' })
})
