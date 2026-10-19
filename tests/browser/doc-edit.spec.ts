/* Writing in a doc (M4): Edit, type, Enter and Backspace across blocks, Save, and the Markdown saved is what the page shows. */
import { test, expect, type Page } from '@playwright/test'

const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', '- one', '- two', ''].join('\n')

/** The dev account with one doc, seeded once: a reload keeps what the test saved. */
async function seed(page: Page, text = DOC) {
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, text)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string; name: string }>).doc_t)
const edit = async (page: Page) => { await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.doc-editing')).toBeVisible() }
const para = (page: Page, n = 0) => page.locator('.doc-editing p[data-field]').nth(n)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test.use({ viewport: { width: 1440, height: 900 } })

test('edits a paragraph and saves', async ({ page }) => {
  await seed(page)
  await edit(page)
  await para(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' And more words.')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect((await saved(page)).text).toContain('First paragraph here. And more words.')
  await expect(page.locator('.doc .sec-body p').first()).toHaveText('First paragraph here. And more words.')
})

test('enter splits, backspace joins, and the saved paragraph is the original', async ({ page }) => {
  await seed(page)
  await edit(page)
  await para(page).click()
  await page.keyboard.press('Home')
  for (let i = 0; i < 'First '.length; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.locator('.doc-editing .sec-body > p')).toHaveText(['First ', 'paragraph here.'])
  await expect(para(page, 1)).toBeFocused()
  await page.keyboard.press('Backspace')
  await expect(page.locator('.doc-editing .sec-body > p')).toHaveText(['First paragraph here.'])
  await page.keyboard.type('X')
  await expect(para(page)).toHaveText('First Xparagraph here.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect((await saved(page)).text).toContain('\n\nFirst Xparagraph here.\n\n- one\n- two\n')
})

test('enter on an empty list item ends the list', async ({ page }) => {
  await seed(page)
  await edit(page)
  await page.locator('.doc-editing li[data-field]').nth(1).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(page.locator('.doc-editing li[data-field]')).toHaveCount(3)
  await page.keyboard.press('Enter')
  await expect(page.locator('.doc-editing li[data-field]')).toHaveCount(2)
  await page.keyboard.type('After the list.')
  await expect(page.locator('.doc-editing .sec-body > :last-child')).toHaveText('After the list.')
  await expect(page.locator('.doc-editing .sec-body > :last-child')).toHaveJSProperty('tagName', 'P')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect((await saved(page)).text).toContain('- one\n- two\n\nAfter the list.\n')
})

test('a paragraph typed as "## x" stays a paragraph after reload', async ({ page }) => {
  await seed(page)
  await edit(page)
  await para(page).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## not a heading')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.doc .sec-body p').nth(1)).toHaveText('## not a heading')
  await expect(page.locator('.doc h2')).toHaveCount(1)
})

test('bold, and a link from ⌘K', async ({ page }) => {
  await seed(page)
  await edit(page)
  await para(page).click()
  await page.keyboard.press('Home')
  for (let i = 0; i < 'First'.length; i++) await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press(`${mod}+b`)
  await expect(para(page).locator('strong')).toHaveText('First')
  await page.keyboard.press(`${mod}+k`)
  await page.getByLabel('Link address').fill('example.com/report')
  await page.keyboard.press('Enter')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect((await saved(page)).text).toContain('**[First](https://example.com/report)** paragraph here.')
})

test('the title is the name: editing it renames the doc', async ({ page }) => {
  await seed(page)
  await edit(page)
  await page.locator('.doc-editing [data-head="title"]').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' two')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(await saved(page)).toMatchObject({ name: 'Test doc two' })
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Test doc two')
})

test('leaving with changes asks', async ({ page }) => {
  await seed(page)
  await edit(page)
  await para(page).click()
  await page.keyboard.type('x')
  let asked = ''
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
  await page.getByRole('button', { name: 'Discard' }).click()
  expect(asked).toMatch(/Discard your changes/)
  await expect(page.locator('.doc-editing')).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.locator('.doc-editing')).toHaveCount(0)
  expect((await saved(page)).text).toBe(DOC)
})

test('a viewer sees no Edit', async ({ page }) => {
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u_cy', email: 'cy@example.com', name: 'Cy', image: null }, session: {} } }))
  await page.route('**/api/workspaces**', (r) => r.fulfill({ json: [{ id: 'ws_a', name: 'Acme', role: 'viewer', personal: false, members: 3, usedAt: 2 }] }))
  await page.route('**/api/decks**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/docs**', (r) => new URL(r.request().url()).searchParams.get('id')
    ? r.fulfill({ json: { id: 'doc_t', name: 'Test doc', text: DOC, updated: 1, rev: 1, workspaceId: 'ws_a' } })
    : r.fulfill({ json: [{ id: 'doc_t', name: 'Test doc', updated: 1, workspaceId: 'ws_a' }] }))
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
})
