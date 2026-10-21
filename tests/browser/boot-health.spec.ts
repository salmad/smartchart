/* The deck does not wait on the health check: it opens at once, and the composer wakes when the answer comes. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const saved = { active: 'd_old', decks: { d_old: { id: 'd_old', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [{ id: 'a', slide: { template: 'cover', title: 'Old deck', subtitle: 'Saved before.' }, status: 'ok', errors: [], warnings: [], checks: [] }] } } }
const seed = ([k, v]: readonly [string, string]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }

test('the saved deck opens before a slow health answer, and the composer enables when it arrives', async ({ page }) => {
  await page.addInitScript(seed, [KEY, JSON.stringify(saved)] as const)
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  await page.route('**/api/health', async (r) => { await held; await r.fulfill({ json: { ok: true, live: true } }) })
  await page.goto('/d/d_old')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title), { timeout: 20000 }).toBe('Old deck')
  // Nothing says "Offline" before the answer is in; the composer just waits.
  await expect(page.getByText('Offline')).toHaveCount(0)
  await expect(page.locator('textarea')).toBeDisabled()
  release()
  await expect(page.locator('textarea')).toBeEnabled()
})

test('a prompt typed on the site still waits for the health answer before it is sent', async ({ page }) => {
  const sent: string[] = []
  await page.addInitScript(() => sessionStorage.setItem('smartchart.pendingPrompt', JSON.stringify({ text: 'Make the market slide', style: 'consulting' })))
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  await page.route('**/api/health', async (r) => { await held; await r.fulfill({ json: { ok: true, live: true } }) })
  await page.route('**/api/jev', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/glm', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.goto('/new')
  await page.locator('textarea').waitFor()
  await page.waitForTimeout(800)
  expect(sent).toEqual([])
  release()
  await expect.poll(() => sent.join(' ')).toContain('Make the market slide')
})
