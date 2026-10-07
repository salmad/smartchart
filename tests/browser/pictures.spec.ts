/* Slides with pictures in the app: drawn (logos as one-colour masks, photos loaded), edited by hand in their words, and
   never grown by hand while the app cannot add a picture. */
import { test, expect, type Page } from '@playwright/test'
import type { Slide } from '@/engine/types'
import { signInAsDev } from './dev-account'

signInAsDev()
const IMG = '/starters/img/'
const item = (id: string, slide: object) => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] })
const deck = { active: 'd1', decks: { d1: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [
    item('a', { template: 'team', title: 'The team has built SME lending and card issuing at scale before', people: [
      { photo: { src: `${IMG}priya-photo-1024x1024.webp` }, name: 'Priya Shah', role: 'CEO', text: 'Built an SME lending book' },
      { photo: { src: `${IMG}tom-photo-1024x1024.webp` }, name: 'Tom Ellison', role: 'CTO', text: 'Ran card issuing for 4m customers' },
      { photo: { src: `${IMG}grace-photo-1024x1024.webp` }, name: 'Grace Adeyemi', role: 'CRO', text: '12 years in SME credit risk' }] }),
    item('b', { template: 'logos', title: 'Acme launches inside the tools UK small businesses already use', logos: [
      { logo: { src: `${IMG}ledgerline-logo-731x150.png` }, name: 'Ledgerline' }, { logo: { src: `${IMG}kiln-logo-453x600.png` }, name: 'Kiln' },
      { logo: { src: `${IMG}payroo-logo-796x130.png` }, name: 'Payroo' }, { logo: { src: `${IMG}tally-logo-764x159.png` }, name: 'Tally & Co.' }] }),
  ] } } }
test.beforeEach(async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, deck)
})
const open = async (page: Page) => { await page.goto('/d/d1'); await page.waitForFunction(() => window.__journey?.items.length); await page.locator('[data-strip-thumb]').first().waitFor() }
const saved = (page: Page, i = 0): Promise<Slide> => page.evaluate((k) => window.__journey?.items[k].slide as Slide, i)

test('pictures are drawn: photos load, logos are one-colour masks named for screen readers', async ({ page }) => {
  await open(page)
  const photos = page.locator('.team .ph img').filter({ visible: true })
  await expect(photos.first()).toBeVisible()
  await expect.poll(() => photos.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await page.keyboard.press('ArrowDown')
  const logo = page.locator('.wall .brand').filter({ visible: true }).first()
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((e) => getComputedStyle(e).maskImage)).toContain('ledgerline-logo')
  await expect(page.getByRole('img', { name: 'Kiln' }).filter({ visible: true })).toBeVisible()
})

test('a person is edited by hand in words; the photo stays; Add after picks a picture first and says why it failed', async ({ page }) => {
  await open(page)
  await page.keyboard.press('e')
  const name = page.locator('[data-editing] [data-path="people[1].name"]')
  await name.click()
  await page.keyboard.press('End')
  await page.keyboard.type('-Brown')
  await page.locator('[data-editing] [data-item="people[1]"]').hover()
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible()
  // The test server has no picture store: the picker opens, the upload is refused, and the reason is shown.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add after' }).click()
  await (await chooser).setFiles({ name: 'face.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') })
  await expect(page.getByRole('alert')).toContainText(/not set up|Sign in/)
  await page.getByRole('button', { name: 'Save' }).click()
  const s = await saved(page)
  expect(s.people).toHaveLength(3)
  expect(s.people?.[1]).toMatchObject({ name: 'Tom Ellison-Brown', photo: { src: `${IMG}tom-photo-1024x1024.webp` } })
})

test('a picture is replaced in edit mode with one of the same kind', async ({ page }) => {
  await page.route('**/api/images?kind=photo', (r) => r.fulfill({ json: { kinds: { photo: { src: `${IMG}daniel-photo-1024x1024.webp`, width: 1024, height: 1024 } }, refused: {} } }))
  await open(page)
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-pic="people[0].photo"]').hover()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Replace picture' }).click()
  await (await chooser).setFiles({ name: 'new.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') })
  await expect.poll(async () => page.locator('[data-editing] [data-pic="people[0].photo"] img').getAttribute('src')).toBe(`${IMG}daniel-photo-1024x1024.webp`)
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).people?.[0].photo).toEqual({ src: `${IMG}daniel-photo-1024x1024.webp` })
})

test('a picture dropped on the chat is uploaded, and the agent reads the src for each use', async ({ page }) => {
  const sent: string[] = []
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: true } }))
  await page.route('**/api/jev', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/glm', (r) => { sent.push(r.request().postData() ?? ''); return r.fulfill({ status: 503, json: { error: 'down' } }) })
  await page.route('**/api/images?kind=all', (r) => r.fulfill({ json: { kinds: { logo: { src: `${IMG}kiln-logo-453x600.png`, width: 453, height: 600 } }, refused: { photo: 'Too small to stay sharp.' } } }))
  await open(page)
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'kiln.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  const chips = page.getByRole('list', { name: 'Attached files' })
  await expect(chips).toContainText('kiln.png')
  await expect(chips).toContainText('picture')
  await page.getByPlaceholder(/room should take away/).fill('Add this partner logo to the wall')
  await page.keyboard.press('Enter')
  await expect.poll(() => sent.join(' ')).toContain('A picture the user added (kiln.png)')
  expect(sent.join(' ')).toContain('kiln-logo-453x600.png')
  expect(sent.join(' ')).toContain('Too small to stay sharp.')
})
