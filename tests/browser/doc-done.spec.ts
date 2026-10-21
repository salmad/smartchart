/* M4's done-when: create a doc, write a section, insert and edit a chart and a table, reload, and the Markdown saved
   is what the page shows. */
import { test, expect, type Page } from '@playwright/test'
import { parseDoc } from '@/engine/docs/parse'
import { plainOf } from '@/engine/slides/markup'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const DECKS = 'smartchart.journey.decks.v1'
const sheetCell = (page: Page, r: number, c: number) => page.locator(`[role=gridcell][data-r="${r}"][data-c="${c}"]`)
const doneInPlace = (page: Page) => page.locator('[data-figure-edit]').getByRole('button', { name: 'Done' }).click()
const savedText = (page: Page) => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>)[0].text)

test('creates a doc, writes a section, inserts and edits a chart and a table, and a reload matches the Markdown', async ({ page }) => {
  await page.addInitScript(([k]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify({ active: 'a', decks: { a: { id: 'a', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }], items: [{ id: 's', slide: { template: 'section', title: 'Alpha' }, status: 'ok', errors: [], warnings: [], checks: [] }] } } })); sessionStorage.setItem('seeded', '1') } }, [DECKS] as const)
  await page.goto('/d/a')
  // The editor loads on its own after the page: wait for its sidebar button before asking which way it points.
  await page.getByRole('button', { name: /^(Show|Hide) the sidebar$/ }).waitFor()
  const show = page.getByRole('button', { name: 'Show the sidebar' })
  if (await show.isVisible()) await show.click()
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'New page' }).click()
  await page.getByRole('menuitem', { name: 'New doc' }).click()
  const dialog = page.getByRole('dialog', { name: 'New doc' })
  await dialog.getByText('Product requirements', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Create doc' }).click()
  await expect(page).toHaveURL(/\/doc\/doc_[\w-]+$/)
  await expect(page.locator('.doc')).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('.doc-editing')).toBeVisible()
  // A new section at the end: a heading from the slash menu, then a paragraph under it.
  const last = page.locator('.doc-editing .sec-body > p').last()
  await last.click()
  // The caret goes to the end of the paragraph (Cmd+→ means that on a Mac only; Ctrl+→ jumps a word elsewhere).
  await last.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r) })
  await page.keyboard.press('Enter')
  await page.keyboard.type('/head')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Rollout notes')
  await page.keyboard.press('Enter')
  await page.keyboard.type('We start with five percent of cards.')
  // A table, then a chart above it: each from the slash menu, each edited in place.
  await page.keyboard.press('Enter')
  await page.keyboard.type('/table')
  await page.keyboard.press('Enter')
  await page.locator('.doc-editing figure[data-kind="table"][data-block=""]').click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  await page.locator('[data-figure-edit] td[data-path]').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Ltd')
  await doneInPlace(page)

  await page.locator('.doc-editing .sec-body > p', { hasText: 'We start with five percent' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/chart')
  await page.keyboard.press('Enter')
  await page.locator('.doc-editing figure[data-kind="chart"][data-block=""]').click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  await page.locator('[data-figure-edit] [data-chart]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Edit chart data…' }).click()
  await sheetCell(page, 0, 1).click()
  await page.keyboard.type('999')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
  await doneInPlace(page)

  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.doc')).toBeVisible()
  await expect(page.locator('.doc figure[data-kind="chart"] svg').first()).toBeAttached()

  // The Markdown saved is what the page shows.
  const doc = parseDoc(await savedText(page)).doc
  const heads = doc.blocks.flatMap((b) => (b.type === 'heading' ? [plainOf(b.text)] : []))
  const paras = doc.blocks.flatMap((b) => (b.type === 'paragraph' ? [plainOf(b.text)] : []))
  expect(heads).toContain('Rollout notes')
  expect(paras).toContain('We start with five percent of cards.')
  // The doc has its own charts and tables already: the new ones are the chart with 999, and the last table.
  const charts = doc.blocks.filter((b) => b.type === 'figure' && b.kind === 'chart'), table = doc.blocks.filter((b) => b.type === 'figure' && b.kind === 'table').at(-1)
  expect(charts.some((c) => JSON.stringify(c).includes('999'))).toBe(true)
  expect(JSON.stringify(table)).toContain('Ltd')
  expect(await page.locator('.doc-body h2 a, .doc-body h3').allInnerTexts()).toEqual(heads)
  expect(await page.locator('.doc-body :is(.doc-body, .sec-body) > p').allInnerTexts()).toEqual(paras)
  await expect(page.locator('.doc figure[data-kind="chart"]').filter({ hasText: '999' })).toHaveCount(1)
  const cells = await page.locator('.doc figure[data-kind="table"]').last().locator('td[data-path]').allInnerTexts()
  expect(cells.length).toBeGreaterThan(0)
  for (const c of cells) expect(JSON.stringify(table)).toContain(JSON.stringify(c).slice(1, -1))
  await expect(page.locator('.doc figure[data-kind="table"]').last().locator('td').first()).toContainText('Ltd')
})
