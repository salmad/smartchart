/* A repeat visit to the editor shows its frame from the first paint, before any script has run; everyone else does not,
   and a page whose files are gone loads again once rather than staying blank. */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: null }
const ws = [{ id: 'w1', name: 'Northwind team', role: 'owner', personal: false, members: 3, usedAt: 1 }]
const row = { id: 'd1', name: 'Market sizing', named: false, updated: 100, rev: 1, role: 'owner',
  data: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 100, items: [{ id: 's1', slide: { template: 'section', title: 'Market sizing' }, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }] }, chat: null }

async function app(page: Page, opts: { cached: boolean }, deck: unknown = row) {
  if (opts.cached) await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: opts.cached ? { user, session: {} } : null }))
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  await page.route('**/api/workspaces', (r) => r.fulfill({ json: ws }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/decks**', (r) => {
    const q = new URL(r.request().url()).searchParams
    if (q.has('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.has('events') || q.has('versions')) return r.fulfill({ json: [] })
    return r.fulfill({ json: q.has('id') ? deck : [{ id: 'd1', name: 'Market sizing', updated: 100, slides: 1, style: 'consulting', theme: 'ink', accent: null }] })
  })
}
/** The page's script held back, so what shows is what the HTML alone paints. */
const holdScript = (page: Page) => page.route('**/src/main.tsx', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue() })

test('a repeat visit shows the editor’s frame before the app has loaded, then the deck replaces it', async ({ page }) => {
  await app(page, { cached: true })
  await holdScript(page)
  await page.goto('/d/d1', { waitUntil: 'commit' })
  const frame = page.locator('#boot')
  await expect(frame).toBeVisible()
  expect(await frame.locator('.bar').evaluate((el) => el.getBoundingClientRect().height)).toBe(56)
  expect(await page.evaluate(() => document.querySelectorAll('[data-strip-thumb]').length)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 15000 }).toBe('Market sizing')
  await expect(frame).toHaveCount(0)
})

test('the frame follows the panels the maker left open', async ({ page }) => {
  await app(page, { cached: true })
  await page.addInitScript(() => { localStorage.setItem('smartchart.decksOpen', '0'); localStorage.setItem('smartchart.chatOpen', '0') })
  await holdScript(page)
  await page.goto('/d/d1', { waitUntil: 'commit' })
  await expect(page.locator('#boot')).toBeVisible()
  await expect(page.locator('#boot .decks')).toBeHidden()
  await expect(page.locator('#boot .chat')).toBeHidden()
})

test('a first visit, and the public site, get no frame', async ({ page }) => {
  await app(page, { cached: false })
  await holdScript(page)
  await page.goto('/d/d1', { waitUntil: 'commit' })
  await expect(page.locator('#boot')).toBeHidden()
})

test('the public site gets no frame even for a signed-in browser', async ({ page }) => {
  await app(page, { cached: true })
  await holdScript(page)
  await page.goto('/home', { waitUntil: 'commit' })
  await expect(page.locator('#boot')).toBeHidden()
})

test('a page whose files were removed by a newer deploy loads again once, and only once', async ({ page }) => {
  const html = readFileSync('index.html', 'utf8')
  const guard = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  expect(guard).toContain('reloaded-for-assets')
  let loads = 0
  await page.route('**/guard-test', (r) => { loads += 1; return r.fulfill({ contentType: 'text/html', body: `<!doctype html><script>${guard}</script><script src="/assets/gone-abc123.js"></script>` }) })
  await page.route('**/assets/gone-abc123.js', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto('/guard-test')
  await page.waitForTimeout(2000)
  expect(loads).toBe(2)
})

test('the open slide draws with the first few thumbnails, and the rest follow', async ({ page }) => {
  const many = { ...row, data: { ...row.data, items: Array.from({ length: 14 }, (_, k) => ({ id: `s${k}`, slide: { template: 'section', title: `Slide ${k}` }, status: 'ok', errors: [], warnings: [], checks: [] })) } }
  await page.addInitScript(() => {
    const w = window as unknown as { __atStage: number | null }
    w.__atStage = null
    new MutationObserver(() => {
      if (w.__atStage === null && document.querySelector('[data-frame] .slide')) w.__atStage = document.querySelectorAll('[data-strip-thumb] .slide').length
    }).observe(document, { childList: true, subtree: true })
  })
  await app(page, { cached: true }, many)
  await page.goto('/d/d1')
  await expect(page.locator('[data-strip-thumb] .slide')).toHaveCount(14, { timeout: 15000 })
  const atStage = await page.evaluate(() => (window as unknown as { __atStage: number | null }).__atStage)
  expect(atStage).not.toBeNull()
  expect(atStage as number).toBeLessThan(14)
})
