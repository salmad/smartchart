/* The starters are the approved gallery: in both styles and palettes they show no issues and no warnings. */
import { test, expect } from '@playwright/test'
for (const style of ['consulting', 'pitch']) for (const theme of ['ink', 'paper']) {
  test(`starters ${style} ${theme}: 0 issues, 0 warnings`, async ({ page }) => {
    await page.goto(`/src/dev/review.html?style=${style}&theme=${theme}`)
    await page.waitForFunction(() => (window as unknown as { __fit?: unknown }).__fit, null, { timeout: 30_000 })
    const lines = await page.$$eval('figure .issues > div', (els) => els.map((e) => `${e.closest('figure')?.querySelector('b')?.textContent}: ${e.textContent}`))
    expect(lines).toEqual([])
  })
}
