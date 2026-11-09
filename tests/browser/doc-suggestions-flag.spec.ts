/* Doc block suggestions: a chart suggestion draws its chart in place and keeps the original beside it (default build);
   with VITE_DOC_BLOCK_SUGGESTIONS=0 there are no margin marks, no Suggestions list and no model call, but code checks stay.
   The off test needs the dev server started with the flag: VITE_DOC_BLOCK_SUGGESTIONS=0 npm run test:browser -- doc-suggestions-flag */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { identify } from '@/engine/docs/ops'
import { parseDoc } from '@/engine/docs/parse'
import type { DocProposal } from '@/engine/docs/proposals'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const WALL = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/docs/wall-of-text.md'), 'utf8')
const DOC_ID = 'doc_t'
const FLAG_OFF = process.env.VITE_DOC_BLOCK_SUGGESTIONS === '0' || process.env.VITE_DOC_BLOCK_SUGGESTIONS === 'false'
const paraId = identify(parseDoc(WALL).doc).find((x) => x.block.type === 'paragraph' && x.block.text.includes('forty-one'))?.id ?? ''

const chart: DocProposal = {
  id: 'prop_chart', blockIds: [paraId], mode: 'insert', label: 'Opens as a chart', why: 'Skim the split', by: 'Claude', at: 1, rev: 1,
  figure: { kind: 'chart', body: { caption: 'Opens by format', source: 'App telemetry',
    chart: { categories: ['Reels', 'Stories', 'Feed'], format: '{v}%', series: [{ name: 'Share', mark: 'bar', color: 'focus', values: [41, 28, 31] }] } } },
}

async function seed(page: Page) {
  let modelCalls = 0
  await page.route('**/api/glm**', async (route) => {
    modelCalls++
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposals: [] }) })
  })
  await page.addInitScript(() => { localStorage.setItem('smartchart.devAccount', '1'); localStorage.setItem('smartchart.agentNudge.dismissed.dev', '1') })
  await page.goto('/')
  await page.evaluate(([text, proposals, docId]) => {
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ [docId]: { id: docId, name: 'Reels digest (prose only)', text, updated: 1, rev: 1, workspaceId: 'ws_local', proposals } }))
  }, [WALL, [chart], DOC_ID] as const)
  await page.goto(`/doc/${DOC_ID}`)
  await expect(page.locator('.doc-title')).toHaveText('Reels digest (prose only)')
  const toast = page.getByRole('status').filter({ hasText: 'Connect an agent' })
  if (await toast.isVisible()) await toast.getByRole('button', { name: 'Dismiss' }).click()
  return () => modelCalls
}

test('a chart suggestion draws its chart in place and keeps the original paragraph visible', async ({ page }) => {
  test.skip(FLAG_OFF, 'default build only')
  await seed(page)
  await page.getByRole('button', { name: /Checks/ }).click()
  const panel = page.getByRole('complementary', { name: 'Checks' })
  await panel.getByRole('button', { name: /^Opens as a chart/ }).click()
  await expect(page.locator('.doc-editing')).toBeVisible()
  const widget = page.locator('.doc-proposal-widget')
  await expect(widget).toContainText('Opens as a chart')
  await expect(widget.locator('[data-chart]')).toBeVisible({ timeout: 15_000 })
  // Insert mode adds beside the paragraph: it is marked, not hidden.
  await expect(page.locator('.doc-proposal-marked')).not.toHaveCount(0)
  await expect(page.locator('.doc-proposal-hidden')).toHaveCount(0)
})

test('flag off: no margin marks, no model call; code checks and a stored agent suggestion stay', async ({ page }) => {
  test.skip(!FLAG_OFF, 'needs VITE_DOC_BLOCK_SUGGESTIONS=0 on the dev server')
  const calls = await seed(page)
  await expect(page.locator('.doc-sugg')).toHaveCount(0)
  await page.getByRole('button', { name: /Checks/ }).click()
  const panel = page.getByRole('complementary', { name: 'Checks' })
  await expect(panel).toBeVisible()
  // The agent's own stored suggestion stays listed and can be opened from the panel; only Occam's ready-made ones and the marks go.
  await expect(panel.getByRole('button', { name: /^Opens as a chart/ })).toBeVisible()
  await expect(panel).not.toContainText('Looking')
  await expect(page.getByText('Reads as a wall of text')).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('.doc-editing')).toBeVisible()
  await expect(page.locator('.doc-sugg')).toHaveCount(0)
  expect(calls()).toBe(0)
})
