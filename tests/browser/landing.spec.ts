/* A new deck: the start screen (the prompt at the centre, the style switch in it), the gallery one click away with
   every starter, one deck per pick, and picking with the API down. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem('cleared')) { localStorage.clear(); sessionStorage.setItem('cleared', '1') } }) })
signInAsDev()

test('landing shows every starter and picking one creates a one-slide deck', async ({ page }) => {
  await page.goto('/new')
  const tiles = page.getByRole('button', { name: /Trend with reasons|Comparison table|Roadmap/ })
  await expect(page.getByRole('heading', { name: 'Say what the room should take away.' })).toBeVisible()
  // The agent's panel waits for the first message; the prompt is at the centre.
  await expect(page.getByRole('complementary', { name: 'Chat' })).toBeHidden()
  await expect(page.locator('[data-starter]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Or start from a ready-made slide' }).click()
  await expect(page.locator('[data-starter]')).toHaveCount(30)
  await tiles.first().dblclick()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  await expect.poll(async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{}').decks ?? {}).length)).toBe(1)
})
test('style switch re-renders the gallery in pitch', async ({ page }) => {
  await page.goto('/new')
  await page.getByRole('group', { name: 'Writing style' }).getByRole('button', { name: 'Pitch' }).click()
  await page.getByRole('button', { name: 'Or start from a ready-made slide' }).click()
  await expect(page.locator('[data-starter] .slide.style-pitch').first()).toBeVisible()
})
test('with the API down the gallery still works', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ status: 500, body: '{}' }))
  await page.goto('/new')
  await expect(page.getByPlaceholder('The models are not reachable right now. Start from a ready-made slide instead.')).toBeVisible()
  await page.getByRole('button', { name: 'Or start from a ready-made slide' }).click()
  await page.locator('[data-starter]').first().click()
  await page.getByRole('button', { name: 'Start with this slide' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  await expect(page.getByText('The models are not reachable right now')).toBeVisible()
})
