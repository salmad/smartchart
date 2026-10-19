/* The editor draws the page as the read view does: every doc starter, in both themes, the same pixels from the title to
   the last block (the contents and fold buttons are the read view's own chrome, outside this region). */
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DOC_STARTERS } from '@/engine/starters'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const shot = async (page: Page, id: string, text: string, editing: boolean) => {
  await page.addInitScript(([i, t]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.docs.v1', JSON.stringify({ [i]: { id: i, name: 'Doc', text: t, updated: 1, workspaceId: 'ws_local' } })); sessionStorage.setItem('seeded', '1') } }, [id, text])
  await page.goto(`/doc/${id}`)
  await expect(page.locator('.doc-title')).toBeVisible()
  if (editing) { await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.doc-editing .ProseMirror')).toBeVisible(); await page.locator('.doc-editing .ProseMirror').blur() }
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)
  const box = await page.evaluate((ed) => {
    const top = (document.querySelector('.doc-head') ?? document.querySelector('.doc-editing .doc-title'))?.getBoundingClientRect(), body = document.querySelector('.doc-body')?.getBoundingClientRect()
    if (!top || !body) return null
    void ed
    return { x: body.left, y: top.top + window.scrollY, width: body.width, height: body.bottom + window.scrollY - (top.top + window.scrollY) }
  }, editing)
  if (!box) throw new Error('no page')
  return page.screenshot({ clip: box, fullPage: true, animations: 'disabled', caret: 'hide' })
}

for (const s of DOC_STARTERS) for (const theme of ['paper', 'ink']) test(`${s.id}, ${theme}: the editor's page is the read view's page`, async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const text = s.markdown.join('\n').replace(/^---\n/, `---\ntheme: ${theme}\n`)
  const read = await shot(page, 'doc_look', text, false)
  // The read page is the baseline: the editor's must match it to the pixel (a one-level colour rounding in a heading's
  // text is not a difference anyone could see, so the colour threshold is loose and the count of differing pixels is not).
  const name = `${s.id}-${theme}.png`, baseline = testInfo.snapshotPath(name)
  mkdirSync(dirname(baseline), { recursive: true }); writeFileSync(baseline, read)
  const edit = await shot(await page.context().newPage(), 'doc_look', text, true)
  expect(edit).toMatchSnapshot(name, { threshold: 0.1, maxDiffPixels: 0 })
})
