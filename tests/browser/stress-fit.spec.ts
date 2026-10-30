/* The claim the text limits rest on: a slide that passes validate() fits. The stress deck fills every field to its
   limit; on the review page every one of its slides must validate and fit, in both styles. */
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1920, height: 1080 } })

for (const style of ['consulting', 'pitch']) test(`every stress slide validates and fits: ${style}`, async ({ page }) => {
  await page.goto(`/src/dev/review.html?stress=1&style=${style}`)
  await page.waitForFunction(() => window.__fit, null, { timeout: 60_000 })
  const bad = await page.locator('figure').filter({ has: page.locator('.badge.bad') }).evaluateAll((figs) =>
    figs.map((f) => `${f.querySelector('figcaption, h3, .name')?.textContent?.trim() ?? '?'}: ${f.querySelector('.issues')?.textContent?.trim() ?? ''}`))
  expect(bad).toEqual([])
  expect(await page.evaluate(() => window.__fit?.issues)).toBe(0)
})
