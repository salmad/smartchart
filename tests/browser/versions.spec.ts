/* Versions: preview an earlier state and restore it; Undo on an agent reply puts the slides back as they were. The dev
   account keeps versions in this browser, so a deck and its versions are seeded through localStorage. */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const section = (title: string) => ({ template: 'section', title })
const tree = (hash: string) => ({ style: 'consulting', theme: 'ink', accent: null, slides: [['s', hash]] })
const deck = { id: 'v', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 2000, history: [], working: [],
  messages: [{ kind: 'user', text: 'Retitle it' }, { kind: 'bot', text: 'Done.', turn: 't1' }],
  items: [{ id: 's', slide: section('Now'), status: 'ok', errors: [], warnings: [], checks: [] }] }
const versions = { v: {
  blobs: { h1: section('Before'), h2: section('Now') },
  versions: [
    { n: 1, rev: 0, by: 'You', turn: null, label: null, at: Date.now() - 60_000, key: 'k1', tree: tree('h1') },
    { n: 2, rev: 0, by: 'Occam', turn: 't1', label: 'Retitle it', at: Date.now() - 30_000, key: 'k2', tree: tree('h2') },
  ],
} }

async function open(page: Page) {
  await page.addInitScript(([d, v]) => {
    if (sessionStorage.getItem('seeded')) return
    localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify({ active: 'v', decks: { v: JSON.parse(d) } }))
    localStorage.setItem('smartchart.versions.v1', v)
    sessionStorage.setItem('seeded', '1')
  }, [JSON.stringify(deck), JSON.stringify(versions)] as const)
  await page.goto('/d/v')
  await expect.poll(() => page.evaluate(() => window.__journey?.items[0]?.slide.title)).toBe('Now')
}
const title = (page: Page) => page.evaluate(() => window.__journey?.items[0]?.slide.title)

test('preview an earlier version, then restore it as a new version on top', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Versions' }).click()
  const panel = page.getByRole('complementary', { name: 'Versions' })
  await expect(panel.getByRole('button')).toHaveCount(3) // close + two versions
  await expect(panel).toContainText('“Retitle it”')
  await panel.getByRole('button', { name: /You/ }).click()
  await expect(page.getByRole('group', { name: 'Slides in this version' })).toContainText('Before')
  expect(await title(page)).toBe('Now') // a preview writes nothing
  await page.getByRole('button', { name: 'Restore this version' }).click()
  await expect.poll(() => title(page)).toBe('Before')
  await expect(page.getByRole('complementary', { name: 'Chat' })).toContainText('Restored the version from')
  await expect(panel.getByRole('button', { name: /Current/ })).toContainText('Restored the version from')
})

test('Undo on an agent reply puts the slides back as they were before it', async ({ page }) => {
  await open(page)
  const chat = page.getByRole('complementary', { name: 'Chat' })
  await chat.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => title(page)).toBe('Before')
  await expect(chat).toContainText('Undid “Retitle it”')
  await expect(chat.getByText('Undone', { exact: true })).toBeVisible()
})
