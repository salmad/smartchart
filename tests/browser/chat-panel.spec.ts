/* The chat is a panel the maker can hide (⌘L or its toggle in the bar), as in Cursor: hidden, not dropped. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const deck = { id: 'd_c', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [{ id: 's_0', slide: { template: 'cover', title: 'Acme', subtitle: 'Board update.' }, status: 'ok', errors: [], warnings: [], checks: [] }] }

test('the chat hides and comes back with ⌘L or its toggle, keeping a half-written message, and stays as left', async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify({ active: 'd_c', decks: { d_c: d } })); sessionStorage.setItem('seeded', '1') } }, deck)
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.goto('/d/d_c')
  const chat = page.getByRole('complementary', { name: 'Chat' })
  await chat.getByRole('textbox').fill('Make the title shorter')
  await page.locator('[title="Present (F)"]').hover()
  await page.keyboard.press('ControlOrMeta+l')
  await expect(chat).toBeHidden()
  await page.getByRole('button', { name: 'Show the agent' }).click()
  await expect(chat).toBeVisible()
  await expect(chat.getByRole('textbox')).toHaveValue('Make the title shorter')
  await page.getByRole('button', { name: 'Hide the agent' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show the agent' })).toBeVisible()
  await expect(chat).toBeHidden()
})

test('the chat shows a dismissible tip that MCP is best and chat is for quick tests', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('smartchart.chatModelTip.dismissed') })
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded-tip')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify({ active: 'd_c', decks: { d_c: d } })); sessionStorage.setItem('seeded-tip', '1') } }, deck)
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.goto('/d/d_c')
  const chat = page.getByRole('complementary', { name: 'Chat' })
  const tip = chat.getByRole('status')
  await expect(tip).toContainText('strong model over MCP')
  await expect(tip).toContainText('quick tests')
  await tip.getByRole('button', { name: 'Dismiss' }).click()
  await expect(tip).toBeHidden()
  await page.reload()
  await expect(chat.getByRole('status')).toBeHidden()
})
