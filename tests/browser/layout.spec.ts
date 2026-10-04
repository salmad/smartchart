/* The editor gives the slide the room: the decks start hidden on a laptop, step aside for Look there, and E does not
   move the slide. On a phone, Present and the avatar sit at the right edge. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()

const COVER = { template: 'cover', title: 'Acme', subtitle: 'Cards for small businesses.' }
async function open(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  const health = page.waitForResponse('**/api/health')
  await page.goto('/new')
  await page.waitForFunction(() => window.__journey)
  await health
  await page.evaluate((s) => window.__journey?.load(s as never, 'consulting'), [COVER, { ...COVER, title: 'Second' }])
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
}
const decks = (page: Page) => page.getByRole('navigation', { name: 'Your decks' })

test('on a laptop the decks start hidden, and Look sends them aside until their button closes it', async ({ page }) => {
  await open(page, 1440)
  await expect(decks(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Show your decks' }).click()
  await expect(decks(page)).toBeVisible()
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await expect(page.getByRole('complementary', { name: 'Deck look' })).toBeVisible()
  await expect(decks(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Show your decks' }).click()
  await expect(page.getByRole('complementary', { name: 'Deck look' })).toHaveCount(0)
  await expect(decks(page)).toBeVisible()
})

test('a wide window opens with the decks, and keeps them beside Look', async ({ page }) => {
  await open(page, 1600)
  await expect(decks(page)).toBeVisible()
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await expect(decks(page)).toBeVisible()
})

test('E edits the slide where it stands', async ({ page }) => {
  await open(page, 1440)
  const top = () => page.locator('main .aspect-video').first().evaluate((e) => e.getBoundingClientRect().top)
  const before = await top()
  await page.keyboard.press('e')
  await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()
  expect(await top()).toBe(before)
})

test('on a phone, Present and the avatar sit at the right edge', async ({ page }) => {
  await open(page, 390, 844)
  const right = await page.getByRole('button', { name: 'Present' }).evaluate((e) => e.parentElement!.getBoundingClientRect().right)
  expect(right).toBeGreaterThan(390 - 20)
})
