/* Add slide inside a pitch deck with a custom accent (Review Focus 4): the deck's look, insert after current. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const pitchDeck = { active: 'd1', decks: { d1: { id: 'd1', style: 'pitch', theme: 'paper', accent: '#2447D1', current: 0, updated: 1, history: [], working: [], messages: [],
  items: [
    { id: 'a', slide: { template: 'cover', title: 'Acme', subtitle: 'A test deck.' }, status: 'ok', errors: [], warnings: [], checks: [] },
    { id: 'b', slide: { template: 'section', title: 'The plan' }, status: 'ok', errors: [], warnings: [], checks: [] } ] } } }
test.beforeEach(async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, pitchDeck)
})

test('Add slide shows starters in the deck style and inserts after the current slide', async ({ page }) => {
  await page.goto('/d/d1')
  await page.locator('[data-strip-thumb]').first().click()          // current = cover
  await page.getByRole('button', { name: 'Add a slide' }).click()
  // Nothing is picked until the user picks: no preview, and the add button waits.
  await expect(page.locator('[data-featured]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add as slide 2' })).toBeDisabled()
  await page.getByRole('tab', { name: 'Open the deck' }).click()
  await page.locator('[data-starter="section"]').click()
  await expect(page.locator('[data-featured] .slide.style-pitch.theme-paper')).toBeVisible()
  await page.getByRole('button', { name: 'Add as slide 2' }).click()
  const titles = await page.evaluate(() => window.__journey?.items.map((i) => i.slide.template))
  expect(titles).toEqual(['cover', 'section', 'section'])
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(3)
  await page.waitForTimeout(400) // the save is debounced
  await page.reload()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(3)
})
test('Esc leaves Add slide without changes', async ({ page }) => {
  await page.goto('/d/d1')
  await page.getByRole('button', { name: 'Add a slide' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-add-preview]')).toHaveCount(0)
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
})
test('the + tile at the end of the strip opens Add slide', async ({ page }) => {
  await page.goto('/d/d1')
  await page.getByRole('button', { name: 'Add a slide' }).click()
  await expect(page.locator('[data-add-preview]')).toBeVisible()
})
test('a double click on a starter adds it at once', async ({ page }) => {
  await page.goto('/d/d1')
  await page.getByRole('button', { name: 'Add a slide' }).click()
  await page.locator('[data-starter="section"]').dblclick()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(3)
})
test('a slide can be deleted from its menu and brought back with Undo', async ({ page }) => {
  await page.goto('/d/d1')
  await page.locator('[data-strip-item]').first().hover()
  await page.getByRole('button', { name: 'Slide 1 options' }).click()
  await page.getByRole('menuitem', { name: /Delete slide/ }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(2)
  expect(await page.evaluate(() => window.__journey?.items.map((i) => i.id))).toEqual(['a', 'b'])
})
test('a slide can be dragged to a new place', async ({ page }) => {
  await page.goto('/d/d1')
  await page.locator('[data-strip-item]').first().dragTo(page.locator('[data-strip-item]').nth(1), { targetPosition: { x: 100, y: 30 } })
  expect(await page.evaluate(() => window.__journey?.items.map((i) => i.id))).toEqual(['b', 'a'])
})
