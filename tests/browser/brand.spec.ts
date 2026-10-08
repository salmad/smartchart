/* Colours from your website, in the Look panel: a domain in, the site's brand colours out; the one picked becomes the
   deck's accent. */
import { test, expect } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json' with { type: 'json' }
import { signInAsDev } from './dev-account'

signInAsDev()
const slide = (starters as { id: string; consulting: Record<string, unknown> }[]).find((s) => s.id === 'chart-notes')?.consulting
const deck = { id: 'd_b', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [], items: [{ id: 's_0', slide, status: 'ok', errors: [], warnings: [], checks: [] }] }

test('the site’s colours are offered with where they come from; the one picked is the accent', async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify({ active: 'd_b', decks: { d_b: d } })); sessionStorage.setItem('seeded', '1') } }, deck)
  let asked = ''
  await page.route('**/api/brand', (r) => { asked = r.request().postData() ?? ''; return r.fulfill({ json: { colours: [{ hex: '#FF4F40', from: "monzo.com's logo" }, { hex: '#7C5CFF', from: 'used across monzo.com' }] } }) })
  await page.goto('/d/d_b')
  await page.waitForFunction(() => window.__journey?.items.length)
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByLabel('Your website').fill('monzo.com')
  await page.getByLabel('Your website').press('Enter')
  const list = page.getByRole('list', { name: 'Colours from the website' })
  await expect(list).toContainText('used across monzo.com')
  expect(JSON.parse(asked)).toEqual({ domain: 'monzo.com' })
  // A colour the slides would refuse (Monzo's coral is too close to the loss red) says so and cannot be picked.
  await expect(list.getByRole('button', { name: /#FF4F40/ })).toBeDisabled()
  await expect(list).toContainText('too close to')
  await list.getByRole('button', { name: /#7C5CFF/ }).click()
  await expect(list.getByRole('button', { name: /#7C5CFF/ })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{}') as { decks?: Record<string, { accent?: string }> }).decks?.d_b?.accent)).toBe('#7C5CFF')
})
