/* A deck shared by link: anyone can read it, signed in or not, and present it; a link that is off says so. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }

const slides = (starters as { consulting?: unknown }[]).map((s) => s.consulting).filter(Boolean).slice(0, 3)
const shared = { name: 'Acme board update', style: 'consulting', theme: 'ink', accent: null, slides }

test('a shared deck opens for a signed-out visitor, every slide in order, and presents from the slide clicked', async ({ page }) => {
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/s/tok_1')
  await expect(page.getByRole('heading', { name: 'Acme board update' })).toBeVisible()
  await expect(page).toHaveTitle('Acme board update · Occam')
  const frames = page.getByRole('button', { name: /^Present from slide/ })
  await expect(frames).toHaveCount(slides.length)
  await expect(frames.first().locator('.slide')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await frames.nth(1).click()
  await expect(page.getByText(`2 / ${slides.length}`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(frames).toHaveCount(slides.length)
  expect(errors).toEqual([])
})

test('a link that is off says so', async ({ page }) => {
  await page.route('**/api/share?s=gone', (r) => r.fulfill({ status: 404, json: { error: 'off' } }))
  await page.goto('/s/gone')
  await expect(page.getByText('This link is off.')).toBeVisible()
})

test('the shared deck reads on a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  await page.goto('/s/tok_1')
  await expect(page.getByRole('button', { name: /^Present from slide/ }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
