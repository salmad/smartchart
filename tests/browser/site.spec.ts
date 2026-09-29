/* The public site and accounts: real slides with no fit issues, the before/after by keyboard, the prompt waiting
   through sign-in, and the decks sidebar against a mocked account. */
import { test, expect, type Page } from '@playwright/test'
import { devAccount } from './dev-account'

async function site(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /scientifically precise/ })).toBeVisible()
}

for (const width of [1440, 390]) {
  test(`the site at ${width}px: every slide fits and nothing scrolls sideways`, async ({ page }) => {
    await site(page, width)
    await page.evaluate(() => document.fonts.ready)
    const slides = page.locator('.site .slide')
    expect(await slides.count()).toBeGreaterThanOrEqual(11)
    const overflow = await page.locator('.site').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBe(0)
  })
}

test('the page switches between the Ink and Paper looks and remembers the pick', async ({ page }) => {
  await site(page, 1440)
  await expect(page.locator('.site')).toHaveAttribute('data-look', 'ink')
  await page.getByRole('group', { name: 'Page look' }).getByRole('button', { name: 'paper' }).click()
  await expect(page.locator('.site')).toHaveAttribute('data-look', 'paper')
  await page.reload()
  await expect(page.locator('.site')).toHaveAttribute('data-look', 'paper')
})

test('the before/after divider moves with the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await site(page, 1440)
  const slider = page.getByRole('slider', { name: /Compare/ })
  await expect(slider).toHaveAttribute('aria-valuenow', '82')
  await slider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(slider).toHaveAttribute('aria-valuenow', '77')
  await page.keyboard.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
})

test('signed out, a prompt on the site asks to sign in first and keeps the prompt, and its example’s style, for after', async ({ page }) => {
  await site(page, 1440)
  await expect(page.getByRole('group', { name: 'Writing style' })).toHaveCount(0)
  await page.locator('#hero-prompt').getByRole('button', { name: 'A seed pitch' }).click()
  await page.getByLabel('Describe your slide').first().fill('Revenue grew from £2.1m to £5.4m')
  await page.locator('#hero-prompt').getByRole('button', { name: 'Make slides' }).click()
  await expect(page).toHaveURL(/\/new$/)
  await expect(page.getByRole('dialog')).toContainText('Sign in and Occam makes your slide')
  const pending = await page.evaluate(() => sessionStorage.getItem('smartchart.pendingPrompt'))
  expect(pending).toContain('Revenue grew')
  expect(pending).toContain('"pitch"')
})

test('after sign-in, the prompt kept from the site opens the editor in the style picked there', async ({ page }) => {
  await devAccount(page)
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: false } }))
  await page.addInitScript(() => sessionStorage.setItem('smartchart.pendingPrompt', JSON.stringify({ text: 'Revenue grew from £2.1m to £5.4m', style: 'pitch' })))
  await page.goto('/new')
  await page.getByRole('button', { name: 'deck look' }).click()
  await expect(page.getByRole('group', { name: 'Deck style' }).getByRole('button', { name: 'Pitch' })).toHaveAttribute('aria-pressed', 'true')
})

test('signed out, a deck link asks to sign in; closing the dialog goes to the site', async ({ page }) => {
  await page.goto('/d/d_x')
  await expect(page.getByRole('dialog')).toContainText('Continue with Google')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})

test('Sign in opens the sign-in dialog, which explains when accounts are not set up', async ({ page }) => {
  await site(page, 1440)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('dialog')).toContainText('Continue with Google')
})

