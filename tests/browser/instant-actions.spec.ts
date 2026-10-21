/* Rename, delete and new doc change the sidebar at once; a request the server refuses puts the row back and says why. */
import { test, expect, type Page, type Route } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const deck = (id: string, name: string) => ({ id, name, updated: Date.now() - 3600_000, slides: 4 })
const doc = (id: string, name: string) => ({ id, name, updated: Date.now() - 7200_000, workspaceId: 'w1' })
const bar = (page: Page) => page.getByRole('navigation', { name: 'Workspace' })
/** The row's own button (its name starts with the item's name; the notice also quotes it). */
const row = (page: Page, name: string) => bar(page).getByRole('treeitem', { name: new RegExp(`^${name}`) })

/** A signed-in browser with two decks and two docs; `docRoute` and `deckRoute` get the requests that change something. */
async function start(page: Page, h: { deckRoute?: (r: Route, id: string | null) => Promise<void> | void; docRoute?: (r: Route, id: string | null) => Promise<void> | void } = {}) {
  const docs = [doc('x1', 'Research notes'), doc('x2', 'Hiring plan')]
  let decks = [deck('d1', 'Market sizing'), deck('d2', 'Board update')]
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams
    if (q.has('subpages')) return r.fulfill({ json: { count: 0 } }) // what deleting would also take
    if (r.request().method() !== 'GET' && h.deckRoute) return h.deckRoute(r, q.get('id'))
    if (r.request().method() === 'DELETE') { decks = decks.filter((d) => d.id !== q.get('id')); return r.fulfill({ json: { ok: true } }) }
    if (q.has('id')) return r.fulfill({ status: 404, json: { error: 'gone' } })
    await r.fulfill({ json: decks })
  })
  await page.route('**/api/pages**', (r) => r.fulfill({ json: [
    ...decks.map((d) => ({ kind: 'deck', id: d.id, name: d.name, updated: d.updated, slides: d.slides, parent: null, sortKey: null })),
    ...docs.map((d) => ({ kind: 'doc', id: d.id, name: d.name, updated: d.updated, slides: null, parent: null, sortKey: null }))] }))
  await page.route('**/api/docs**', async (r) => {
    const q = new URL(r.request().url()).searchParams, id = q.get('id')
    if (q.has('subpages')) return r.fulfill({ json: { count: 0 } })
    if (r.request().method() !== 'GET' && h.docRoute) return h.docRoute(r, id)
    if (id && q.size === 1) { const d = docs.find((x) => x.id === id); return d ? r.fulfill({ json: { ...d, text: `---\ntitle: ${d.name}\n---\n\n## One {#one}\n\nText.`, rev: 1 } }) : r.fulfill({ status: 404, json: {} }) }
    if (id) return r.fulfill({ status: 404, json: {} })
    await r.fulfill({ json: docs })
  })
  await page.goto('/new')
  await expect(row(page, 'Board update')).toBeVisible()
  await expect(row(page, 'Hiring plan')).toBeVisible()
}

async function menu(page: Page, name: string, item: string) {
  const li = bar(page).getByRole('treeitem').filter({ hasText: name })
  await li.hover()
  await li.getByRole('button', { name: `More for ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('a deck deleted while the server is slow is gone at once, and comes back with a sentence if the server refuses', async ({ page }) => {
  let refuse: () => Promise<void> = async () => undefined
  await start(page, { deckRoute: (r) => new Promise<void>((done) => { refuse = async () => { await r.fulfill({ status: 500, json: { error: 'down' } }); done() } }) })
  await menu(page, 'Board update', 'Delete deck…')
  await page.getByRole('dialog').getByRole('button', { name: /^Delete (deck|doc)$/ }).click()
  await expect(row(page, 'Board update')).toHaveCount(0)
  await refuse()
  await expect(row(page, 'Board update')).toBeVisible()
  await expect(bar(page).getByRole('alert')).toHaveText('Couldn’t delete “Board update”. It’s back in your list.')
})

test('a doc deleted while open stays gone through the refetch its route change causes, then returns if the server refuses', async ({ page }) => {
  let refuse: () => Promise<void> = async () => undefined
  await start(page, { docRoute: (r) => new Promise<void>((done) => { refuse = async () => { await r.fulfill({ status: 500, json: { error: 'down' } }); done() } }) })
  await row(page, 'Research notes').click()
  await expect(page).toHaveURL(/\/doc\/x1/)
  await menu(page, 'Research notes', 'Delete doc…')
  await page.getByRole('dialog').getByRole('button', { name: /^Delete (deck|doc)$/ }).click()
  await expect(page).not.toHaveURL(/\/doc\/x1/) // left the doc, which lists the docs again from the server, which still has it
  await page.waitForTimeout(500)
  await expect(row(page, 'Research notes')).toHaveCount(0)
  await refuse()
  await expect(row(page, 'Research notes')).toBeVisible()
  await expect(bar(page).getByRole('alert')).toContainText('Couldn’t delete “Research notes”.')
})

test('a rename shows at once and the old name returns, with a sentence, if the save is refused', async ({ page }) => {
  let refuse: () => Promise<void> = async () => undefined
  await start(page, { docRoute: (r) => new Promise<void>((done) => { refuse = async () => { await r.fulfill({ status: 403, json: { error: 'Viewers can’t change this doc.' } }); done() } }) })
  await menu(page, 'Hiring plan', 'Rename…')
  const dialog = page.getByRole('dialog', { name: 'Rename doc' })
  await dialog.getByRole('textbox').fill('Hiring 2027')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(row(page, 'Hiring 2027')).toBeVisible()
  await refuse()
  await expect(row(page, 'Hiring plan')).toBeVisible()
  await expect(row(page, 'Hiring 2027')).toHaveCount(0)
  await expect(bar(page).getByRole('alert')).toHaveText('Couldn’t rename “Hiring plan”. Viewers can’t change this doc.')
})

test('a deck that is gone cannot be renamed: the old name returns with a sentence', async ({ page }) => {
  await start(page)
  await menu(page, 'Board update', 'Rename…')
  const dialog = page.getByRole('dialog', { name: 'Rename deck' })
  await dialog.getByRole('textbox').fill('Board pack')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(bar(page).getByRole('alert')).toHaveText('Couldn’t rename “Board update”. That deck is gone.')
  await expect(row(page, 'Board update')).toBeVisible()
})

test('a new doc that cannot be saved appears, then goes with a sentence and no doc opens', async ({ page }) => {
  await start(page, { docRoute: (r) => r.fulfill({ status: 413, json: {} }) })
  await bar(page).getByRole('button', { name: 'New page' }).click()
  await page.getByRole('menuitem', { name: 'New doc' }).click()
  await page.getByRole('radiogroup').locator('label').first().click()
  await page.getByRole('button', { name: 'Create doc' }).click()
  await expect(bar(page).getByRole('alert')).toHaveText('Couldn’t create the doc. This doc is too large to save.')
  await expect(bar(page).getByRole('treeitem')).toHaveCount(4)
  await expect(page).not.toHaveURL(/\/doc\//)
})

test('a successful delete leaves the row gone and shows no sentence', async ({ page }) => {
  await start(page)
  await menu(page, 'Board update', 'Delete deck…')
  await page.getByRole('dialog').getByRole('button', { name: /^Delete (deck|doc)$/ }).click()
  await expect(row(page, 'Board update')).toHaveCount(0)
  await page.waitForTimeout(500)
  await expect(bar(page).getByRole('alert')).toHaveCount(0)
})
