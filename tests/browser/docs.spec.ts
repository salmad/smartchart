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

test('every doc starter is clean at three widths', async ({ page }) => {
  test.setTimeout(120_000)
  const found: string[] = []
  for (const s of DOC_STARTERS) for (const theme of ['paper', 'ink']) for (const width of [343, 720, 1040]) {
    await open(page, s.id, `&theme=${theme}&width=${width}`)
    const issues = await page.evaluate(() => window.__docs?.issues ?? ['no result'])
    found.push(...issues.map((i) => `${s.id} ${theme} ${width}: ${i}`))
  }
  expect(found).toEqual([])
})

test('no doc starter shows a checks badge', async ({ page }) => {
  for (const s of DOC_STARTERS) {
    await open(page, s.id)
    await expect(page.locator('.fig-checks'), s.id).toHaveCount(0)
  }
})

test('a figure with a failed check has a badge that opens, closes on Esc, and is not printed', async ({ page }) => {
  const text = ['---', 'title: Badge doc', '---', '', '## Numbers {#numbers}', '', '```occam:chart {#rev}',
    JSON.stringify({ caption: 'Revenue · £m', chart: { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'R', mark: 'bar', color: 'focus', values: [18, 25] }] } }), '```', ''].join('\n')
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_b: { id: 'doc_b', name: 'Badge doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
  }, text)
  await page.goto('/doc/doc_b')
  const badge = page.locator('.doc .fig-checks')
  await expect(badge).toHaveCount(1)
  await expect(badge.locator('summary')).toHaveText('1 check')
  await badge.locator('summary').click()
  await expect(badge.locator('li')).toContainText('R8')
  await page.keyboard.press('Escape')
  await expect(badge).not.toHaveAttribute('open', '')
  await page.emulateMedia({ media: 'print' })
  await expect(badge).toBeHidden()
})
