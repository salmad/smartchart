/* Members, invites and the viewer's view, signed in with the API mocked (the browser tests run without a database). */
import { test, expect, type Page } from '@playwright/test'

type Ws = { id: string; name: string; role: 'owner' | 'editor' | 'viewer'; personal: boolean; members: number; usedAt: number | null }
const deckData = (title: string) => ({ id: 'd_1', style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1,
  items: [{ id: 's_1', slide: { template: 'cover', title, subtitle: 'Board update.' }, status: 'ok', errors: [], warnings: [], checks: [] }] })

/** Signed in as `who`, in `workspaces`, with one deck d_1 opened as `role`. Returns the deck saves the app sent. */
async function account(page: Page, { who = { id: 'u_ann', email: 'ann@example.com', name: 'Ann' }, workspaces, role, put }:
  { who?: { id: string; email: string; name: string }; workspaces: () => Ws[]; role: Ws['role']; put?: () => { status: number; json: object } }) {
  const saves: unknown[] = []
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: { user: { ...who, image: null }, session: {} } }))
  await page.route('**/api/docs**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/workspaces**', (r) => r.request().method() === 'GET' && !r.request().url().includes('members') ? r.fulfill({ json: workspaces() }) : r.fallback())
  await page.route('**/api/decks**', (r) => {
    const q = new URL(r.request().url()).searchParams, method = r.request().method()
    if (method === 'PUT' && !q.get('presence')) { saves.push(r.request().postDataJSON()); const a = put?.() ?? { status: 200, json: { ok: true, rev: 2 } }; return r.fulfill(a) }
    if (method === 'PUT') return r.fulfill({ json: { ok: true } })
    if (q.get('rev')) return r.fulfill({ json: { rev: 1, presence: {} } })
    if (q.get('events') !== null || q.get('versions') !== null) return r.fulfill({ json: [] })
    if (q.get('id')) return r.fulfill({ json: { id: 'd_1', name: 'Q3 board', named: true, updated: 1, rev: 1, role, data: deckData('Q3 board'), chat: null } })
    return r.fulfill({ json: [{ id: 'd_1', name: 'Q3 board', updated: 1, slides: 1, style: 'consulting', theme: 'ink', accent: null, first: deckData('Q3 board').items[0].slide, shared: false }] })
  })
  return saves
}
const acme = (role: Ws['role']): Ws => ({ id: 'ws_a', name: 'Acme', role, personal: false, members: 3, usedAt: 2 })

test('a viewer reads the deck, with no way to change it', async ({ page }) => {
  const saves = await account(page, { who: { id: 'u_cy', email: 'cy@example.com', name: 'Cy' }, workspaces: () => [acme('viewer')], role: 'viewer' })
  await page.goto('/d/d_1')
  await expect(page.getByText('View only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Present from slide 1' })).toBeVisible()
  await expect(page.getByPlaceholder(/Describe a slide/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  const sidebar = page.getByRole('navigation', { name: 'Workspace' })
  await expect(sidebar.getByRole('button', { name: 'Workspace: Acme' })).toContainText('Viewer')
  await sidebar.getByRole('listitem').filter({ hasText: 'Q3 board' }).hover()
  await expect(sidebar.getByRole('button', { name: /More for/ })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'New deck' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Delete deck…' })).toHaveCount(0)
  await page.waitForTimeout(600) // longer than the save pause
  expect(saves).toEqual([])
})

test('an owner sees the members, changes nothing by accident, and invites by link', async ({ page }) => {
  await account(page, { workspaces: () => [acme('owner')], role: 'owner' })
  const invites: unknown[] = []
  await page.route('**/api/workspaces?id=ws_a&members', (r) => r.fulfill({ json: {
    members: [{ userId: 'u_ann', email: 'ann@example.com', name: 'Ann', role: 'owner' }, { userId: 'u_bob', email: 'bob@example.com', name: 'Bob', role: 'editor' }], invites: [] } }))
  await page.route('**/api/workspaces?id=ws_a&invite', (r) => { invites.push(r.request().postDataJSON()); return r.fulfill({ json: { link: 'http://localhost:5199/i/tok_abc123' } }) })
  await page.goto('/d/d_1')
  await page.getByRole('button', { name: 'Workspace: Acme' }).click()
  await page.getByRole('menuitem', { name: 'Members…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Members of Acme' })
  await expect(dialog.getByRole('listitem')).toHaveCount(2)
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Ann' })).toContainText('You')
  await dialog.getByRole('textbox', { name: 'Email' }).fill('cy@example.com')
  await dialog.getByRole('button', { name: 'Create invite link' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Invite link' })).toHaveValue('http://localhost:5199/i/tok_abc123')
  await expect(dialog.getByRole('button', { name: 'Copy' })).toBeVisible()
  expect(invites).toEqual([{ email: 'cy@example.com', role: 'editor' }])
})

test('an invite link, once accepted, opens its workspace', async ({ page }) => {
  let accepted = false
  await account(page, { workspaces: () => accepted ? [{ ...acme('editor'), id: 'ws_b', name: 'Beta team' }, acme('owner')] : [acme('owner')], role: 'owner' })
  await page.route('**/api/workspaces?accept=tok_abc123', (r) => { accepted = true; return r.fulfill({ json: { workspaceId: 'ws_b', role: 'editor' } }) })
  await page.route('**/api/workspaces?id=ws_b', (r) => r.fulfill({ json: { ok: true } }))
  await page.goto('/i/tok_abc123')
  await expect(page).not.toHaveURL(/\/i\//)
  await expect(page.getByRole('button', { name: 'Workspace: Beta team' })).toBeVisible()
})

test('an invite that can’t be used says why', async ({ page }) => {
  await account(page, { workspaces: () => [acme('owner')], role: 'owner' })
  await page.route('**/api/workspaces?accept=tok_old', (r) => r.fulfill({ status: 410, json: { error: 'This invite expired or was taken back.' } }))
  await page.goto('/i/tok_old')
  await expect(page.getByText('This invite expired or was taken back.')).toBeVisible()
})

test('a save refused as a viewer’s says so, and isn’t retried', async ({ page }) => {
  const saves = await account(page, { workspaces: () => [acme('editor')], role: 'editor', put: () => ({ status: 403, json: { error: 'You can view this deck, not edit it.' } }) })
  await page.goto('/d/d_1')
  await page.locator('[data-strip-thumb]').first().waitFor()
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByRole('group', { name: 'Palette' }).getByRole('button', { name: 'Paper' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => saves.length).toBe(1)
  await expect(page.getByText('You can view this deck, not edit it.')).toBeVisible()
  // The warning itself is a change to the chat, so one more save follows it (refused quietly); nothing retries on a timer.
  await page.waitForTimeout(2500)
  expect(saves).toHaveLength(2)
})
