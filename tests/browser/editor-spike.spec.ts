/* THROWAWAY (plan task 2): the Tiptap spike's page against the read view, element by element. */
import { test, expect } from '@playwright/test'
import { DOC_STARTERS } from '@/engine/starters'
test.use({ viewport: { width: 1440, height: 900 } })

const SEL = '.doc-head h1, .doc-head .doc-sub, h2, h3, .sec-body > p, .doc-body > p, li, blockquote, hr, .doc-fig, .doc-raw'
for (const s of DOC_STARTERS) for (const theme of ['paper', 'ink']) test(`${s.id} ${theme}: edit view matches read view`, async ({ page }) => {
  const rects = async (view: string) => {
    await page.goto(`/src/dev/editor-spike.html?doc=${s.id}&view=${view}&theme=${theme}`)
    await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    return page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()} ${Math.round(r.left * 2) / 2} ${Math.round(r.top * 2) / 2} ${Math.round(r.width * 2) / 2} ${Math.round(r.height * 2) / 2}` }), SEL)
  }
  const read = await rects('read'), edit = await rects('edit')
  const diff = read.map((r, i) => (r === edit[i] ? null : `#${i} read ${r} | edit ${edit[i]}`)).filter(Boolean)
  expect(edit.length, diff.slice(0, 8).join('\n')).toBe(read.length)
  expect(diff.slice(0, 12)).toEqual([])
})
