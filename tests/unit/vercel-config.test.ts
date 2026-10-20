import { readFileSync } from 'node:fs'
import { test, expect } from 'vitest'

interface Rule { source: string; headers: { key: string; value: string }[] }
const rules = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: Rule[] }).headers ?? []

test('pages are kept by the browser for ten minutes, so a repeat visit has them at once; the API and the hashed files are not touched', () => {
  const page = rules.find((r) => r.headers.some((h) => h.key === 'Cache-Control'))
  // max-age, not stale-while-revalidate: Chrome does not serve a page navigation from a stale copy.
  expect(page?.headers[0].value).toBe('public, max-age=600')
  const matches = (path: string) => new RegExp(`^${page?.source.replace(/^\//, '/')}$`).test(path)
  for (const path of ['/', '/new', '/d/abc', '/doc/xyz', '/home', '/favicon.ico']) expect(matches(path), path).toBe(true)
  for (const path of ['/api/decks', '/mcp/v1', '/assets/index-abc.js', '/fonts/geist.woff2', '/starters/img/a.png']) expect(matches(path), path).toBe(false)
})