test('signed in, / opens the last deck; the sidebar lists summaries, switches decks and deletes one after a confirm', async ({ page }) => {
  let decks = [
    { id: 'd_a', name: 'Acme', updated: Date.now(), data: { id: 'd_a', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: Date.now(),
      items: [{ id: 's', slide: { template: 'cover', title: 'Acme', subtitle: 'Board update.' }, status: 'ok', errors: [], warnings: [], checks: [] }] } },
    { id: 'd_b', name: 'Plan', updated: Date.now() - 3600e3, data: { id: 'd_b', style: 'pitch', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
      items: [{ id: 's', slide: { template: 'section', title: 'Plan' }, status: 'ok', errors: [], warnings: [], checks: [] }] } },
  ]
  const fullReads: string[] = []
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => {
    const id = new URL(r.request().url()).searchParams.get('id'), method = r.request().method()
    if (method === 'PUT') return r.fulfill({ json: { ok: true } })
    if (method === 'DELETE') { decks = decks.filter((d) => d.id !== id); return r.fulfill({ status: 204 }) }
    if (id) { fullReads.push(id); const d = decks.find((x) => x.id === id); return d ? r.fulfill({ json: d }) : r.fulfill({ status: 404, json: {} }) }
    // The list is summaries only, as the server sends it.
    return r.fulfill({ json: decks.map(({ id, name, updated, data }) => ({ id, name, updated, slides: data.items.length, style: data.style, theme: data.theme, accent: data.accent, first: data.items[0].slide })) })
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/d\/d_a$/)
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(1)
  expect(fullReads).toEqual(['d_a']) // only the deck being opened is read in full
  const sidebar = page.getByRole('navigation', { name: 'Your decks' })
  await expect(sidebar.getByRole('listitem')).toHaveCount(2)
  await expect(sidebar).toContainText('Ann')
  await sidebar.getByText('Plan').click()
  await expect(page).toHaveURL(/\/d\/d_b$/)
  await sidebar.getByRole('listitem').filter({ hasText: 'Acme' }).hover()
  await sidebar.getByRole('button', { name: 'More for Acme' }).click()
  await page.getByRole('menuitem', { name: 'Delete deck…' }).click()
  await page.getByRole('button', { name: 'Delete deck' }).click()
  await expect(sidebar.getByRole('listitem')).toHaveCount(1)
  expect(decks.map((d) => d.id)).toEqual(['d_b'])
})

/** A real edit, so the deck saves: opening a deck alone does not. */
async function edit(page: Page) {
  await page.getByRole('button', { name: 'deck look' }).click()
  await page.getByRole('group', { name: 'Palette' }).getByRole('button', { name: 'Paper' }).click()
  await page.keyboard.press('Escape')
}

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
  await edit(page)
  await expect(page.getByText('Couldn’t save. The server answered 500. Retrying; a copy is kept in this browser until it saves.')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('smartchart.journey.decks.v1') ?? '')).toContain('d_a')
  await expect.poll(() => puts, { timeout: 6000 }).toBeGreaterThanOrEqual(3)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{"decks":{}}').decks.d_a ?? null)).toBeNull()
})

test('when the session ends, a save asks to sign in again', async ({ page }) => {
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => r.request().method() === 'PUT' ? r.fulfill({ status: 401, json: { error: 'Sign in to see your decks.' } }) : r.fulfill({ json: oneDeck }))
  await page.goto('/d/d_a')
  await edit(page)
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
  await expect(page.getByRole('heading', { name: 'What should this slide say?' })).toBeVisible() // no decks yet: a new one
  expect(seen[0]).toBe('abc')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})

test('signed in, Occam in the bar opens the site at /home, with Open app back to the editor', async ({ page }) => {
  await devAccount(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Occam' })).toBeVisible()
  await page.getByRole('link', { name: 'Occam' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { name: /scientifically precise/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0)
  await expect(page.getByText('First slide free.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open app' }).click()
  await expect(page.getByRole('link', { name: 'Occam' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/home$/)
})

test('signed out, every call to action is Start free or Make slides, with the offer under each section CTA', async ({ page }) => {
  await site(page, 1440)
  const labels = await page.locator('.site').getByRole('button', { name: /slides|free/i }).allTextContents()
  expect(new Set(labels.map((l) => l.trim()))).toEqual(new Set(['Start free', 'Make slides']))
  await expect(page.getByText('First slide free.')).toHaveCount(3)
})
