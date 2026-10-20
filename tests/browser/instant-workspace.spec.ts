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
