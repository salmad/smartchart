/* A repeat visit lists the workspace's decks and docs from this browser while the server's lists are held, then the
   server's answer replaces them. */
import { test, expect } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const deck = (id: string, name: string) => ({ id, name, updated: Date.now() - 3600_000, slides: 4, style: 'consulting', theme: 'ink', accent: null, first: null })
const doc = (id: string, name: string) => ({ id, name, updated: Date.now() - 7200_000, workspaceId: 'w1' })
/** What /api/pages answers: the decks and docs as one list. */
const pagesOf = (decks: { id: string; name: string; updated: number; slides: number }[], docs: { id: string; name: string; updated: number }[]) => [
  ...decks.map((d) => ({ kind: 'deck', id: d.id, name: d.name, updated: d.updated, slides: d.slides, parent: null, sortKey: null })),
  ...docs.map((d) => ({ kind: 'doc', id: d.id, name: d.name, updated: d.updated, slides: null, parent: null, sortKey: null }))]

test('the lists show from the cache while the server is slow, then the fresh lists replace them', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  let hold = false // armed for the second visit (the first one fetches twice in dev, under StrictMode)
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  let decks = [deck('d1', 'Market sizing'), deck('d2', 'Board update')], docs = [doc('x1', 'Research notes')]
  await page.route('**/api/decks**', async (r) => {
    if (new URL(r.request().url()).searchParams.has('id')) return r.fulfill({ status: 404, json: { error: 'gone' } })
    if (hold) await held
    await r.fulfill({ json: decks })
  })
  await page.route('**/api/docs**', async (r) => { if (hold) await held; await r.fulfill({ json: docs }) })
  await page.route('**/api/pages**', async (r) => { if (hold) await held; await r.fulfill({ json: pagesOf(decks, docs) }) })
  const bar = page.getByRole('navigation', { name: 'Workspace' })
  await page.goto('/new')
  await expect(bar.getByText('Market sizing')).toBeVisible()
  await expect(bar.getByText('Research notes')).toBeVisible()
  await page.waitForTimeout(300) // the answers are stored
  hold = true
  await page.reload()
  await expect(bar.getByText('Market sizing')).toBeVisible({ timeout: 10000 })
  await expect(bar.getByText('Board update')).toBeVisible()
  await expect(bar.getByText('Research notes')).toBeVisible()
  // The server's lists differ now: one deck gone, one added.
  decks = [deck('d2', 'Board update'), deck('d3', 'Hiring plan')]; docs = []
  release()
  await expect(bar.getByText('Hiring plan')).toBeVisible()
  await expect(bar.getByText('Market sizing')).toHaveCount(0)
  await expect(bar.getByText('Research notes')).toHaveCount(0)
})

test('another account never sees these lists', async ({ page }) => {
  const other = { ...user, id: 'u2', email: 'bob@example.com', name: 'Bob' }
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user: page.url().includes('as=bob') ? other : user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  let hold = false
  const held = new Promise<void>(() => undefined)
  await page.route('**/api/decks**', async (r) => {
    if (new URL(r.request().url()).searchParams.has('id')) return r.fulfill({ status: 404, json: { error: 'gone' } })
    if (hold) await held
    await r.fulfill({ json: [deck('d1', 'Market sizing')] })
  })
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/pages**', async (r) => { if (hold) await held; await r.fulfill({ json: pagesOf([deck('d1', 'Market sizing')], []) }) })
  const bar = page.getByRole('navigation', { name: 'Workspace' })
  await page.goto('/new')
  await expect(bar.getByText('Market sizing')).toBeVisible()
  await page.waitForTimeout(300)
  hold = true
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), other)
  await page.goto('/new?as=bob')
  await expect(page.getByRole('button', { name: 'Account: Bob' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(bar.getByText('Market sizing')).toHaveCount(0)
})
