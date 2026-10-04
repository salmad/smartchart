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
  // Present has no counter of its own (the slide's page number is enough): the slide shown is the one clicked.
  await expect(page.locator('div.fixed.inset-0 .slide .rail .pg b')).toHaveText('02')
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

test('Download PDF prints the deck, one slide per page, under the deck’s name', async ({ page }) => {
  await page.route('**/api/share?s=tok_1', (r) => r.fulfill({ json: shared }))
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printedAs: string }).printedAs = document.title } })
  await page.goto('/s/tok_1')
  await page.getByRole('button', { name: 'PDF' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { printedAs?: string }).printedAs)).toBe('Acme board update')
  const pages = page.locator('.print-deck .print-slide')
  await expect(pages).toHaveCount(slides.length)
  expect(await pages.first().locator('.slide').evaluate((el) => getComputedStyle(el).getPropertyValue('--s'))).toBe('1')
  // The real thing: Chromium's PDF from the print styles has one page per slide.
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1')
  expect(pdf.match(/\/Type\s*\/Page\b/g)?.length).toBe(slides.length)
  // After printing the deck leaves the page, and the title is the page's again.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(pages).toHaveCount(0)
  await expect(page).toHaveTitle('Acme board update · Occam')
})
