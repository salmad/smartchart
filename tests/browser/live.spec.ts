import { expect, test } from '@playwright/test'

const slide = (title: string) => ({ template: 'section', title })

test('an open share page shows an outside write within 5 s, at that slide', async ({ page }) => {
  let rev = 1
  const body = () => ({ name: 'Live', style: 'consulting', theme: 'ink', accent: null, rev, ids: ['s_a', 's_b'], slides: [slide('Plan'), slide(rev === 1 ? 'Before' : 'After Claude')] })
  await page.route('**/api/share?s=tok&rev=1', (r) => r.fulfill({ json: { rev } }))
  await page.route('**/api/share?s=tok', (r) => r.fulfill({ json: body() }))
  await page.goto('/s/tok')
  await expect(page.getByText('Before')).toBeVisible()
  rev = 2
  await expect(page.getByText('After Claude')).toBeVisible({ timeout: 5000 })
})

test('an open editor takes an outside write within 5 s, says who, and shows no stale error', async ({ page }) => {
  let rev = 1
  const row = () => ({ id: 'd_live', name: 'Live', updated: 1, rev, data: { id: 'd_live', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
    items: [{ id: 's_a', slide: slide(rev === 1 ? 'Before' : 'After Claude'), status: 'ok', errors: [], warnings: [], checks: [] }] } })
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { id: 'u1', email: 'a@example.com', name: 'Ann', image: null }, session: {} } }))
  await page.route('**/api/decks**', (r) => {
    const q = new URL(r.request().url()).searchParams
    if (r.request().method() === 'PUT') return r.fulfill({ json: { ok: true, rev } })
    if (q.get('rev')) return r.fulfill({ json: { rev, presence: {} } })
    if (q.get('events') !== null) return r.fulfill({ json: rev === 1 ? [] : [{ rev: 2, by: 'Claude Code', slideId: 's_a', what: 'updated' }] })
    if (q.get('id')) return r.fulfill({ json: row() })
    return r.fulfill({ json: [] })
  })
  await page.goto('/d/d_live')
  await expect(page.getByText('Before').first()).toBeVisible()
  rev = 2
  await expect(page.getByText('After Claude').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Claude Code updated a slide.')).toBeVisible()
  await expect(page.getByText('changed in another tab')).toHaveCount(0)
})
