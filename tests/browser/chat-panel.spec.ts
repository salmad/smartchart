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
  await page.getByRole('button', { name: 'Show the chat' }).click()
  await expect(chat).toBeVisible()
  await expect(chat.getByRole('textbox')).toHaveValue('Make the title shorter')
  await page.getByRole('button', { name: 'Hide the chat' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show the chat' })).toBeVisible()
  await expect(chat).toBeHidden()
})
