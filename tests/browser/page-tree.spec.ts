/* The sidebar's page tree (dev account): docs and decks nested three levels, opened and closed, kept across reloads, and
   driven from the keyboard. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const OPEN = 'smartchart.tree.open.v1.dev.ws_local'
const deck = (id: string, title: string, place: object) => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }], ...place })
const doc = (id: string, title: string, place: object) => ({ id, name: title, text: `---\ntitle: ${title}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', ...place })
const R = { kind: 'doc', id: 'doc_r' }, C = { kind: 'doc', id: 'doc_c' }

/** Research > Competitors > Revolut (a deck), with Alpha (a deck) beside Research. Seeded once per test. */
const seed = (page: Page, open: string[] = []) => page.addInitScript(([decks, docs, openKey, openVal]) => {
  if (sessionStorage.getItem('seeded')) return
  localStorage.setItem('smartchart.journey.decks.v1', decks); localStorage.setItem('smartchart.docs.v1', docs)
  if (openVal !== '[]') localStorage.setItem(openKey, openVal)
  sessionStorage.setItem('seeded', '1')
}, [
  JSON.stringify({ active: 'alpha', decks: { alpha: deck('alpha', 'Alpha', { sortKey: 'b' }), rev: deck('rev', 'Revolut', { parent: C, sortKey: 'a' }) } }),
  JSON.stringify({ doc_r: doc('doc_r', 'Research', { sortKey: 'a' }), doc_c: doc('doc_c', 'Competitors', { parent: R, sortKey: 'a' }) }),
  OPEN, JSON.stringify(open),
] as const)
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Workspace' })
const rows = (page: Page) => sidebar(page).getByRole('tree', { name: 'Pages' }).getByRole('treeitem')
const row = (page: Page, name: string) => rows(page).filter({ hasText: name })

test('the open page’s branch is expanded: three levels, with their depth and the open row marked', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  expect(await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))).toEqual(['1', '2', '3', '1'])
  await expect(row(page, 'Revolut')).toHaveAttribute('aria-selected', 'true')
  await expect(row(page, 'Research')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Alpha')).not.toHaveAttribute('aria-expanded')
})

test('chevrons open and close a branch', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await page.getByRole('button', { name: 'Expand Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.getByRole('button', { name: 'Expand Competitors' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
})

test('what the viewer opened stays open after a reload, and what they closed stays closed', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await page.getByRole('button', { name: 'Expand Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await page.reload()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
})

test('opening a page inside a closed branch opens the branch, and a reload on it keeps it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await page.reload()
  // The page on screen is inside the closed branch: it is shown.
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await expect(row(page, 'Revolut')).toHaveAttribute('aria-selected', 'true')
})

test('the tree works from the keyboard: arrows, Right, Left, Home, End, typing a letter, Enter', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await row(page, 'Alpha').focus()
  await page.keyboard.press('ArrowUp')
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('ArrowRight') // expands
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('ArrowRight') // enters
  await expect(row(page, 'Competitors')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(row(page, 'Revolut')).toBeFocused()
  await page.keyboard.press('ArrowLeft') // to the parent
  await expect(row(page, 'Competitors')).toBeFocused()
  await page.keyboard.press('ArrowLeft') // collapses
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.keyboard.press('End')
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('a')
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/doc\/doc_r$/)
  await expect(row(page, 'Research')).toHaveAttribute('aria-selected', 'true')
})

test('only one row takes Tab', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await expect(rows(page).and(page.locator('[tabindex="0"]'))).toHaveCount(1)
  await expect(row(page, 'Revolut')).toHaveAttribute('tabindex', '0')
})
