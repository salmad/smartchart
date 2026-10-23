/* The workspace sidebar (dev account): the workspace's name at the top, then its docs and decks as one tree. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = (id: string, title: string, updated: number) => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }] })
const seed = (page: Page) => page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } },
  [KEY, JSON.stringify({ active: 'a', decks: { a: deck('a', 'Alpha', 3000), b: deck('b', 'Beta', 2000) } })] as const)
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Workspace' })
const rows = (page: Page) => sidebar(page).getByRole('tree', { name: 'Pages' }).getByRole('treeitem')
const newPage = async (page: Page, what: 'doc' | 'deck') => { await sidebar(page).getByRole('button', { name: 'New page' }).click(); await page.getByRole('menuitem', { name: `New ${what}` }).click() }

test('the sidebar names the workspace and lists its docs and decks', async ({ page }) => {
  await seed(page)
  await page.goto('/d/a')
  await expect(sidebar(page).getByRole('button', { name: /Dev’s workspace/ })).toBeVisible()
  await expect(sidebar(page).getByRole('heading', { name: 'Pages' })).toBeVisible()
  await expect(rows(page)).toHaveText(['Alpha', 'Beta'])
})

test('a new doc can be blank: it is the default, lists as Untitled doc and opens', async ({ page }) => {
  await seed(page)
  await page.goto('/d/a')
  await newPage(page, 'doc')
  const dialog = page.getByRole('dialog', { name: 'New doc' })
  await expect(dialog.getByRole('radio', { name: /Blank doc/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Create doc' }).click()
  await expect(page).toHaveURL(/\/doc\/doc_[\w-]+$/)
  await expect(rows(page)).toHaveText(['Alpha', 'Beta', 'Untitled doc'])
})

test('a new doc from a starter lists in the tree and opens in the read view', async ({ page }) => {
  await seed(page)
  await page.goto('/d/a')
  await newPage(page, 'doc')
  const dialog = page.getByRole('dialog', { name: 'New doc' })
  await dialog.getByText('Competitor research', { exact: true }).click()
  await expect(dialog.getByRole('radio', { name: /Competitor research/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Create doc' }).click()
  await expect(page).toHaveURL(/\/doc\/doc_[\w-]+$/)
  await expect(page.locator('.doc')).toBeVisible()
  await expect(rows(page)).toHaveText(['Alpha', 'Beta', 'Finbridge competitor research'])
  await expect(rows(page).filter({ hasText: 'Finbridge' })).toHaveAttribute('aria-selected', 'true')
  // A deck opens from the doc screen, and the doc stays listed.
  await rows(page).filter({ hasText: 'Beta' }).click()
  await expect(page).toHaveURL(/\/d\/b$/)
  await expect(rows(page)).toHaveText(['Alpha', 'Beta', 'Finbridge competitor research'])
})

test('renaming a deck and a doc changes its row', async ({ page }) => {
  await seed(page)
  await page.goto('/d/a')
  const beta = rows(page).filter({ hasText: 'Beta' })
  await beta.hover()
  await beta.getByRole('button', { name: 'More for Beta' }).click()
  await page.getByRole('menuitem', { name: 'Rename…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rename deck' })
  await dialog.getByRole('textbox').fill('Board update')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(rows(page).filter({ hasText: 'Board update' })).toHaveCount(1)
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').decks.b.name, KEY)).toBe('Board update')

  await page.evaluate(() => localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_m: { id: 'doc_m', name: 'Memo', text: '---\ntitle: Memo\n---\n\n## One {#one}\n\nText.', updated: 5, workspaceId: 'ws_local' } })))
  await page.reload()
  const memo = rows(page).filter({ hasText: 'Memo' })
  await memo.hover()
  await memo.getByRole('button', { name: 'More for Memo' }).click()
  await page.getByRole('menuitem', { name: 'Rename…' }).click()
  await page.getByRole('dialog', { name: 'Rename doc' }).getByRole('textbox').fill('Board memo')
  await page.getByRole('dialog', { name: 'Rename doc' }).getByRole('button', { name: 'Rename' }).click()
  await expect(rows(page).filter({ hasText: 'Board memo' })).toHaveCount(1)
})

test('⌘\\ hides and shows the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await seed(page)
  await page.goto('/d/a')
  await expect(sidebar(page)).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Backslash')
  await expect(sidebar(page)).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Backslash')
  await expect(sidebar(page)).toBeVisible()
})
