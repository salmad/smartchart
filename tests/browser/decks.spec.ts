/* The sidebar keeps its order while you move between pages, and while you edit one: the order is the user's (page tree spec, section 3). */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = (id: string, title: string, updated: number) => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }] })
const store = { active: 'a', decks: { a: deck('a', 'Alpha', 3000), b: deck('b', 'Beta', 2000), c: deck('c', 'Gamma', 1000) } }

test('opening decks from the sidebar does not reorder them, and neither does an edit', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify(store)] as const)
  const sidebar = page.getByRole('navigation', { name: 'Workspace' }).getByRole('tree', { name: 'Pages' })
  const order = () => sidebar.getByRole('treeitem').allInnerTexts()
  await page.goto('/d/a')
  await expect(sidebar.getByRole('treeitem')).toHaveCount(3)
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

  // An edit (the palette) is a real change: Beta saves, and stays where it is.
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByRole('group', { name: 'Palette' }).getByRole('button', { name: 'Paper' }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').decks.b.updated, KEY)).toBeGreaterThan(2000)
  await sidebar.getByText('Alpha').click()
  await expect(page).toHaveURL(/\/d\/a$/)
  await expect.poll(async () => (await order()).map((t) => t.split('\n')[0])).toEqual(['Alpha', 'Beta', 'Gamma'])
})
