/* A new deck: the editor with the chat's question, every starter in the strip, the style switch in the composer,
   one deck per pick, and picking with the API down. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem('cleared')) { localStorage.clear(); sessionStorage.setItem('cleared', '1') } }) })
signInAsDev()

test('landing shows every starter and picking one creates a one-slide deck', async ({ page }) => {
  await page.goto('/new')
  const tiles = page.getByRole('button', { name: /Trend with reasons|Comparison table|Roadmap/ })
  await expect(page.getByRole('heading', { name: 'What should this slide say?' })).toBeVisible()
  await expect(page.locator('[data-starter]')).toHaveCount(29)
  await tiles.first().dblclick()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  await expect.poll(async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{}').decks ?? {}).length)).toBe(1)
})
test('style switch re-renders the gallery in pitch', async ({ page }) => {
  await page.goto('/new')
  await page.getByRole('group', { name: 'Writing style' }).getByRole('button', { name: 'Pitch' }).click()
  await expect(page.locator('[data-starter] .slide.style-pitch').first()).toBeVisible()
})
test('with the API down the gallery still works', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ status: 500, body: '{}' }))
  await page.goto('/new')
  await page.locator('[data-starter]').first().click()
  await page.getByRole('button', { name: 'Start with this slide' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  await expect(page.getByText('The models are not reachable right now')).toBeVisible()
})
