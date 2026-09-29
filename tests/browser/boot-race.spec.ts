/* A pick made while the app is still starting must not overwrite the decks already saved. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const KEY = 'smartchart.journey.decks.v1'
const saved = { active: 'd_old', decks: { d_old: { id: 'd_old', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [{ id: 'a', slide: { template: 'cover', title: 'Old deck', subtitle: 'Saved before.' }, status: 'ok', errors: [], warnings: [], checks: [] }] } } }

test('a tile picked before boot finishes keeps the saved decks', async ({ page }) => {
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1') } }, [KEY, JSON.stringify(saved)] as const)
  let release: () => void = () => {}
  const held = new Promise<void>((ok) => { release = ok })
  await page.route('**/api/health', async (r) => { await held; await r.fulfill({ json: { ok: true, live: false } }) })
  await page.goto('/new')
  await page.locator('[data-starter="table"]').dblclick()
  await page.waitForTimeout(600) // longer than the save debounce
  release()
  await page.waitForTimeout(600)
  const ids = await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k) ?? '{}').decks ?? {}), KEY)
  expect(ids).toContain('d_old')
  expect(ids).toHaveLength(2)
})
