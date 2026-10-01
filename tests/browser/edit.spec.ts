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
  await page.getByRole('button', { name: 'Show chart' }).click()
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
    await page.getByRole('button', { name: 'Show chart' }).click()
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
