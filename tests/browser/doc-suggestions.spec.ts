/* Doc suggestions: wall-of-text verdict, swap a grouped-table proposal in place, cancel then approve. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { identify } from '@/engine/docs/ops'
import { parseDoc } from '@/engine/docs/parse'
import { checkProposal, type DocProposal } from '@/engine/docs/proposals'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/docs/wall-of-text.md')
const WALL = readFileSync(FIX, 'utf8')
const DOC_ID = 'doc_t'

const paraId = identify(parseDoc(WALL).doc).find(
  (x) => x.block.type === 'paragraph' && x.block.text.includes('forty-one'),
)!.id

const STORED: DocProposal = {
  id: 'prop_table',
  blockIds: [paraId],
  mode: 'insert',
  label: 'Opens by format',
  why: 'Skim the split',
  by: 'Occam',
  at: 1,
  rev: 1,
  figure: {
    kind: 'table',
    body: {
      caption: 'Where opens start',
      source: 'App telemetry',
      table: {
        columns: [{ label: 'Format' }, { label: 'Share' }],
        rows: [
          { cells: ['Opens'], style: 'group' },
          { cells: ['Reels', '41%'] },
          { cells: ['Stories', '28%'] },
          { cells: ['Feed', 'rest'] },
        ],
      },
    },
  },
}

const check = checkProposal(parseDoc(WALL).doc, STORED)
if (!check.ok) throw new Error(`fixture proposal invalid: ${check.error}`)

async function seed(page: Page) {
  await page.route('**/api/glm**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposals: [] }) })
  })
  await page.addInitScript(() => localStorage.setItem('smartchart.devAccount', '1'))
  await page.goto('/')
  await page.evaluate(([text, proposal, docId]) => {
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({
      [docId]: {
        id: docId,
        name: 'Reels digest (prose only)',
        text,
        updated: 1,
        rev: 1,
        workspaceId: 'ws_local',
        proposals: [proposal],
      },
    }))
  }, [WALL, STORED, DOC_ID] as const)
  await page.goto(`/doc/${DOC_ID}`)
  await expect(page.locator('.doc-title')).toHaveText('Reels digest (prose only)')
  await dismissToasts(page)
}

async function dismissToasts(page: Page) {
  const toast = page.getByRole('status').filter({ hasText: 'Connect an agent' })
  if (await toast.isVisible()) await toast.getByRole('button', { name: 'Dismiss' }).click()
}

const savedText = (page: Page) => page.evaluate((id) => {
  const d = JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>
  return d[id]?.text ?? ''
}, DOC_ID)

const versionCount = (page: Page) => page.evaluate((id) => {
  const all = JSON.parse(localStorage.getItem('smartchart.docs.versions.v1') ?? '{}') as Record<string, { list?: unknown[] }>
  return all[id]?.list?.length ?? 0
}, DOC_ID)

const openChecks = async (page: Page) => {
  await page.getByRole('button', { name: /Checks/ }).click()
  const panel = page.getByRole('complementary', { name: 'Checks' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Suggestions' })).toBeVisible({ timeout: 30_000 })
}

const edit = async (page: Page) => {
  const btn = page.getByRole('button', { name: 'Edit', exact: true })
  if (await btn.isVisible()) await btn.click()
  await expect(page.locator('.doc-editing')).toBeVisible()
}

const pickSuggestion = async (page: Page) => {
  await page.getByRole('complementary', { name: 'Checks' }).getByRole('button', { name: 'Opens by format' }).click()
  await edit(page)
  await expect(page.locator('.doc-proposal-widget')).toBeVisible()
}

const flip = async (page: Page, which: 'Original' | 'Suggestion') => {
  await page.getByRole('button', { name: which, exact: true }).click()
}

test('wall of text: cancel after flipping leaves the doc and versions alone; approve writes the table', async ({ page }) => {
  await seed(page)
  const before = await savedText(page)
  const versionsBefore = await versionCount(page)

  await openChecks(page)
  await expect(page.getByText('Reads as a wall of text')).toBeVisible()
  await pickSuggestion(page)

  await flip(page, 'Original')
  await expect(page.locator('.doc-proposal-widget')).toBeHidden()
  await flip(page, 'Suggestion')
  await flip(page, 'Original')
  await flip(page, 'Suggestion')

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.doc-proposal-widget')).toBeHidden()
  expect(await savedText(page)).toBe(before)
  expect(await versionCount(page)).toBe(versionsBefore)

  await pickSuggestion(page)
  await flip(page, 'Original')
  await flip(page, 'Suggestion')
  await flip(page, 'Original')
  await flip(page, 'Suggestion')

  await dismissToasts(page)
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.locator('.doc-editing figure table')).toBeVisible({ timeout: 15_000 })
  expect(await savedText(page)).not.toBe(before)
  expect(await versionCount(page)).toBe(versionsBefore + 1)

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect(page.locator('.doc .doc-fig[data-kind="table"]')).toBeVisible()

  await page.getByRole('button', { name: 'Versions' }).click()
  const panel = page.getByRole('complementary', { name: 'Versions' })
  await expect(panel).toContainText('Suggestion: Opens by format')
})
