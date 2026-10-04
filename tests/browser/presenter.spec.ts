/* The presenter view: P while presenting opens it; it shows the slide, the next one and the speaker notes, and its arrow
   keys move the presentation. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }

const slides = (starters as { consulting?: Record<string, unknown> }[]).map((s) => s.consulting).filter(Boolean).slice(0, 3)
  .map((s, i) => (i === 0 ? { ...s, talk: 'Open on the problem: founders fund the business on their own cards.\nThen hand over to the numbers.' } : s))
const shared = { name: 'Acme board update', style: 'consulting', theme: 'ink', accent: null, slides }

test('the presenter view follows the presentation, shows the talk, and drives it', async ({ page, context }) => {
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  await page.goto('/s/tok_1')
  await page.getByRole('button', { name: 'Present from slide 1' }).click()
  const presenterOpened = context.waitForEvent('page')
  await page.keyboard.press('p')
  const presenter = await presenterOpened
  await presenter.waitForLoadState()
  await expect(presenter.getByText('Slide 1')).toBeVisible()
  await expect(presenter.getByLabel('Speaker notes')).toContainText('Open on the problem')
  await expect(presenter.getByLabel('Speaker notes').locator('p')).toHaveCount(2)
  await presenter.keyboard.press('ArrowRight')
  await expect(page.locator('div.fixed.inset-0 .slide .rail .pg b')).toHaveText('02')
  await expect(presenter.getByText('Slide 2')).toBeVisible()
  await expect(presenter.getByLabel('Speaker notes')).toContainText('No speaker notes on this slide')
  await page.keyboard.press('ArrowRight')
  await expect(presenter.getByText('End of the deck')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(presenter.getByText('The presentation has ended.')).toBeVisible()
})
