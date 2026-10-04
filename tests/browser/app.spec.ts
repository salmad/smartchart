/* App smoke without the models: load, a deck through window.__journey, present, and a prototype deck. */
import { test, expect, type Page } from '@playwright/test'
import type { Slide, Style } from '@/engine/types'
import { signInAsDev } from './dev-account'

signInAsDev()

const KEY = 'smartchart.journey.decks.v1'
const COVER = { template: 'cover', title: 'Acme', subtitle: 'Cards for small businesses.' }
const load = (page: Page, slides: object[], style: Style = 'consulting') =>
  page.evaluate(([s, st]) => window.__journey?.load(s, st), [slides as Slide[], style] as const)

async function boot(page: Page, path = '/new') {
  // Boot ends when the health check answers, and a deck loaded before then is replaced by the fresh one boot starts.
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  const health = page.waitForResponse('**/api/health')
  await page.goto(path)
  await page.waitForFunction(() => window.__journey)
  await health
  await page.waitForTimeout(150)
}

test('the app loads', async ({ page }) => {
  await boot(page)
  await expect(page.getByText('Occam', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await expect(page.getByRole('group', { name: 'Deck style' })).toBeVisible()
})

test('a loaded cover shows one strip thumb', async ({ page }) => {
  await boot(page)
  await load(page, [COVER])
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
})

test('F opens the presentation in its own tab, which follows the deck while it is edited', async ({ page, context }) => {
  await boot(page)
  await load(page, [COVER, { ...COVER, title: 'Second' }])
  const opened = context.waitForEvent('page')
  await page.keyboard.press('f')
  const show = await opened
  await expect(show).toHaveURL(/\/present\?k=\w+#\/1$/)
  await expect(show.locator('.slide .title')).toHaveText('Acme')
  await show.keyboard.press('ArrowRight')
  await expect(show).toHaveURL(/#\/2$/)
  await expect(show.locator('.slide .title')).toHaveText('Second')
  // The editor's tab is still the editor, and an edit made there shows in the presentation at once.
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
  await load(page, [COVER, { ...COVER, title: 'Edited second' }])
  await expect(show.locator('.slide .title')).toHaveText('Edited second')
})

test('chart marks do not inherit the app layout strokes', async ({ page }) => {
  await boot(page)
  await load(page, [{ template: 'chart', title: 'Revenue grew', chart: { categories: ['2023', '2024', '2025'], format: '£{v}m', series: [{ name: 'Revenue', mark: 'bar', values: [2.1, 3.4, 5.4] }] } }])
  const dashes = await page.locator('main .slide .bar').evaluateAll((els) => els.map((e) => getComputedStyle(e).strokeDasharray))
  expect(dashes.length).toBeGreaterThan(0)
  expect(new Set(dashes)).toEqual(new Set(['none']))
})

test('app icons are solid lines: slide styles never reach the chrome', async ({ page }) => {
  await boot(page)
  await load(page, [{ template: 'chart', title: 'Revenue grew', chart: { categories: ['2023', '2024', '2025'], format: '£{v}m', series: [{ name: 'Revenue', mark: 'bar', values: [2.1, 3.4, 5.4] }] } }])
  const dashes = await page.locator('header svg, nav svg').evaluateAll((els) => els.map((e) => getComputedStyle(e).strokeDasharray))
  expect(dashes.length).toBeGreaterThan(0)
  expect(new Set(dashes)).toEqual(new Set(['none']))
})

test('a deck saved by the prototype opens with its slide and look', async ({ page }) => {
  const proto = { active: 'd_1', decks: { d_1: { id: 'd_1', style: 'pitch', theme: 'paper', accent: '#2447D1', current: 0, items: [{ id: 's1', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: ['s1'], updated: 1 } } }
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify(proto)] as const)
  await boot(page, '/d/d_1')
  await expect(page.locator('[title="Present (F)"] .slide .title')).toHaveText('Acme')
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await expect(page.getByRole('button', { name: 'Pitch' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Paper' })).toHaveAttribute('aria-pressed', 'true')
})

test('the deck is renamed in place and keeps its name; Esc keeps the old one', async ({ page }) => {
  await boot(page)
  await load(page, [COVER])
  const bar = page.getByRole('navigation', { name: 'Breadcrumb' })
  await bar.getByTitle('Rename').click()
  await page.keyboard.type('Board pack')
  await page.keyboard.press('Enter')
  await expect(bar).toContainText('Board pack')
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.keyboard.type('Something else')
  await page.keyboard.press('Escape')
  await expect(bar).toContainText('Board pack')
})

test('the views: Grid shows every slide and a double click opens one; the look opens beside the slide', async ({ page }) => {
  await boot(page)
  await load(page, [COVER, { ...COVER, title: 'Second' }])
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Grid' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
  await expect(page.locator('[title="Present (F)"]')).toHaveCount(0)
  await page.locator('[data-strip-thumb]').nth(1).dblclick()
  await expect(page.locator('[title="Present (F)"] .slide .title')).toHaveText('Second')
  await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Slide' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await expect(page.getByRole('complementary', { name: 'Deck look' })).toBeVisible()
  await expect(page.locator('[title="Present (F)"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close look' }).click()
  await expect(page.getByRole('complementary', { name: 'Deck look' })).toHaveCount(0)
})

const CARDS = { template: 'cards', title: 'Three reasons to act now', cards: [{ icon: 'zap', title: 'Faster', text: 'Cut the cycle time.' }, { icon: 'wallet', title: 'Cheaper', text: 'Lower unit costs.' }] }

test('edit mode: E enters, the deck is locked, typing keeps the cursor, Save keeps the words', async ({ page }) => {
  await boot(page)
  await load(page, [COVER, CARDS])
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  const title = page.locator('main [data-editing] [data-path="title"]')
  await expect(title).toHaveAttribute('contenteditable', 'true')
  await expect(page.getByPlaceholder('Save or discard to keep chatting')).toBeDisabled()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(0)
  await title.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' and more')
  await expect(title).toContainText('Three reasons to act now and more')
  await page.keyboard.type('!')
  await expect(title).toContainText('and more!')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
  await page.locator('[data-strip-thumb]').nth(1).click()
  await expect(page.locator('main .slide [data-path="title"]').first()).toContainText('and more!')
})

test('edit mode: Discard asks only when something changed', async ({ page }) => {
  await boot(page)
  await load(page, [COVER, CARDS])
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
})

test('edit mode: + adds a card with the cursor in it, × hides at the minimum, a long title is underlined, Bold toggles', async ({ page }) => {
  await boot(page)
  await load(page, [COVER, CARDS])
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  const cards = page.locator('main [data-editing] [data-item^="cards["]').filter({ has: page.locator('h3') })
  await expect(cards).toHaveCount(2)
  // At the minimum of two cards there is no ×.
  await cards.first().hover()
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add after' }).click()
  await expect(cards).toHaveCount(3)
  await page.keyboard.type('Safer')
  await expect(cards.nth(1).locator('h3')).toContainText('Safer')
  await cards.nth(1).hover()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(cards).toHaveCount(2)
  // A title past its limit is kept and underlined, with its reason.
  const title = page.locator('main [data-editing] [data-path="title"]')
  await title.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' and a great many more words that run on and on well past any sensible limit for a slide title')
  await expect(page.locator('[title*="limit"], [title*="wraps"]').first()).toBeVisible()
  // Select a word: Bold makes it bold; pressing it again removes it.
  await title.dblclick()
  await page.getByRole('button', { name: 'Bold' }).click()
  await expect(title.locator('strong')).toHaveCount(1)
  await page.getByRole('button', { name: 'Bold' }).click()
  await expect(title.locator('strong')).toHaveCount(0)
})
