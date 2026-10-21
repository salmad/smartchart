/* Pointing at a deck in the sidebar reads it ahead; the click then opens it from this browser's copy, with the server's
   answer (held here) still on its way. */
import { test, expect } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const row = (id: string, title: string) => ({ id, name: title, named: false, updated: 100, rev: 1, role: 'owner',
  data: { id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 100, items: [{ id: 's1', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }] }, chat: null })
const decks = { d1: row('d1', 'Market sizing'), d2: row('d2', 'Board update') }

test('hovering a deck reads it once, and the click opens it before the server answers', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/pages**', (r) => r.fulfill({ json: Object.values(decks).map((d) => ({ kind: 'deck', id: d.id, name: d.name, updated: 100, slides: 1, parent: null, sortKey: null })) }))
  const reads: string[] = []
  let hold = false
  const held = new Promise<void>(() => undefined)
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams, id = q.get('id') as keyof typeof decks | null
    if (r.request().method() === 'PUT') return r.fulfill({ json: { ok: true, rev: 9 } })
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.has('events') || q.has('versions')) return r.fulfill({ json: [] })
    if (id) { reads.push(id); if (hold && id === 'd2' && reads.filter((x) => x === 'd2').length > 1) await held; return r.fulfill({ json: decks[id] }) }
    return r.fulfill({ json: Object.values(decks).map((d) => ({ id: d.id, name: d.name, updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null })) })
  })
  const bar = page.getByRole('navigation', { name: 'Workspace' })
  await page.goto('/d/d1')
  await expect(bar.getByText('Board update')).toBeVisible()
  const row2 = bar.getByRole('treeitem', { name: /^Board update/ })
  expect(reads.filter((x) => x === 'd2')).toHaveLength(0)
  await row2.hover()
  await expect.poll(() => reads.filter((x) => x === 'd2').length).toBe(1)
  await page.mouse.move(0, 0); await row2.hover(); await page.waitForTimeout(400)
  expect(reads.filter((x) => x === 'd2')).toHaveLength(1) // once per deck
  await page.waitForTimeout(400) // the copy is stored
  hold = true
  await row2.click()
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 10000 }).toBe('Board update')
})

test('the deck that is open is never read ahead', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/pages**', (r) => r.fulfill({ json: Object.values(decks).map((d) => ({ kind: 'deck', id: d.id, name: d.name, updated: 100, slides: 1, parent: null, sortKey: null })) }))
  const reads: string[] = []
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams, id = q.get('id') as keyof typeof decks | null
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.has('events') || q.has('versions')) return r.fulfill({ json: [] })
    if (id) { reads.push(id); return r.fulfill({ json: decks[id] }) }
    return r.fulfill({ json: Object.values(decks).map((d) => ({ id: d.id, name: d.name, updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null })) })
  })
  const bar = page.getByRole('navigation', { name: 'Workspace' })
  await page.goto('/d/d1')
  await expect(bar.getByText('Board update')).toBeVisible()
  const before = reads.filter((x) => x === 'd1').length
  await bar.getByRole('treeitem', { name: /^Market sizing/ }).hover()
  await page.waitForTimeout(500)
  expect(reads.filter((x) => x === 'd1')).toHaveLength(before)
})
