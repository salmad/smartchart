/* The raw file behind a slide or a doc: open it from edit mode, change the text, and the page and the save follow. */
import { test, expect, type Page } from '@playwright/test'
import type { Slide } from '@/engine/types'
import { signInAsDev } from './dev-account'
import { pageMenu } from './bar'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
test.use({ viewport: { width: 1440, height: 900 } })

test.describe('slide', () => {
  signInAsDev()
  const deck = { active: 'd1', decks: { d1: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
    items: [{ id: 'a', status: 'ok', errors: [], warnings: [], checks: [],
      slide: { template: 'cards', title: 'Three levers drive margin', cards: [{ icon: 'zap', title: 'Price', text: 'Raise list price' }, { icon: 'wallet', title: 'Mix', text: 'Sell more premium' }, { icon: 'truck', title: 'Cost', text: 'Cut freight' }] } }] } } }
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, deck)
    await page.goto('/d/d1'); await page.waitForFunction(() => window.__journey?.items.length); await page.locator('[data-strip-thumb]').first().waitFor()
  })
  const saved = (page: Page): Promise<Slide> => page.evaluate(() => window.__journey?.items[0].slide as Slide)
  const file = (page: Page) => page.getByRole('textbox', { name: 'Slide source' })

  test('edits the slide as JSON, shows it, and saves it', async ({ page }) => {
    await page.keyboard.press('e')
    await page.getByRole('button', { name: 'Edit the source' }).click()
    await expect(file(page)).toHaveValue(/"template": "cards"/)
    await file(page).fill((await file(page).inputValue()).replace('Cut freight', 'Cut freight and fuel'))
    await page.getByRole('button', { name: 'Back to the page' }).click()
    await expect(page.locator('[data-editing]')).toContainText('Cut freight and fuel')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
    expect((await saved(page)).cards?.[2].text).toBe('Cut freight and fuel')
  })

  test('JSON that does not parse keeps the file open and says why', async ({ page }) => {
    await page.keyboard.press('e')
    await page.getByRole('button', { name: 'Edit the source' }).click()
    await file(page).fill('{ "template": "cards", ')
    await expect(page.getByRole('alert')).toContainText('Not valid JSON')
    await page.getByRole('button', { name: 'Back to the page' }).click()
    await expect(file(page)).toBeVisible()
  })

  test('the deck menu shows the whole deck as one file', async ({ page }) => {
    await pageMenu(page, 'deck', 'View source')
    const file = page.getByRole('textbox', { name: 'Deck source' })
    await expect(file).toHaveValue(/"style": "consulting"/)
    await expect(file).toHaveValue(/"id": "a",\s*"template": "cards"/)
    await expect(file).toHaveJSProperty('readOnly', true)
  })

  test('⌘S saves from the file', async ({ page }) => {
    await page.keyboard.press('e')
    await page.getByRole('button', { name: 'Edit the source' }).click()
    await file(page).fill((await file(page).inputValue()).replace('Raise list price', 'Raise list price 4%'))
    await page.keyboard.press(`${mod}+s`)
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
    expect((await saved(page)).cards?.[0].text).toBe('Raise list price 4%')
  })
})

test.describe('doc', () => {
  const DOC = ['---', 'title: Test doc', '---', '', '## Plan {#plan}', '', 'First paragraph here.', '', '- one', '- two', ''].join('\n')
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem('smartchart.devAccount', '1'); localStorage.setItem('smartchart.agentNudge.dismissed.dev', '1')
      if (sessionStorage.getItem('seeded')) return
      localStorage.setItem('smartchart.docs.v1', JSON.stringify({ doc_t: { id: 'doc_t', name: 'Test doc', text: t, updated: 1, workspaceId: 'ws_local' } }))
      sessionStorage.setItem('seeded', '1')
    }, DOC)
    await page.goto('/doc/doc_t')
    await expect(page.locator('.doc-title')).toHaveText('Test doc')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.locator('.doc-editing')).toBeVisible()
  })
  const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>).doc_t.text)
  const file = (page: Page) => page.getByRole('textbox', { name: 'Doc source' })

  test('shows the doc file, takes a new bullet, and saves it', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit the source' }).click()
    await expect(file(page)).toHaveValue(/## Plan \{#plan\}/)
    await file(page).fill((await file(page).inputValue()).replace('- two', '- two\n- three'))
    await page.getByRole('button', { name: 'Back to the page' }).click()
    await expect(page.locator('.doc-editing .ProseMirror li')).toHaveText(['one', 'two', 'three'])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(await saved(page)).toContain('- two\n- three')
  })

  test('the doc menu shows the doc file', async ({ page }) => {
    await page.getByRole('button', { name: 'Discard' }).click()
    await pageMenu(page, 'doc', 'View source')
    await expect(page.getByRole('textbox', { name: 'Doc source' })).toHaveValue(/## Plan \{#plan\}/)
  })

  test('opening the file and saving unchanged writes nothing', async ({ page }) => {
    const before = await saved(page)
    await page.getByRole('button', { name: 'Edit the source' }).click()
    await page.keyboard.press(`${mod}+s`)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(await saved(page)).toBe(before)
  })
})
