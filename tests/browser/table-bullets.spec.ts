/* Bullets in a table cell are a list: Enter adds the next bullet and puts the cursor in it, up to three (a doc here: a
   deck's table shares the same surface and list ops). */
import { test, expect, type Page } from '@playwright/test'

const TABLE = JSON.stringify({ caption: 'Options', table: { columns: [{ label: 'Option' }, { label: 'Why' }], rows: [
  { cells: ['Build', { value: 'Own it', bullets: ['Full control'] }] }, { cells: ['Buy', 'Faster'] }] }, source: 'Team' }, null, 2)
const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', '```occam:table {#opts}', TABLE, '```', ''].join('\n')

async function seed(page: Page) {
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1'); localStorage.setItem('smartchart.agentNudge.dismissed.dev', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, DOC)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>).doc_t.text)
const bullets = (page: Page) => page.locator('[data-figure-edit] [data-editing] td.has-bul li')

test.use({ viewport: { width: 1440, height: 900 } })

test('Enter in a table cell bullet adds the next bullet, up to three, and the doc saves them', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.doc-editing figure[data-kind="table"]').click()
  await expect(page.locator('[data-figure-edit] [data-editing]')).toBeVisible()
  await bullets(page).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(bullets(page)).toHaveCount(2)
  await page.keyboard.type('No licence fees')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Our roadmap')
  await expect(bullets(page)).toHaveText(['Full control', 'No licence fees', 'Our roadmap'])
  // Three is the most a cell holds: Enter does nothing more.
  await page.keyboard.press('Enter')
  await expect(bullets(page)).toHaveCount(3)
  await page.locator('[data-figure-edit]').getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(await saved(page)).toContain('"Full control",\n')
  expect(await saved(page)).toMatch(/"No licence fees",\s*"Our roadmap"/)
})
