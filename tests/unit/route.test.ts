import { test, expect } from 'vitest'
import { parseRoute } from '@/app/route'

test('/ is home, /new a new deck, /d/:id a saved deck', () => {
  expect(parseRoute('/')).toEqual({ name: 'home' })
  expect(parseRoute('/new')).toEqual({ name: 'new' })
  expect(parseRoute('/d/d_abc-12')).toEqual({ name: 'deck', id: 'd_abc-12' })
})

test('/s/:token is a deck shared by link', () => {
  expect(parseRoute('/s/Ab_3-x')).toEqual({ name: 'shared', token: 'Ab_3-x' })
  expect(parseRoute('/s/a/b')).toEqual({ name: 'home' })
})

test('anything else falls back to home', () => {
  for (const p of ['/d/', '/d/a/b', '/d/a.b', '/new/', '/decks', '/src/dev/review.html']) expect(parseRoute(p)).toEqual({ name: 'home' })
})

test('/i/:token is an invite, /doc/:id a doc', () => {
  expect(parseRoute('/i/Ab_3-x')).toEqual({ name: 'invite', token: 'Ab_3-x' })
  expect(parseRoute('/doc/doc_1')).toEqual({ name: 'doc', id: 'doc_1' })
  for (const p of ['/i/', '/i/a/b', '/doc/', '/doc/a.b']) expect(parseRoute(p)).toEqual({ name: 'home' })
})
