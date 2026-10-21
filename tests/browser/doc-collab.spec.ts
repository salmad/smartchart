/* Around the doc editor (M4): versions to preview and restore, comments on selected words, a stale save refused, and
   no Versions while editing. The dev account's docs live in this browser, so the same repo code runs as on the server. */
import { test, expect, type Page } from '@playwright/test'

const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', ''].join('\n')

async function seed(page: Page) {
  await page.clock.install()
  await page.addInitScript((t) => {
    localStorage.setItem('smartchart.devAccount', '1')
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
    sessionStorage.setItem('seeded', '1')
  }, DOC)
  await page.goto('/doc/doc_t')
  await expect(page.locator('.doc-title')).toHaveText('Test doc')
}
const edit = async (page: Page) => { await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.doc-editing')).toBeVisible() }
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
/** Appends words to the first paragraph and saves. */
async function append(page: Page, words: string) {
  await edit(page)
  await page.locator('.doc-editing .sec-body > p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(words)
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
}

test.use({ viewport: { width: 1440, height: 900 } })

test('restore a version: the read view shows the first text, and Versions lists three', async ({ page }) => {
  await seed(page)
  await append(page, ' One.')
  await page.clock.runFor(120_000) // a pause past GROUP_MS: the next save is its own version
  await append(page, ' Two.')
  await page.getByRole('button', { name: 'Versions' }).click()
  const rows = page.getByRole('complementary', { name: 'Versions' }).locator('button[aria-pressed]')
  await expect(rows).toHaveCount(2)
  await rows.nth(1).click()
  await expect(page.locator('.doc .sec-body p').first()).toHaveText('First paragraph here. One.')
  await page.getByRole('button', { name: 'Restore this version' }).click()
  await expect(page.locator('.doc .sec-body p').first()).toHaveText('First paragraph here. One.')
  await expect(rows).toHaveCount(3)
})

test('comment on selected words; the panel lists it under its section; resolve folds it away', async ({ page }) => {
  await seed(page)
  await page.locator('.doc .sec-body p').first().evaluate((p) => {
    const r = document.createRange(), t = p.firstChild as Text
    r.setStart(t, 6); r.setEnd(t, 15)
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r)
  })
  await page.clock.runFor(200)
  await page.getByRole('button', { name: 'Comment on the selection' }).click()
  const panel = page.getByRole('complementary', { name: 'Comments' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Plan · “paragraph”')).toBeVisible() // the composer names its target
  await panel.getByRole('textbox', { name: 'New comment' }).fill('Say more here')
  await page.keyboard.press('Enter')
  await expect(panel.getByRole('heading', { name: 'Plan' })).toBeVisible()
  await expect(panel.getByText('Say more here')).toBeVisible()
  await expect(panel.getByText('“paragraph”', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Comments, 1 open' })).toBeVisible()
  await panel.getByText('Say more here').hover()
  await panel.getByRole('button', { name: 'Resolve' }).click()
  await expect(panel.getByText('Say more here')).toBeHidden()
  await expect(panel.getByRole('button', { name: /1 resolved/ })).toBeVisible()
})

test('a stale save: the newer-version bar appears, and Save is refused with the reason', async ({ page }) => {
  await seed(page)
  await edit(page)
  await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { rev?: number }>
    all.doc_t.rev = (all.doc_t.rev ?? 1) + 1 // saved from another tab
    localStorage.setItem('smartchart.docs.v1', JSON.stringify(all))
  })
  await page.clock.runFor(16_000)
  await expect(page.getByText('saved a newer version.')).toBeVisible()
  await page.locator('.doc-editing .sec-body > p').first().click()
  await page.keyboard.type('x')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Not saved')
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy my text' })).toBeVisible()
})

test('Versions is not offered while editing', async ({ page }) => {
  await seed(page)
  await expect(page.getByRole('button', { name: 'Versions' })).toBeVisible()
  await edit(page)
  await expect(page.getByRole('button', { name: 'Versions' })).toHaveCount(0)
})

test('Look: the palette and accent change the page, persist, and are not offered while editing', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Look' }).click()
  const look = page.getByRole('complementary', { name: 'Doc look' })
  await expect(look.getByRole('group', { name: 'Deck style' })).toHaveCount(0)
  await look.getByRole('button', { name: 'Ink' }).click()
  await expect(page.locator('.doc.theme-ink')).toBeVisible()
  await look.getByRole('button', { name: 'Cobalt' }).click()
  await page.reload()
  await expect(page.locator('.doc.theme-ink')).toBeVisible()
  await page.getByRole('button', { name: 'Versions' }).click()
  await expect(page.getByRole('complementary', { name: 'Versions' })).toContainText('Changed the look')
  await edit(page)
  await expect(page.getByRole('button', { name: 'Look' })).toHaveCount(0)
})
