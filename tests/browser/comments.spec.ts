/* Comments: Comment sits beside Edit; the panel holds notes on the whole slide and on a part picked on the slide. All saved with the deck. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const deck = { id: 'cm', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1000, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title: 'Market' }, status: 'ok', errors: [], warnings: [], checks: [] }] }
type Saved = { text: string; path?: string; quote?: string; done?: { by: string } }
const saved = (page: Page) => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{}').decks?.cm?.comments ?? []) as Saved[], KEY)
const seed = (page: Page) => page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify({ active: 'cm', decks: { cm: deck } })] as const)

test('Comment sits beside Edit: leave a note on the slide, see it counted, resolve it, delete it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/cm')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Comments on slide 1' })
  await expect(panel).toContainText('No comments yet')
  await panel.getByRole('textbox', { name: 'New comment' }).fill('This number is from Q2, update it')
  await panel.getByRole('textbox', { name: 'New comment' }).press('Enter')
  await expect(panel).toContainText('This number is from Q2, update it')
  await expect(page.getByRole('button', { name: 'Comment, 1 open' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Slides' }).getByLabel('1 open comment')).toBeVisible()
  await expect.poll(async () => (await saved(page)).map((c) => [c.text, c.path])).toEqual([['This number is from Q2, update it', undefined]])

  await panel.getByRole('button', { name: 'Resolve' }).click()
  await expect(panel).toContainText('1 resolved')
  await expect.poll(async () => (await saved(page))[0]?.done?.by).toBe('Dev')
  await panel.getByRole('button', { name: /1 resolved/ }).click()
  await panel.getByRole('button', { name: 'Delete' }).click()
  await expect.poll(async () => (await saved(page)).length).toBe(0)
})

test('click a part of the slide to comment on it; C opens the panel; Esc goes back to the whole slide', async ({ page }) => {
  await seed(page)
  await page.goto('/d/cm')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('c')
  const panel = page.getByRole('complementary', { name: 'Comments on slide 1' })
  await expect(panel).toContainText('Whole slide')
  await page.locator('[data-tour="stage"] .title').click()
  await expect(panel).toContainText('Title')
  const box = panel.getByRole('textbox', { name: 'New comment' })
  await box.fill('Make it a claim')
  await box.press('Enter')
  await expect(panel.getByRole('listitem')).toContainText('Title')
  await expect.poll(async () => (await saved(page)).map((c) => [c.text, c.path, c.quote])).toEqual([['Make it a claim', 'title', 'Market']])
  // Picking never presents the slide.
  await expect(page.locator('[data-tour="stage"] .slide')).toBeVisible()
  await page.locator('[data-tour="stage"] .title').click()
  await box.press('Escape')
  await expect(panel).toContainText('Whole slide')
})
