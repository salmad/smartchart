/* The Settings menu: right-click an object (a table column, a cell, a line, a bar) and its settings are listed, read from
   the schema; a pick is a patch like any other edit and is saved with the doc. Score is one submenu. A doc here: a deck shares
   the same menu and renderer. */
import { test, expect, type Page } from '@playwright/test'

const TABLE = JSON.stringify({ caption: 'Issuers', table: { columns: [{ label: 'Issuer' }, { label: 'Limit' }, { label: 'Approval' }], rows: [
  { cells: ['Revolut', '£50k', 'Minutes'] }, { cells: ['Tide', '£10k', 'Same day'] }, { cells: ['Finbridge', '£100k', 'Same day'], focus: true }] }, source: 'Test data' }, null, 2)
const LINES = JSON.stringify({ caption: 'Revenue · £m', chart: { categories: ['2021', '2022', '2023', '2024'], format: '£{v}m', series: [
  { name: 'Us', mark: 'line', color: 'focus', values: [10, 20, 40, 80] }, { name: 'Them', mark: 'line', color: 'neutral', values: [10, 15, 20, 25] }] }, source: 'Test data' }, null, 2)
const BARS = JSON.stringify({ caption: 'Cards issued', chart: { categories: ['2021', '2022', '2023', '2024'], format: '{v}k', series: [
  { name: 'Us', mark: 'bar', color: 'neutral', values: [10, 20, 40, 80] }, { name: 'Them', mark: 'bar', color: 'neutral', values: [10, 15, 20, 25] }] }, source: 'Test data' }, null, 2)
const block = (kind: string, id: string, body: string) => ['```occam:' + kind + ` {#${id}}`, body, '```', ''].join('\n')
const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', block('table', 'tbl', TABLE), block('chart', 'ln', LINES), block('chart', 'br', BARS)].join('\n')
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test.use({ viewport: { width: 1440, height: 900 } })

async function seed(page: Page) {
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, DOC)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>).doc_t.text)
/** Opens the nth figure of a kind in place. */
async function openFigure(page: Page, kind: 'table' | 'chart', nth = 0) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator(`.doc-editing figure[data-kind="${kind}"]`).nth(nth).click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
}
const finish = async (page: Page) => {
  await page.locator('[data-figure-edit]').getByRole('button', { name: 'Done' }).click()
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
}
/** Right-click on the stroke of a line: the box around a line is mostly empty. */
async function rightClickLine(page: Page, selector: string) {
  const at = await page.locator(selector).first().evaluate((p: SVGPathElement) => {
    const pt = p.getPointAtLength(p.getTotalLength() * 0.6), m = p.getScreenCTM() as DOMMatrix
    return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f }
  })
  await page.mouse.click(at.x, at.y, { button: 'right' })
}
const settings = (page: Page) => page.getByRole('menuitem', { name: 'Settings' })
/** Opens a submenu from the keyboard: a menu that opens under the pointer gives hover nothing to move, and Radix opens on movement. */
async function openSub(page: Page, entry: ReturnType<Page['getByRole']>) {
  await entry.focus()
  await page.keyboard.press('ArrowRight')
}
/** Chooses a menu item from the keyboard, for the same reason. */
async function pick(page: Page, item: ReturnType<Page['getByRole']>) {
  await item.focus()
  await page.keyboard.press('Enter')
}

test('a table column is aligned by hand from its Settings, and stays aligned after a reload', async ({ page }) => {
  await seed(page)
  await openFigure(page, 'table')
  await page.locator('[data-figure-edit] th').filter({ hasText: 'Limit' }).click({ button: 'right' })
  await openSub(page, settings(page))
  await openSub(page, page.getByRole('menuitem', { name: /Alignment/ }))
  await pick(page, page.getByRole('menuitemradio', { name: 'Right' }))
  await finish(page)
  expect(await saved(page)).toContain('"align": "right"')
  await page.reload()
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
  await expect(page.locator('.doc figure[data-kind="table"] th.pl-right')).toHaveCount(1)
  await expect(page.locator('.doc figure[data-kind="table"] td.pl-right')).toHaveCount(3)
})

test('Score is one submenu, not seven rows', async ({ page }) => {
  await seed(page)
  await openFigure(page, 'table')
  await page.locator('[data-figure-edit] td').filter({ hasText: '£50k' }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Score' })).toBeVisible()
  await expect(page.getByRole('menuitemcheckbox', { name: /Harvey ball/ })).toHaveCount(0)
  await openSub(page, page.getByRole('menuitem', { name: 'Score' }))
  await expect(page.getByRole('menuitemcheckbox', { name: 'Tick' })).toBeVisible()
  await expect(page.getByRole('menuitemcheckbox', { name: /Harvey ball/ })).toHaveCount(5)
})

test('a line’s emphasis is chosen by word from its Settings, and the choice is what the doc saves', async ({ page }) => {
  await seed(page)
  await openFigure(page, 'chart', 0)
  await rightClickLine(page, '[data-figure-edit] path.ln:not(.c-focus)')
  await openSub(page, settings(page))
  await openSub(page, page.getByRole('menuitem', { name: /Emphasis/ }))
  await pick(page, page.getByRole('menuitemradio', { name: 'Contrast' }))
  await finish(page)
  expect(await saved(page)).toContain('"color": "contrast"')
  // Opened again, the entry shows the word that was chosen.
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.doc-editing figure[data-kind="chart"]').first().click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  await rightClickLine(page, '[data-figure-edit] path.ln:not(.c-focus)')
  await openSub(page, settings(page))
  await expect(page.getByRole('menuitem', { name: /Emphasis.*Contrast/ })).toBeVisible()
})

test('a bar is highlighted from its right-click menu, and only one bar is the focus', async ({ page }) => {
  await seed(page)
  await openFigure(page, 'chart', 1)
  const bar = (i: number) => page.locator(`[data-figure-edit] path.bar[data-series="0"][data-i="${i}"]`)
  await bar(2).click({ button: 'right' })
  await openSub(page, settings(page))
  await pick(page, page.getByRole('menuitemcheckbox', { name: 'Highlight this bar' }))
  await expect(page.locator('[data-figure-edit] path.bar.c-focus')).toHaveCount(1)
  // Another bar takes it over; choosing the same one again clears it.
  await bar(0).click({ button: 'right' })
  await openSub(page, settings(page))
  await pick(page, page.getByRole('menuitemcheckbox', { name: 'Highlight this bar' }))
  await expect(page.locator('[data-figure-edit] path.bar.c-focus')).toHaveCount(1)
  await bar(0).click({ button: 'right' })
  await openSub(page, settings(page))
  await expect(page.getByRole('menuitemcheckbox', { name: 'Highlight this bar' })).toBeChecked()
  await pick(page, page.getByRole('menuitemcheckbox', { name: 'Highlight this bar' }))
  await expect(page.locator('[data-figure-edit] path.bar.c-focus')).toHaveCount(0)
  await bar(3).click({ button: 'right' })
  await openSub(page, settings(page))
  await pick(page, page.getByRole('menuitemcheckbox', { name: 'Highlight this bar' }))
  await finish(page)
  expect(await saved(page)).toMatch(/"highlight": \{\s*"series": 0,\s*"index": 3\s*\}/)
})

test('a line’s Settings stay short: a handful of entries, not a form', async ({ page }) => {
  await seed(page)
  await openFigure(page, 'chart', 0)
  await rightClickLine(page, '[data-figure-edit] path.ln.c-focus')
  await openSub(page, settings(page))
  const entries = page.locator('[role="menu"][data-state="open"]').last().locator('[role^="menuitem"]')
  const n = await entries.count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(6)
})
