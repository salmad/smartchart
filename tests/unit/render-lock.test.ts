/* Render lock: every starter and stress slide, in both styles, renders byte-identical HTML (hashed, as the review
   page lays them out: one deck per set, so pages, sections and the agenda match). WRITE_HTML=1 relocks after a
   deliberate change; ONLY=<key,key> relocks just those. */
import { test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { contexts, slideHTML } from '@/engine/slides/render'
import { FOOTER, STARTERS } from '@/engine/starters'
import { stressFor } from '../fixtures/stress'
import type { Slide, Style } from '@/engine/types'

const FILE = new URL('../fixtures/slide-html.json', import.meta.url)
const STYLES: Style[] = ['consulting', 'pitch']

function hashes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const style of STYLES) {
    const sets: [string[], Slide[]][] = [
      [STARTERS.map((s) => s.id), STARTERS.map((s) => s[style])],
      [stressFor(style).map((_, i) => `stress-${i + 1}`), stressFor(style).map(({ name: _name, ...s }) => s)],
    ]
    for (const [ids, slides] of sets) {
      const deck = { style, theme: 'ink' as const, accent: null, footer: FOOTER, slides }, ctx = contexts(deck)
      slides.forEach((s, i) => { out[`${ids[i]}/${style}`] = createHash('sha256').update(slideHTML(s, ctx[i], deck)).digest('hex') })
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

test('every starter and stress slide renders the locked HTML', () => {
  const got = hashes(), only = process.env.ONLY?.split(',')
  if (process.env.WRITE_HTML) {
    const prev = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, string>) : {}
    const next = only ? { ...prev, ...Object.fromEntries(only.map((k) => [k, got[k]])) } : got
    writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`)
  }
  const locked = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, string>
  expect(got).toEqual(locked)
})
