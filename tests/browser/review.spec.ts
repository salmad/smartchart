/* The review page renders every example and the stress deck in both palettes and fails on any issue (warnings pass). */
import { test, expect } from '@playwright/test'
for (const q of ['', 'stress=1&']) for (const theme of ['ink', 'paper']) {
  test(`review ${q || 'examples '}${theme}: 0 issues`, async ({ page }) => {
    await page.goto(`/src/dev/review.html?${q}theme=${theme}`)
    await page.waitForFunction(() => (window as unknown as { __fit?: unknown }).__fit, null, { timeout: 30_000 })
    const issues = await page.$$eval('figure .issues > div:not(.w)', (els) => els.map((e) => `${e.closest('figure')?.querySelector('b')?.textContent}: ${e.textContent}`))
    expect(issues).toEqual([])
  })
}
