/* `chart.highlight` draws one bar of a bars chart in the focus colour; every other bar keeps its series' colour. */
import { test, expect, type Page } from '@playwright/test'

const chart = (stacking: string) => JSON.stringify({ caption: 'Revenue · £m', chart: { stacking, categories: ['2021', '2022', '2023', '2024'], format: '£{v}m', highlight: { series: 0, index: 2 }, series: [
  { name: 'Us', mark: 'bar', color: 'neutral', values: [10, 20, 40, 80] }, { name: 'Them', mark: 'bar', color: 'neutral', values: [10, 15, 20, 25] }] }, source: 'Test data' }, null, 2)
const docWith = (stacking: string) => ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', '```occam:chart {#rev}', chart(stacking), '```', ''].join('\n')
const SVG = '.doc figure[data-kind="chart"] svg'

async function seed(page: Page, text: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, text)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}

test.use({ viewport: { width: 1440, height: 900 } })

for (const stacking of ['none', 'stacked']) {
  test(`a highlighted bar is the one focus bar (${stacking})`, async ({ page }) => {
    await seed(page, docWith(stacking))
    await expect(page.locator(`${SVG} path.bar`)).toHaveCount(8)
    await expect(page.locator(`${SVG} path.bar.c-focus`)).toHaveCount(1)
    await expect(page.locator(`${SVG} path.bar.c-focus`)).toHaveAttribute('data-i', '2')
    await expect(page.locator(`${SVG} path.bar.c-focus`)).toHaveAttribute('data-series', '0')
  })
}
