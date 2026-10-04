/* Comments under the slide: leave one, see it counted on the strip, resolve it, delete it. All saved with the deck. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = { id: 'cm', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1000, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title: 'Market' }, status: 'ok', errors: [], warnings: [], checks: [] }] }
const saved = (page: Page) => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{}').decks?.cm?.comments ?? []) as { text: string; done?: { by: string } }[], KEY)

test('leave a comment, see it on the strip, resolve it, delete it', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify({ active: 'cm', decks: { cm: deck } })] as const)
  await page.goto('/d/cm')
  await page.getByRole('button', { name: 'Comments' }).click()
  const pop = page.getByRole('dialog', { name: 'Comments on slide 1' })
  await pop.getByRole('textbox', { name: 'New comment' }).fill('This number is from Q2, update it')
  await pop.getByRole('textbox', { name: 'New comment' }).press('Enter')
  await expect(pop).toContainText('This number is from Q2, update it')
  await expect(page.getByRole('button', { name: '1 open comment' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Slides' }).getByLabel('1 open comment')).toBeVisible()
  await expect.poll(async () => (await saved(page)).map((c) => c.text)).toEqual(['This number is from Q2, update it'])

  await pop.getByRole('button', { name: 'Resolve' }).click()
  await expect(pop).toContainText('1 resolved')
  await expect.poll(async () => (await saved(page))[0]?.done?.by).toBe('Dev')
  await pop.getByRole('button', { name: /1 resolved/ }).click()
  await pop.getByRole('button', { name: 'Delete' }).click()
  await expect.poll(async () => (await saved(page)).length).toBe(0)
})
