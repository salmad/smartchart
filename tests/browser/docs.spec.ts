/* The doc read view on the dev page: contents, figures scaled to their frame, folding (kept, and open in print), links
   that unfold, notes beside or below, and figures that expand on a phone. */
import { test, expect, type Page } from '@playwright/test'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import { outline } from '@/engine/docs/parse'

const open = async (page: Page, doc: string, query = '') => {
  await page.goto(`/src/dev/docs.html?doc=${doc}${query}`)
  await page.waitForFunction(() => window.__docs)
}
/** A figure's frame height against its canvas's design height at the frame's scale (1664 design px wide). */
const fit = (page: Page, id: string) => page.locator(`#${id} .fig-frame`).evaluate((frame) => {
  const fig = frame.querySelector<HTMLElement>('.fig')
  return { frame: frame.getBoundingClientRect().height, want: (fig?.offsetHeight ?? 0) * frame.clientWidth / 1664 }
})

test.use({ viewport: { width: 1440, height: 900 } })

test('a doc opens readable, with contents', async ({ page }) => {
  await open(page, 'prd')
  await expect(page.locator('.doc-title')).toHaveText('Card controls PRD')
  const prd = DOC_STARTERS.find((s) => s.id === 'prd')
  await expect(page.locator('.doc-toc')).toBeVisible()
  await expect(page.locator('.doc-toc a')).toHaveCount(prd ? outline(starterDoc(prd)).length : -1)
  await expect(page.locator('.doc-sec.folded')).toHaveCount(0)
})

test('a figure is scaled to the column', async ({ page }) => {
  await open(page, 'competitor-teardown')
  const { frame, want } = await fit(page, 'revenue')
  expect(want).toBeGreaterThan(100)
  expect(Math.abs(frame - want)).toBeLessThanOrEqual(1)
  await expect(page.locator('#revenue .fig svg').first()).toBeAttached()
})

test('a section folds, stays folded, and prints open', async ({ page }) => {
  await open(page, 'prd')
  const sec = page.locator('.doc-sec').nth(1)
  await sec.locator('.fold').click()
  await expect(sec.locator('.sec-body')).toBeHidden()
  await expect(sec.locator('.fold')).toHaveAttribute('aria-expanded', 'false')
  await page.reload()
  await page.waitForFunction(() => window.__docs)
  await expect(page.locator('.doc-sec').nth(1).locator('.sec-body')).toBeHidden()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.doc-sec').nth(1).locator('.sec-body')).toBeVisible()
})

test('a link unfolds its section and scrolls to it', async ({ page }) => {
  await open(page, 'competitor-teardown')
  await page.locator('#position .fold').click()
  await expect(page.locator('#position')).toHaveClass(/folded/)
  await page.locator('#summary a[href="#scorecard"]').click()
  await expect(page.locator('#position')).not.toHaveClass(/folded/)
  await expect.poll(async () => (await page.locator('#scorecard').boundingBox())?.y ?? -999).toBeGreaterThanOrEqual(-2)
  expect((await page.locator('#scorecard').boundingBox())?.y).toBeLessThanOrEqual(80)
})

test('a figure folded at load sizes when unfolded', async ({ page }) => {
  await open(page, 'competitor-teardown')
  await page.locator('#growth .fold').click()
  await page.reload()
  await page.waitForFunction(() => window.__docs)
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.locator('#growth .fold').click()
  await expect.poll(async () => { const r = await fit(page, 'revenue'); return r.want > 100 && Math.abs(r.frame - r.want) <= 1 }).toBe(true)
})

test('notes sit beside on a desktop and below on a phone', async ({ page }) => {
  await open(page, 'competitor-teardown')
  await expect(page.locator('#revenue .fig .split')).toHaveCount(1)
  await expect(page.locator('#revenue .fig-notes')).toBeHidden()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.locator('#revenue .fig .split')).toHaveCount(0)
  await expect(page.locator('#revenue .fig-notes')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('#revenue .fig .split')).toHaveCount(1)
  await expect.poll(async () => { const r = await fit(page, 'revenue'); return Math.abs(r.frame - r.want) <= 1 }).toBe(true)
})

test('on a phone, a figure expands', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, 'legal-memo')
  await page.locator('#by-country .fig-expand').click()
  await expect(page.locator('dialog[open] .fig-frame')).toBeVisible()
  expect(await page.locator('dialog[open] .fig-frame').evaluate((el) => el.clientWidth)).toBe(1040)
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
})
