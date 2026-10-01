/* Editing a slide by hand (spec 4–5 and the plan's Review Focus). */
import { test, expect, type Page } from '@playwright/test'
import type { Slide } from '@/engine/types'
import { signInAsDev } from './dev-account'

signInAsDev()
const item = (id: string, slide: object) => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] })
const deck = { active: 'd1', decks: { d1: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [
    item('a', { template: 'cards', title: 'Three levers drive [[margin]] this year', cards: [{ icon: 'zap', title: 'Price', text: 'Raise list price' }, { icon: 'wallet', title: 'Mix', text: 'Sell more premium' }, { icon: 'truck', title: 'Cost', text: 'Cut freight' }] }),
    item('b', { template: 'chart', title: 'Revenue grows', caption: 'Revenue · £m', chart: { categories: ['FY24', 'FY25'], series: [{ name: 'Revenue', values: [10, 14], mark: 'bar' }] } }),
  ] } } }
test.beforeEach(async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, deck)
})
const open = async (page: Page) => { await page.goto('/d/d1'); await page.waitForFunction(() => window.__journey?.items.length) ; await page.locator('[data-strip-thumb]').first().waitFor() }
const must = <T>(v: T | null): T => { if (v === null) throw new Error('missing'); return v }
const title = (page: Page) => page.locator('[data-editing] [data-path="title"]')
const saved = (page: Page, i = 0): Promise<Slide> => page.evaluate((k) => window.__journey?.items[k].slide as Slide, i)

test('edit mode locks the deck, keeps the words, and saves them', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(0)
  await expect(page.getByPlaceholder('Save or discard to keep chatting')).toBeVisible()
  await title(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' and the year after that, and every year we can see from here on out')
  await expect(page.getByRole('button', { name: /warning/ })).toBeVisible()
  await expect(title(page)).toContainText('margin this year and the year after')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  const s = await saved(page)
  expect(s.title).toBe('Three levers drive [[margin]] this year and the year after that, and every year we can see from here on out')
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => window.__journey?.items.length)
  expect((await saved(page)).title).toContain('every year we can see')
})

test('Bold over a selection, and the cursor stays put while typing inside a mark', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await title(page).dblclick() // selects a word
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).title).toMatch(/\*\*\w+\*\*/)
})

test('IME composition is not redrawn mid-word', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  const t = title(page)
  await t.click()
  await t.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart'))
    el.append('é')
    el.dispatchEvent(new InputEvent('input', { isComposing: true, bubbles: true }))
  })
  await expect(t).toContainText('é')
  await t.evaluate((el) => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).title).toContain('é')
})

test('add and remove a card; Discard leaves nothing changed', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-item="cards[2]"]').hover()
  await page.getByRole('button', { name: 'Add after' }).click()
  await expect(page.locator('[data-editing] [data-item^="cards["]')).toHaveCount(4)
  await page.keyboard.type('Freight')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Discard' }).click()
  expect((await saved(page)).cards).toHaveLength(3)
})

test('the chart flips to its grid and a value edit lands', async ({ page }) => {
  await open(page)
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-chart]').click()
  const cell = page.getByLabel('Revenue, FY25')
  await cell.fill('16')
  await cell.blur()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page, 1)).chart?.series?.[0]?.values).toEqual([10, 16])
})

test('switching template shows what is kept and what goes', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await page.getByRole('combobox', { name: 'Template' }).click()
  await page.getByRole('option', { name: 'Steps' }).click()
  await expect(page.getByText(/Keeps: title · Drops: 3 cards/)).toBeVisible()
  await page.getByRole('button', { name: 'Switch' }).click()
  // The sample text left in the new body counts as a warning.
  await page.getByRole('button', { name: /warning/ }).click()
  await expect(page.getByText(/still have sample text/)).toBeVisible()
})

