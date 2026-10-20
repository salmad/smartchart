/* The fill under a focus line: drawn by default in a line-only chart, off with `area: false`, and switched by hand from
   the chart's right-click menu (a doc here: a deck shares the same menu and renderer). */
import { test, expect, type Page } from '@playwright/test'

const CHART = JSON.stringify({ caption: 'Revenue · £m', chart: { categories: ['2021', '2022', '2023', '2024'], format: '£{v}m', series: [
  { name: 'Us', mark: 'line', color: 'focus', values: [10, 20, 40, 80] }, { name: 'Them', mark: 'line', color: 'neutral', values: [10, 15, 20, 25] }] }, source: 'Test data' }, null, 2)
const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', '```occam:chart {#rev}', CHART, '```', ''].join('\n')
const FILL = '.doc figure[data-kind="chart"] svg path[fill="url(#gA)"]'

async function seed(page: Page) {
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, DOC)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>).doc_t.text)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test.use({ viewport: { width: 1440, height: 900 } })

test('a focus line with no area field is filled; the right-click item turns it off and on', async ({ page }) => {
  await seed(page)
  await expect(page.locator(FILL)).toHaveCount(1)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.doc-editing figure[data-kind="chart"]').click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  const toggle = async () => {
    await page.locator('[data-figure-edit] [data-chart]').click({ button: 'right' })
    await page.getByRole('menuitemcheckbox', { name: 'Fill under the line' }).click()
  }
  await page.locator('[data-figure-edit] [data-chart]').click({ button: 'right' })
  await expect(page.getByRole('menuitemcheckbox', { name: 'Fill under the line' })).toBeChecked()
  await page.keyboard.press('Escape')
  await toggle()
  await page.locator('[data-figure-edit]').getByRole('button', { name: 'Done' }).click()
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(await saved(page)).toContain('"area": false')
  await expect(page.locator(FILL)).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.doc-editing figure[data-kind="chart"]').click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  await toggle()
  await page.locator('[data-figure-edit]').getByRole('button', { name: 'Done' }).click()
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(await saved(page)).not.toContain('"area"')
  await expect(page.locator(FILL)).toHaveCount(1)
})
