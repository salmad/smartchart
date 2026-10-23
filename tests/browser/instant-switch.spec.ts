/* Moving between decks and docs with the server slow to answer: the screen goes from the page that was open straight to
   the one picked. Never a blank frame, and never the deck held behind a doc. */
import { test, expect, type Page } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const row = (id: string, title: string) => ({ id, name: title, named: false, updated: 100, rev: 1, role: 'owner',
  data: { id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 100, items: [{ id: 's1', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }] }, chat: null })
const decks = { d1: row('d1', 'Market sizing'), d2: row('d2', 'Board update'), d3: row('d3', 'Pricing') }
const doc = { id: 'doc_a', name: 'Alpha plan', text: '---\ntitle: Alpha plan\n---\n\nFirst paragraph here.\n', updated: 100, rev: 1, workspaceId: 'w1' }
const SLOW = 600

async function serve(page: Page) {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/pages**', (r) => r.fulfill({ json: [...Object.values(decks).map((d) => ({ kind: 'deck', id: d.id, name: d.name, updated: 100, slides: 1, parent: null, sortKey: null })),
    { kind: 'doc', id: doc.id, name: doc.name, updated: 100, slides: null, parent: null, sortKey: null }] }))
  await page.route('**/api/docs**', (r) => {
    const q = new URL(r.request().url()).searchParams
    if (!q.get('id')) return r.fulfill({ json: [] })
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {}, role: 'owner' } })
    return r.fulfill({ json: q.has('comments') || q.has('versions') ? [] : doc })
  })
  await page.route('**/api/decks**', async (r) => {
    const q = new URL(r.request().url()).searchParams, id = q.get('id') as keyof typeof decks | null
    if (r.request().method() === 'PUT') return r.fulfill({ json: { ok: true, rev: 9 } })
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.has('events') || q.has('versions') || q.has('comments')) return r.fulfill({ json: [] })
    if (id) { await new Promise((done) => setTimeout(done, SLOW)); return r.fulfill({ json: decks[id] }) }
    return r.fulfill({ json: Object.values(decks).map((d) => ({ id: d.id, name: d.name, updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: null })) })
  })
}

/** Every page name the header shows, frame by frame and change by change, from now on ('' for a header with none, or none at all). */
const watch = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { seen: string[] }
  w.seen = []
  const look = () => {
    const nav = document.querySelector('header nav[aria-label="Breadcrumb"]')
    const name = nav?.querySelector('button[title="Rename"], :scope > span.truncate')?.textContent ?? ''
    if (w.seen.at(-1) !== name) w.seen.push(name)
  }
  new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true })
  const frame = () => { look(); requestAnimationFrame(frame) }
  frame()
})
const seen = (page: Page) => page.evaluate(() => (window as unknown as { seen: string[] }).seen)
const go = async (page: Page, row: string, name: string) => {
  await watch(page)
  await page.getByRole('navigation', { name: 'Workspace' }).locator(`[data-row="${row}"]`).click()
  await expect.poll(() => seen(page)).toContain(name)
  await page.waitForTimeout(SLOW + 200)
  return seen(page)
}

test('decks and docs switch straight from one to the other', async ({ page }) => {
  await serve(page)
  await page.goto('/d/d1')
  await expect(page.locator('header nav button[title="Rename"]')).toHaveText('Market sizing')
  await page.waitForTimeout(500) // the doc screen loads while the browser is idle
  expect(await go(page, 'deck:d2', 'Board update')).toEqual(['Market sizing', 'Board update'])
  expect(await go(page, 'doc:doc_a', 'Alpha plan')).toEqual(['Board update', 'Alpha plan'])
  // The deck held behind the doc is Board update; Pricing has never been read.
  expect(await go(page, 'deck:d3', 'Pricing')).toEqual(['Alpha plan', 'Pricing'])
  await expect(page).toHaveURL(/\/d\/d3$/)
  expect(await go(page, 'doc:doc_a', 'Alpha plan')).toEqual(['Pricing', 'Alpha plan'])
  expect(await go(page, 'deck:d3', 'Pricing')).toEqual(['Alpha plan', 'Pricing'])
})
