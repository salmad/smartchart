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
  await page.goto(path)
  await page.waitForFunction(() => window.__journey)
}

test('the app loads', async ({ page }) => {
  await boot(page)
  await expect(page.getByText('Occam', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Look' }).click()
  await expect(page.getByRole('group', { name: 'Deck style' })).toBeVisible()
})

test('a loaded cover shows one strip thumb', async ({ page }) => {
  await boot(page)
  await load(page, [COVER])
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
})

test('F opens the presentation and Escape closes it', async ({ page }) => {
  await boot(page)
  await load(page, [COVER, { ...COVER, title: 'Second' }])
  await page.keyboard.press('f')
  await expect(page).toHaveURL(/#\/1$/)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#\/2$/)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/#\//)
  await expect(page.locator('[data-strip-thumb][aria-current="true"]')).toHaveCount(1)
  expect(await page.evaluate(() => window.__journey?.current)).toBe(1)
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

test('a deck saved by the prototype opens with its slide and chat (Review Focus 1)', async ({ page }) => {
  const proto = { active: 'd_1', decks: { d_1: { id: 'd_1', style: 'pitch', theme: 'paper', accent: '#2447D1', current: 0, items: [{ id: 's1', slide: { template: 'cover', title: 'Acme', subtitle: 'x' }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: ['s1'], thread: '<div class="msg user"><p>hi from the prototype</p></div>', updated: 1 } } }
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify(proto)] as const)
  await boot(page, '/d/d_1')
  await expect(page.locator('[title="Present (F)"] .slide .title')).toHaveText('Acme')
  await expect(page.getByText('hi from the prototype')).toBeVisible()
  await page.getByRole('button', { name: 'Look' }).click()
  await expect(page.getByRole('button', { name: 'Pitch' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Paper' })).toHaveAttribute('aria-pressed', 'true')
})
