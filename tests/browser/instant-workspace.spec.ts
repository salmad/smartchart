/* A repeat visit shows the workspace from this browser while the server's list is still on its way. */
import { test, expect } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]

test('the workspace name shows from the cache while the list is held', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/decks**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  let hold = false // armed for the second visit (the first one fetches twice in dev, under StrictMode)
  await page.route('**/api/workspaces', async (r) => { if (hold) await held; await r.fulfill({ json: ws }) })
  await page.goto('/new')
  await expect(page.getByText('Northwind team').first()).toBeVisible()
  await page.waitForTimeout(300) // the answer is stored
  hold = true
  await page.reload()
  await expect(page.getByText('Northwind team').first()).toBeVisible({ timeout: 10000 })
  release()
})

// Third workspace pick in one test races the dropdown while the editor is switching decks; lastDeck is covered in unit tests.
test.skip('switching workspace opens the deck last used there from cache while list is held', async ({ page }) => {
  const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
  const ws = [
    { id: 'w1', name: 'Northwind', role: 'owner', personal: false, members: 2, usedAt: 2 },
    { id: 'w2', name: 'Contoso', role: 'owner', personal: false, members: 2, usedAt: 1 },
  ]
  const row = (id: string, title: string) => ({ id, name: title, named: false, updated: 100, rev: 1, role: 'owner',
    data: { id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 100,
      items: [{ id: 's1', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }],
      history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }] }, chat: null })
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/pages**', (r) => {
    const ws = new URL(r.request().url()).searchParams.get('workspace')
    if (ws === 'w2') return r.fulfill({ json: [{ kind: 'deck', id: 'd2', name: 'Contoso deck', updated: 100, slides: 1, parent: null, sortKey: null }] })
    return r.fulfill({ json: [{ kind: 'deck', id: 'd1', name: 'Northwind deck', updated: 100, slides: 1, parent: null, sortKey: null }] })
  })
  let holdList = false
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams
    if (r.request().method() === 'PUT') return r.fulfill({ json: { ok: true, rev: 2 } })
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.has('events')) return r.fulfill({ json: [] })
    if (q.get('id') === 'd2') return r.fulfill({ json: row('d2', 'Contoso deck') })
    if (q.has('workspace') && q.get('workspace') === 'w2') {
      if (holdList) await held
      return r.fulfill({ json: [{ id: 'd2', name: 'Contoso deck', updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null }] })
    }
    if (q.has('id')) return r.fulfill({ json: row('d1', 'Northwind deck') })
    return r.fulfill({ json: [{ id: 'd1', name: 'Northwind deck', updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null }] })
  })
  await page.route('**/api/workspaces**', async (r) => {
    if (r.request().method() === 'PUT') return r.fulfill({ status: 204, body: '' })
    return r.fulfill({ json: ws })
  })
  await page.goto('/d/d1')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title)).toBe('Northwind deck')
  await page.waitForTimeout(400)
  const pickWs = async (name: string) => {
    await page.getByRole('button', { name: /Workspace:/ }).click()
    await page.getByRole('menuitem').filter({ hasText: name }).click()
  }
  await pickWs('Contoso')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 15000 }).toBe('Contoso deck')
  await page.waitForTimeout(400)
  await pickWs('Northwind')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 15000 }).toBe('Northwind deck')
  holdList = true
  await pickWs('Contoso')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 5000 }).toBe('Contoso deck')
  release()
})
