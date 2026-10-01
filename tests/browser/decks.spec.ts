/* The decks sidebar keeps its order while you move between decks: only an edit moves a deck to the top. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = (id: string, title: string, updated: number) => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }] })
const store = { active: 'a', decks: { a: deck('a', 'Alpha', 3000), b: deck('b', 'Beta', 2000), c: deck('c', 'Gamma', 1000) } }

test('opening decks from the sidebar does not reorder them; an edit moves the edited one to the top', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify(store)] as const)
  const sidebar = page.getByRole('navigation', { name: 'Your decks' })
  const order = () => sidebar.getByRole('listitem').locator('button[aria-current], button:not([aria-label])').allInnerTexts()
  await page.goto('/d/a')
  await expect(sidebar.getByRole('listitem')).toHaveCount(3)
  // Picked at once, while the app may still be starting: the pick must still open the deck.
  await sidebar.getByText('Gamma').click()
  await expect(page).toHaveURL(/\/d\/c$/)
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title)).toBe('Gamma')
  await sidebar.getByText('Beta').click()
  await expect(page).toHaveURL(/\/d\/b$/)
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title)).toBe('Beta')
  await page.waitForTimeout(600) // longer than the save pause
  expect((await order()).map((t) => t.split('\n')[0])).toEqual(['Alpha', 'Beta', 'Gamma'])
  expect(await page.evaluate((k) => Object.values(JSON.parse(localStorage.getItem(k) ?? '{}').decks).map((d) => (d as { updated: number }).updated), KEY)).toEqual([3000, 2000, 1000])

  // An edit (the palette) is a real change: Beta saves and moves up.
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Look' }).click()
  await page.getByRole('group', { name: 'Palette' }).getByRole('button', { name: 'Paper' }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await sidebar.getByText('Alpha').click()
  await expect(page).toHaveURL(/\/d\/a$/)
  await expect.poll(async () => (await order()).map((t) => t.split('\n')[0])).toEqual(['Beta', 'Alpha', 'Gamma'])
})
