/* The avatar shows the initial at once; the picture fades in only after it has loaded, and a broken one never shows. */
import { test, expect, type Page } from '@playwright/test'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const user = { id: 'u1', email: 'ada@example.com', name: 'Ada', image: 'http://localhost:5199/avatar-test.png' }

async function open(page: Page, avatar: (r: import('@playwright/test').Route) => Promise<void>) {
  await page.addInitScript((u) => localStorage.setItem('occam.account.v1', JSON.stringify(u)), user)
  await page.route('**/api/auth/get-session', (r) => r.fulfill({ json: { user, session: {} } }))
  await page.route('**/avatar-test.png', avatar)
  await page.goto('/new')
}

test('the initial shows at once and the picture fades in after it loads', async ({ page }) => {
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  await open(page, async (r) => { await held; await r.fulfill({ body: PNG, contentType: 'image/png' }) })
  const trigger = page.locator('[data-tour="account"]')
  await expect(trigger).toContainText('A')
  await expect(trigger.locator('img')).toHaveCount(0)
  release()
  await expect(trigger.locator('img')).toBeVisible()
})

test('a picture that fails leaves only the initial', async ({ page }) => {
  await open(page, (r) => r.fulfill({ status: 404 }))
  const trigger = page.locator('[data-tour="account"]')
  await expect(trigger).toContainText('A')
  await page.waitForTimeout(500)
  await expect(trigger.locator('img')).toHaveCount(0)
})