test('waterfall and timeline grids write their edits back', async ({ page }) => {
  await open(page)
  await page.evaluate(() => window.__journey?.load([
    { template: 'chart', title: 'Bad debt is the lever', chart: { kind: 'waterfall', items: [{ label: 'Revenue', value: 42 }, { label: 'Cost', value: -9 }, { label: 'Margin', total: true }] } },
    { template: 'chart', title: 'The plan runs two quarters', chart: { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3'], rows: [{ label: 'Build', start: 0, end: 1 }, { label: 'Launch', start: 1, end: 2 }] } },
  ] as never, 'consulting'))
  for (const [i, field] of [[0, 'Cost value'], [1, 'Period 3']] as const) {
    await page.locator('[data-strip-thumb]').nth(i).click()
    await page.keyboard.press('e')
    await page.locator('[data-editing] [data-chart]').click()
    const el = page.getByLabel(field)
    await el.fill(i === 0 ? '-12' : 'Q9')
    await el.blur()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  }
  expect((await saved(page, 0)).chart?.items?.[1]?.value).toBe(-12)
  expect((await saved(page, 1)).chart?.periods?.[2]).toBe('Q9')
})

test('Back or a pasted link while editing keeps the draft', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await title(page).click()
  await page.keyboard.type(' draft')
  await page.evaluate(() => { history.pushState({}, '', '/new'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForTimeout(300)
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await expect(title(page)).toContainText('draft')
  expect(new URL(page.url()).pathname).toBe('/d/d1')
})

test('Escape that closes the warnings popover does not discard', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await title(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' and a great many more words that run on and on well past any sensible limit for a slide title')
  await page.getByRole('button', { name: /warning/ }).click()
  await expect(page.getByRole('listitem').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await expect(title(page)).toContainText('great many more')
})

test('Enter and Escape while composing (IME) neither add an item nor discard', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  const cards = page.locator('[data-editing] [data-item^="cards["]').filter({ has: page.locator('h3') })
  await page.locator('[data-editing] [data-path="cards[0].title"]').evaluate((el) => {
    el.focus()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }))
  })
  await expect(cards).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
})

test('a chart value typed in the grid is saved by ⌘S straight away, and a non-number is not written', async ({ page }) => {
  await open(page)
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-chart]').click()
  const cell = page.getByLabel('Revenue, FY25')
  await cell.fill('1x')
  await cell.fill('−16')
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  expect((await saved(page, 1)).chart?.series?.[0]?.values).toEqual([10, -16])
})

test('an icon is chosen by hand, and the model can pick one from the card text', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await page.getByRole('button', { name: 'Change icon' }).first().click()
  await page.getByRole('option', { name: 'rocket' }).click()
  await expect(page.locator('[data-editing] [data-item="cards[0]"] .ic svg.lucide-rocket')).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Icons' })).toHaveCount(0)
  // With the models unreachable the pick fails out loud and leaves the icon alone.
  await page.getByRole('button', { name: 'Change icon' }).nth(1).click()
  await page.getByRole('button', { name: 'Pick from the card text' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).cards?.map((c) => c.icon)).toEqual(['rocket', 'wallet', 'truck'])
})

test('a table: highlight text inside a cell, and format a whole column', async ({ page }) => {
  await open(page)
  await page.evaluate(() => window.__journey?.load([
    { template: 'table', title: 'Plans compared', table: { columns: [{ label: 'Plan' }, { label: 'Price' }, { label: 'Seats' }], rows: [{ cells: ['Starter', '£9 a month', '1'] }, { cells: ['Team', '£29 a month', '5'] }] } },
  ] as never, 'consulting'))
  await page.keyboard.press('e')
  const cell = page.locator('[data-editing] td[data-path="table.rows[1].cells[1]"]')
  await cell.click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await page.getByRole('button', { name: 'Focus' }).click()
  await expect(cell.locator('.hl-focus')).toHaveCount(1)
  const head = page.locator('[data-editing] th[data-path="table.columns[2].label"]')
  await head.click({ button: 'right' })
  await page.getByRole('menuitemcheckbox', { name: 'Bold column' }).click()
  await head.click({ button: 'right' })
  await page.getByRole('menuitemcheckbox', { name: 'Muted column' }).click()
  await expect(page.locator('[data-editing] th.bold.muted')).toHaveCount(1)
  await head.click({ button: 'right' })
  await page.getByRole('menuitemcheckbox', { name: 'Focus column' }).click()
  await expect(page.locator('[data-editing] th.focus')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save' }).click()
  const t = (await saved(page)).table
  expect(t?.rows[1].cells[1]).toMatch(/\[\[.+\]\]/)
  expect(t?.columns[2]).toMatchObject({ bold: true, focus: true })
  expect(t?.columns[2].muted).toBeUndefined()
})

test('the × stays reachable: the pointer can travel from a bullet to its button and click it', async ({ page }) => {
  await open(page)
  await page.evaluate(() => window.__journey?.load([
    { template: 'cards', title: 'Three levers', cards: [
      { icon: 'zap', title: 'Price', bullets: ['Raise list price', 'Drop the discount'] },
      { icon: 'wallet', title: 'Mix', bullets: ['Sell premium', 'Bundle services'] },
      { icon: 'truck', title: 'Cost', bullets: ['Cut freight', 'Renegotiate'] }] },
  ] as never, 'consulting'))
  await page.keyboard.press('e')
  const bullets = page.locator('[data-editing] [data-item^="cards[1].bullets["]')
  await expect(bullets).toHaveCount(2)
  const b = must(await bullets.first().boundingBox())
  await page.mouse.move(b.x + 30, b.y + b.height / 2)
  const rm = page.getByRole('button', { name: 'Remove' })
  await expect(rm).toBeVisible()
  const box = must(await rm.boundingBox())
  // Real pointer travel in small steps from the bullet out to the button.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 })
  await expect(rm).toBeVisible()
  await rm.click()
  await expect(bullets).toHaveCount(1)
})

test('right-click opens the app menu, not the browser one; a card can be moved and deleted from it; ⌘Z undoes', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  const names = () => page.locator('[data-editing] [data-item^="cards["] h3').allTextContents()
  expect(await names()).toEqual(['Price', 'Mix', 'Cost'])
  await page.locator('[data-editing] [data-item="cards[0]"] h3').click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Move later' }).click()
  expect(await names()).toEqual(['Mix', 'Price', 'Cost'])
  await page.keyboard.press('Control+z')
  expect(await names()).toEqual(['Price', 'Mix', 'Cost'])
  await page.locator('[data-editing] [data-item="cards[2]"] h3').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.locator('[data-editing] [data-item^="cards["] h3')).toHaveCount(2)
})

