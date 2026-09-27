/* The public site and Your decks: real slides with no fit issues, the before/after by keyboard, the prompt
   opening the editor, and the decks list against a mocked account. */
import { test, expect, type Page } from '@playwright/test'

async function site(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Charts that look designed.' })).toBeVisible()
}

for (const width of [1440, 390]) {
  test(`the site at ${width}px: every slide fits and nothing scrolls sideways`, async ({ page }) => {
    await site(page, width)
    await page.evaluate(() => document.fonts.ready)
    const slides = page.locator('.site .slide')
    expect(await slides.count()).toBeGreaterThanOrEqual(12)
    const overflow = await page.locator('.site').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBe(0)
  })
}

test('the before/after divider moves with the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await site(page, 1440)
  const slider = page.getByRole('slider', { name: /Compare/ })
  await expect(slider).toHaveAttribute('aria-valuenow', '50')
  await slider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(slider).toHaveAttribute('aria-valuenow', '45')
  await page.keyboard.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
})

test('a prompt on the site opens the editor and keeps the style picked there', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: false } }))
  await site(page, 1440)
  await page.getByRole('button', { name: 'Pitch' }).first().click()
  await page.getByLabel('Describe your slide').first().fill('Revenue grew from £2.1m to £5.4m')
  await page.locator('#hero-prompt').getByRole('button', { name: 'Make a slide' }).click()
  await expect(page).toHaveURL(/\/new$/)
  await expect(page.getByRole('group', { name: 'Deck style' })).toBeVisible()
})

test('Sign in opens the sign-in dialog, which explains when accounts are not set up', async ({ page }) => {
  await site(page, 1440)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('dialog')).toContainText('Continue with Google')
})

test('signed in, / lists your decks; one opens, one is deleted after a confirm', async ({ page }) => {
  let decks = [
    { id: 'd_a', name: 'Acme', updated: Date.now(), data: { id: 'd_a', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: Date.now(),
      items: [{ id: 's', slide: { template: 'cover', title: 'Acme', subtitle: 'Board update.' }, status: 'ok', errors: [], warnings: [], checks: [] }] } },
    { id: 'd_b', name: 'Plan', updated: Date.now() - 3600e3, data: { id: 'd_b', style: 'pitch', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
      items: [{ id: 's', slide: { template: 'section', title: 'Plan' }, status: 'ok', errors: [], warnings: [], checks: [] }] } },
  ]
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => {
    const id = new URL(r.request().url()).searchParams.get('id')
    if (r.request().method() === 'DELETE') { decks = decks.filter((d) => d.id !== id); return r.fulfill({ status: 204 }) }
    if (id) { const d = decks.find((x) => x.id === id); return d ? r.fulfill({ json: d }) : r.fulfill({ status: 404, json: {} }) }
    return r.fulfill({ json: decks })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(2)
  await page.getByRole('button', { name: 'More for Plan' }).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()
  await page.getByRole('button', { name: 'Delete deck' }).click()
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(1)
  await page.getByRole('button', { name: 'Open Acme' }).click()
  await expect(page).toHaveURL(/\/d\/d_a$/)
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
})

const oneDeck = { id: 'd_a', name: 'Acme', updated: 1, data: { id: 'd_a', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
  items: [{ id: 's', slide: { template: 'cover', title: 'Acme', subtitle: 'Board update.' }, status: 'ok', errors: [], warnings: [], checks: [] }] } }

test('a failed save is retried, with one message, and a browser copy kept until it saves', async ({ page }) => {
  let puts = 0 // the first two saves fail (the second follows the warning at once), then the retry succeeds
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => {
    if (r.request().method() === 'PUT') return ++puts <= 2 ? r.fulfill({ status: 500, json: {} }) : r.fulfill({ json: { ok: true } })
    return r.fulfill({ json: oneDeck })
  })
  await page.goto('/d/d_a')
  await expect(page.getByText('Couldn’t save. Retrying.')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('smartchart.journey.decks.v1') ?? '')).toContain('d_a')
  await expect.poll(() => puts, { timeout: 6000 }).toBeGreaterThanOrEqual(3)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{"decks":{}}').decks.d_a ?? null)).toBeNull()
})

test('when the session ends, a save asks to sign in again', async ({ page }) => {
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => r.request().method() === 'PUT' ? r.fulfill({ status: 401, json: { error: 'Sign in to see your decks.' } }) : r.fulfill({ json: oneDeck }))
  await page.goto('/d/d_a')
  await expect(page.getByRole('dialog')).toContainText('Sign in again')
  await expect(page.getByRole('dialog')).toContainText('Continue with Google')
})

test('back from Google, the session check passes the one-time verifier on, then drops it from the URL', async ({ page }) => {
  const seen: (string | null)[] = []
  await page.route('**/api/auth/get-session**', (r) => {
    const v = new URL(r.request().url()).searchParams.get('neon_auth_session_verifier')
    seen.push(v)
    return r.fulfill({ json: v === 'abc' ? { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } : null })
  })
  await page.route('**/api/decks**', (r) => r.fulfill({ json: [] }))
  await page.goto('/?neon_auth_session_verifier=abc')
  await expect(page.getByText('Your first deck starts with a sentence.')).toBeVisible()
  expect(seen[0]).toBe('abc')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})
