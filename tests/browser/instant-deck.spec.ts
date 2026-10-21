/* A repeat visit opens the deck from this browser while the server's copy is held; then what the server says wins:
   changed slides merge in, a deck that is gone is missing, a role downgrade makes it read-only. */
import { test, expect, type Page } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const slide = (title: string) => ({ id: 's1', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] })
const row = (title: string, rev: number, role = 'owner') => ({ id: 'd1', name: title, named: false, updated: 100 + rev, rev, role,
  data: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 100 + rev, items: [slide(title)], history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }] }, chat: null })
const title = (page: Page) => page.evaluate(() => window.__journey?.items[0]?.slide.title)

async function twoVisits(page: Page, second: { status?: number; row?: ReturnType<typeof row> }) {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  let hold = false // armed for the second visit (the first one fetches twice in dev, under StrictMode)
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  const current = row('Market sizing', 1)
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams
    if (r.request().method() === 'PUT') return r.fulfill({ json: { ok: true, rev: 9 } })
    if (q.has('rev')) return r.fulfill({ json: { rev: current.rev, presence: {} } })
    if (q.has('events') || q.has('versions')) return r.fulfill({ json: [] })
    if (q.has('id')) {
      if (hold) await held
      if (hold && second.status) return r.fulfill({ status: second.status, json: {} })
      return r.fulfill({ json: hold && second.row ? second.row : current })
    }
    return r.fulfill({ json: [{ id: 'd1', name: current.name, updated: current.updated, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null }] })
  })
  await page.goto('/d/d1')
  await expect.poll(() => title(page)).toBe('Market sizing')
  await page.waitForTimeout(400) // the copy is stored
  hold = true
  await page.reload()
  return { release }
}

test('the deck opens from the cache while the server is slow, and the server’s newer slides merge in', async ({ page }) => {
  const { release } = await twoVisits(page, { row: row('Market sizing, updated', 2) })
  await expect.poll(() => title(page), { timeout: 15000 }).toBe('Market sizing')
  await expect(page.locator('textarea')).toBeVisible()
  release()
  await expect.poll(() => title(page)).toBe('Market sizing, updated')
})

test('a deck the server no longer has is missing, not shown from the cache', async ({ page }) => {
  const { release } = await twoVisits(page, { status: 404 })
  await expect.poll(() => title(page), { timeout: 15000 }).toBe('Market sizing')
  release()
  await expect(page.getByText('That deck isn’t in your account.')).toBeVisible()
  await expect.poll(() => title(page)).toBeUndefined()
})

test('a role downgrade to viewer makes the cached deck read-only', async ({ page }) => {
  const { release } = await twoVisits(page, { row: row('Market sizing', 1, 'viewer') })
  await expect.poll(() => title(page), { timeout: 15000 }).toBe('Market sizing')
  await expect(page.locator('textarea')).toBeVisible()
  release()
  await expect(page.locator('textarea')).toHaveCount(0)
})

test('the starter gallery is never drawn while a known deck is opening', async ({ page }) => {
  // Thirty slide tiles measured and drawn for a deck that is about to replace them cost most of a repeat visit's start.
  await page.addInitScript(() => {
    ;(window as unknown as { __tiles: boolean }).__tiles = false
    new MutationObserver(() => { if (document.querySelector('[data-starter]')) (window as unknown as { __tiles: boolean }).__tiles = true }).observe(document, { childList: true, subtree: true })
  })
  const { release } = await twoVisits(page, {})
  await expect.poll(() => title(page), { timeout: 15000 }).toBe('Market sizing')
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => (window as unknown as { __tiles: boolean }).__tiles)).toBe(false)
  release()
})