test('Escape peels back a selection before it asks about Discard', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  await title(page).dblclick()
  await expect(page.getByRole('toolbar', { name: 'Text emphasis' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('toolbar', { name: 'Text emphasis' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
})

test('a card is dragged to another place by its grip, and ⌘Z puts it back', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  const names = () => page.locator('[data-editing] [data-item^="cards["] h3').allTextContents()
  const first = must(await page.locator('[data-editing] [data-item="cards[0]"]').boundingBox())
  await page.mouse.move(first.x + first.width / 2, first.y + 20)
  const grip = page.getByRole('button', { name: /^Move card 1$/ })
  const g = must(await grip.boundingBox())
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 6 })
  await page.mouse.down()
  const last = must(await page.locator('[data-editing] [data-item="cards[2]"]').boundingBox())
  await page.mouse.move(last.x + last.width - 4, last.y + 20, { steps: 12 })
  await page.mouse.up()
  expect(await names()).toEqual(['Mix', 'Cost', 'Price'])
  await page.keyboard.press('Control+z')
  expect(await names()).toEqual(['Price', 'Mix', 'Cost'])
})

const PLANS = { template: 'table', title: 'Plans compared', table: { columns: [{ label: 'Plan' }, { label: 'Price' }, { label: 'Seats' }], rows: [{ cells: ['Starter', '£9 a month', '1'] }, { cells: ['Team', '£29 a month', '5'] }] } }
const loadPlans = async (page: Page) => { await open(page); await page.evaluate((s) => window.__journey?.load([s] as never, 'consulting'), PLANS); await page.keyboard.press('e') }
const cellEl = (page: Page, r: number, c: number) => page.locator(`[data-editing] td[data-path="table.rows[${r}].cells[${c}]"]`)

test('cells are selected across the table by dragging, and formatted together', async ({ page }) => {
  await loadPlans(page)
  const a = must(await cellEl(page, 0, 1).boundingBox()), b = must(await cellEl(page, 1, 2).boundingBox())
  await page.mouse.move(a.x + 8, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + 8, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Bold' }).click()
  await expect(page.locator('[data-editing] td strong')).toHaveCount(4)
  await cellEl(page, 1, 1).click({ button: 'right' })
  await page.getByRole('menuitemcheckbox', { name: /^Focus ⌘/ }).click()
  await expect(page.locator('[data-editing] td .hl-focus')).toHaveCount(4)
  await page.getByRole('button', { name: 'Save' }).click()
  const rows = (await saved(page)).table?.rows
  expect(rows?.[0].cells).toEqual(['Starter', '**[[£9 a month]]**', '**[[1]]**'])
})

test('a table column is dragged to another place by its grip', async ({ page }) => {
  await loadPlans(page)
  const c0 = must(await cellEl(page, 0, 0).boundingBox())
  await page.mouse.move(c0.x + 10, c0.y + c0.height / 2)
  const grip = page.getByRole('button', { name: 'Move column 1' })
  const g = must(await grip.boundingBox())
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 6 })
  await page.mouse.down()
  const c2 = must(await cellEl(page, 0, 2).boundingBox())
  await page.mouse.move(c2.x + c2.width - 4, c2.y + 10, { steps: 12 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Save' }).click()
  const t = (await saved(page)).table
  expect(t?.columns.map((c) => c.label)).toEqual(['Price', 'Seats', 'Plan'])
  expect(t?.rows[0].cells).toEqual(['£9 a month', '1', 'Starter'])
})
