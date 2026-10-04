/* The tour: from the account menu, eight steps over the real editor, ending at Connect an agent. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = { id: 'tr', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1000, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title: 'Market' }, status: 'ok', errors: [], warnings: [], checks: [] }] }
const startTour = async (page: Page) => {
  await page.getByRole('button', { name: /^Account:/ }).click()
  await page.getByRole('menuitem', { name: 'Take the tour' }).click()
}

test('eight steps with Next and Back, ending at Connect an agent; remembered as seen', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify({ active: 'tr', decks: { tr: deck } })] as const)
  await page.goto('/d/tr')
  await expect.poll(() => page.evaluate(() => window.__journey?.items.length)).toBe(1)
  await startTour(page)
  const card = page.getByRole('dialog', { name: 'Say what the slide should say' })
  await expect(card).toContainText('Step 1 of 8')
  const titles = ['Your slide, always in shape', 'Checked like a partner would', 'Leave notes for any agent', 'The whole deck', 'Look and Versions', 'Share it', 'Connect an agent']
  for (const t of titles) { await page.getByRole('button', { name: 'Next' }).click(); await expect(page.getByRole('heading', { name: t })).toBeVisible() }
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'Share it' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Make a key' }).click()
  await expect(page.getByRole('dialog', { name: 'Connect an agent' })).toContainText('Each key acts as you')
  await page.keyboard.press('Escape')
  await expect(page.getByText('Step 8 of 8')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('smartchart.tour'))).toBe('1')
})

test('on an empty deck the tour first puts in three gallery slides; Esc closes it', async ({ page }) => {
  await page.goto('/new')
  await expect(page.getByRole('button', { name: /^Account:/ })).toBeVisible()
  await startTour(page)
  await expect(page.getByText('Step 1 of 8')).toBeVisible()
  expect(await page.evaluate(() => window.__journey?.items.length)).toBe(3)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Step 1 of 8')).toHaveCount(0)
})
