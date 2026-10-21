/* Switching docs with the server slow to answer: the name and the bar stay on screen, and a doc read before opens at once. */
import { test, expect } from '@playwright/test'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const text = (title: string) => ['---', `title: ${title}`, '---', '', '## Plan {#plan}', '', 'First paragraph here.', ''].join('\n')
const docs = { doc_a: 'Alpha plan', doc_b: 'Beta memo' }
const SLOW = 400

test('switching docs keeps the name and the bar on screen, and a doc read before opens before the server answers', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/decks**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/pages**', (r) => r.fulfill({ json: Object.entries(docs).map(([id, name]) => ({ kind: 'doc', id, name, updated: 100, slides: null, parent: null, sortKey: null })) }))
  await page.route('**/api/docs**', async (r) => {
    const q = new URL(r.request().url()).searchParams, id = q.get('id') as keyof typeof docs | null
    if (!id) return r.fulfill({ json: [] })
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {}, role: 'owner' } })
    if (q.has('comments') || q.has('versions')) return r.fulfill({ json: [] })
    await new Promise((done) => setTimeout(done, SLOW))
    return r.fulfill({ json: { id, name: docs[id], text: text(docs[id]), updated: 100, rev: 1, workspaceId: 'w1' } })
  })
  const bar = page.getByRole('navigation', { name: 'Workspace' }), title = page.locator('.doc-title')
  await page.goto('/doc/doc_a')
  await expect(title).toHaveText('Alpha plan')
  // From here, the Versions button leaving or the name going blank, even for one frame, is a blink. The records are read,
  // not the DOM when the observer runs: by then React may have put back what it took away.
  await page.evaluate(() => {
    const w = window as unknown as { blinks: string[] }, header = document.querySelector('header') as HTMLElement
    const name = header.querySelector('nav[aria-label="Breadcrumb"] > span.truncate'), versions = 'button[aria-label="Versions"]'
    w.blinks = []
    new MutationObserver((records) => records.forEach((r) => {
      if ([...r.removedNodes].some((n) => n instanceof Element && (n.matches(versions) || n.querySelector(versions)))) w.blinks.push('bar')
      if ((r.target === name || r.target.parentNode === name) && !name?.textContent) w.blinks.push('name')
    })).observe(header, { subtree: true, childList: true, characterData: true })
  })
  await bar.getByRole('treeitem', { name: /^Beta memo/ }).click()
  await expect(page.locator('header nav[aria-label="Breadcrumb"]')).toContainText('Beta memo', { timeout: SLOW / 2 })
  await expect(title).toHaveText('Beta memo')
  // Alpha was read before: it is on screen well before the server's answer could be.
  await bar.getByRole('treeitem', { name: /^Alpha plan/ }).click()
  await expect(title).toHaveText('Alpha plan', { timeout: SLOW / 2 })
  expect(await page.evaluate(() => (window as unknown as { blinks: string[] }).blinks)).toEqual([])
})
