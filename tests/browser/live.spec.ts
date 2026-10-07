import { expect, test } from '@playwright/test'

test('the account menu makes agent keys, shows each command once, and lists them', async ({ page }) => {
  let n = 0
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/keys', (r) => r.request().method() === 'POST' ? r.fulfill({ json: { key: `sc_key${++n}abcdefghijklmnopqrstuvwxyz`, id: `id${n}`, prefix: `sc_key${n}` } }) : r.fulfill({ json: { keys: [], max: 5 } }))
  await page.route('**/api/decks**', (r) => r.fulfill({ json: [] }))
  await page.goto('/')
  await page.getByRole('button', { name: /Ann/ }).click()
  await page.getByRole('menuitem', { name: 'Connect an agent' }).click()
  await page.getByRole('button', { name: 'Make a key' }).click()
  await expect(page.getByText(/claude mcp add --transport http smartchart .*\/mcp\/v1 --header "Authorization: Bearer sc_key1/)).toBeVisible()
  await expect(page.getByText('You won’t see this key again.')).toBeVisible()
  await expect(page.getByText(/curl -fsSL .*\/agents\/occam\/SKILL\.md/)).toBeVisible()
  await page.getByRole('tab', { name: 'Cursor' }).click()
  await expect(page.getByRole('link', { name: 'Add to Cursor' })).toHaveAttribute('href', /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=occam&config=/)
  await page.getByRole('tab', { name: 'Claude Desktop' }).click()
  await expect(page.getByText(/"mcp-remote"/)).toBeVisible()
  await page.getByRole('button', { name: 'Make another key' }).click()
  await expect(page.getByText(/Bearer sc_key2/)).toBeVisible()
})
