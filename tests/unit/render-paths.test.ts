// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import { parsePath } from '@/engine/agent/patch'
import { plainOf } from '@/engine/slides/markup'
import { STARTERS } from '@/engine/starters'
import type { Slide } from '@/engine/types'

const CTX = { page: 2, section: 1, kicker: '01 · Market', footer: 'Acme' }
const get = (s: Slide, path: string): unknown => (parsePath(path) ?? []).reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], s)

for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
  test(`${st.id} (${style}): every data-path resolves and shows its field's text`, () => {
    const slide = st[style], host = document.createElement('div')
    host.innerHTML = slideHTML(slide, CTX, { style, theme: 'ink' })
    const fields = [...host.querySelectorAll<HTMLElement>('[data-path]')]
    expect(fields.length).toBeGreaterThan(0)
    for (const el of fields) {
      const path = el.dataset.path ?? '', v = get(slide, path)
      expect(parsePath(path), path).not.toBeNull()
      expect(['md', 'display', 'esc', 'cap']).toContain(el.dataset.kind)
      // An empty optional box (the section subtitle) has no value yet.
      if (v === undefined) continue
      expect(el.textContent, path).toBe(plainOf(String(v)))
    }
    for (const el of host.querySelectorAll<HTMLElement>('[data-item]')) expect(get(slide, el.dataset.item ?? ''), el.dataset.item).toBeDefined()
  })
}

test('the source prefix and note numbers stay outside the fields', () => {
  const s: Slide = { template: 'chart', title: 'T', source: 'ONS', chart: { categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2], mark: 'bar' }] }, notes: [{ title: 'One' }, { title: 'Two' }] }
  const host = document.createElement('div')
  host.innerHTML = slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })
  expect(host.querySelector('[data-path="source"]')?.textContent).toBe('ONS')
  expect(host.querySelector('[data-path="notes[0].title"]')?.textContent).toBe('One')
})
