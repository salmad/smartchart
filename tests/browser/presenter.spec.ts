/* The presenter view: P while presenting opens it; it shows the slide, the next one and the speaker notes, and its arrow
   keys move the presentation. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }

const slides = (starters as { consulting?: Record<string, unknown> }[]).map((s) => s.consulting).filter(Boolean).slice(0, 3)
  .map((s, i) => (i === 0 ? { ...s, talk: 'Open on the problem: founders fund the business on their own cards.\nThen hand over to the numbers.' } : s))
const shared = { name: 'Acme board update', style: 'consulting', theme: 'ink', accent: null, slides }

test('the presentation and the presenter view are independent tabs on one deck', async ({ page, context }) => {
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  await page.goto('/s/tok_1')
  const showOpened = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Present from slide 1' }).click()
  const show = await showOpened
  await expect(show.locator('.slide')).toBeVisible()
  const presenterOpened = context.waitForEvent('page')
  await show.keyboard.press('p')
  const presenter = await presenterOpened
  await presenter.waitForLoadState()
  await expect(presenter.getByText('Slide 1')).toBeVisible()
  await expect(presenter.getByLabel('Speaker notes')).toContainText('Open on the problem')
  await expect(presenter.getByLabel('Speaker notes').locator('p')).toHaveCount(2)
  await presenter.keyboard.press('ArrowRight')
  await expect(show.locator('.slide .rail .pg b')).toHaveText('02')
  await expect(presenter.getByText('Slide 2')).toBeVisible()
  await expect(presenter.getByLabel('Speaker notes')).toContainText('No speaker notes on this slide')
  await show.keyboard.press('ArrowRight')
  await expect(presenter.getByText('End of the deck')).toBeVisible()
  // Closing the presentation leaves the presenter view working, and it still moves the slide.
  await show.close()
  await presenter.keyboard.press('ArrowLeft')
  await expect(presenter.getByText('Slide 2')).toBeVisible()
  await expect(presenter.getByText('has ended')).toHaveCount(0)
})

test('the presentation draws disappearing ink while the button is held, and a click still turns the slide', async ({ page, context }) => {
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  await page.goto('/s/tok_1')
  const opened = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Present from slide 1' }).click()
  const show = await opened
  await expect(show.locator('.slide')).toBeVisible()
  const lit = () => show.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? []
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
    return false
  })
  const w = show.viewportSize()?.width ?? 1280
  await show.mouse.move(w * 0.3, 200)
  await show.mouse.down()
  await show.mouse.move(w * 0.4, 260, { steps: 6 })
  await expect.poll(lit).toBe(true)
  await show.mouse.up()
  await expect(show).toHaveURL(/#\/1$/)
  await expect.poll(lit, { timeout: 5000 }).toBe(false)
  await show.mouse.click(w * 0.8, 300)
  await expect(show.locator('.slide .rail .pg b')).toHaveText('02')
})

test.describe('speaker notes in edit mode', () => {
  test.beforeEach(async ({ page }) => {
    const deck = { active: 'd1', decks: { d1: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
      items: [{ id: 'a', slide: slides[1], status: 'ok', errors: [], warnings: [], checks: [] }] } } }
    await page.addInitScript((d) => { localStorage.setItem('smartchart.devAccount', '1'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, deck)
  })
  test('are typed under the slide, saved with it, and never drawn on it', async ({ page }) => {
    await page.goto('/d/d1')
    await page.waitForFunction(() => window.__journey?.items.length)
    await page.keyboard.press('e')
    await page.getByRole('button', { name: 'Add speaker notes' }).click()
    await page.getByPlaceholder(/What you say over this slide/).fill('Start with the founder who paid payroll on a personal card.')
    await page.getByRole('button', { name: 'Save' }).click()
    expect(await page.evaluate(() => (window.__journey?.items[0].slide as { talk?: string }).talk)).toBe('Start with the founder who paid payroll on a personal card.')
    await expect(page.locator('.slide').filter({ hasText: 'payroll on a personal card' })).toHaveCount(0)
  })
})
