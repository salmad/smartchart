/* Doc checks a writer can act on: one honest count, each check under its block, a pick that shows the block, Dismiss kept
   with the doc, the figure badge opening its check, and Ask Occam to fix arriving as a suggestion to review. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page, type Route } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/docs/checks.md')
// Two sections, each with a chart (so the doc does not read as a wall of text), one chart with no source (R8), one long
// paragraph (D4): the case where the panel used to say "Reads well" beside an orange figure badge.
const TEXT = readFileSync(FIX, 'utf8')
const DOC_ID = 'doc_checks'
const NO_SOURCE = /Figures with no source/

async function seed(page: Page, opts: { live?: boolean } = {}) {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, live: !!opts.live } }))
  await page.route('**/api/glm**', (r) => r.fulfill({ json: { choices: [{ message: { content: '{"proposals":[]}' } }] } }))
  await page.goto('/')
  await page.evaluate(([text, id]) => {
    localStorage.setItem('smartchart.docs.v1', JSON.stringify({ [id]: { id, name: 'Pricing review', text, updated: 1, rev: 1, workspaceId: 'ws_local' } }))
  }, [TEXT, DOC_ID] as const)
  await page.goto(`/doc/${DOC_ID}`)
  await expect(page.locator('.doc-title')).toHaveText('Pricing review')
  const toast = page.getByRole('status').filter({ hasText: 'Connect an agent' })
  if (await toast.isVisible()) await toast.getByRole('button', { name: 'Dismiss' }).click()
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Checks' })
const openPanel = async (page: Page) => {
  await page.getByRole('button', { name: /^Checks/ }).click()
  await expect(panel(page)).toBeVisible()
}
const summary = (page: Page) => panel(page).locator('[data-check-summary]')
const quietStored = (page: Page) => page.evaluate((id) => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { quiet?: string[] }>)[id]?.quiet ?? [], DOC_ID)

test('one honest count: figure warnings keep the panel from saying Reads well, and the bar says the same', async ({ page }) => {
  await seed(page)
  await openPanel(page)
  await expect(summary(page)).toHaveText('2 checks')
  await expect(page.getByRole('button', { name: 'Checks, 2 checks' })).toBeVisible()
  await expect(panel(page)).not.toContainText('Reads well')
  // Each check sits under the block it is about, named in the doc's words.
  await expect(panel(page).getByRole('region', { name: 'Chart “Mid-market revenue · £m”' })).toContainText(NO_SOURCE)
  await expect(panel(page).getByRole('region', { name: 'Paragraph in “What changed”' })).toContainText('112 words')
})

test('picking a check shows its block; Dismiss is kept with the doc and Restore brings it back', async ({ page }) => {
  await seed(page)
  await openPanel(page)
  await panel(page).getByRole('button', { name: NO_SOURCE }).click()
  const fig = page.locator('.doc figure#fig_mix')
  await expect(fig).toHaveClass(/doc-ring/)
  await expect(fig).toBeInViewport()
  await panel(page).getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(summary(page)).toHaveText('1 check')
  await expect(fig).not.toHaveClass(/doc-ring/)
  await expect(fig.locator('.fig-checks')).toBeHidden()
  await expect.poll(() => quietStored(page)).toHaveLength(1)

  // Kept per doc: still dismissed after a reload.
  await page.reload()
  await openPanel(page)
  await expect(summary(page)).toHaveText('1 check')
  await expect(page.locator('.doc figure#fig_mix .fig-checks')).toBeHidden()
  await panel(page).getByRole('button', { name: '1 dismissed' }).click()
  await panel(page).getByRole('button', { name: 'Restore' }).click()
  await expect(summary(page)).toHaveText('2 checks')
  await expect(page.locator('.doc figure#fig_mix .fig-checks')).toBeVisible()
  await expect.poll(() => quietStored(page)).toHaveLength(0)
})

test('only when nothing is open does the panel say Reads well', async ({ page }) => {
  await seed(page)
  await openPanel(page)
  for (const name of [NO_SOURCE, /112 words/]) {
    await panel(page).getByRole('button', { name }).click()
    await panel(page).getByRole('button', { name: 'Dismiss', exact: true }).click()
  }
  await expect(summary(page)).toHaveText('Reads well')
})

test('a message in a figure badge opens its check in the panel and rings the figure', async ({ page }) => {
  await seed(page)
  const badge = page.locator('.doc figure#fig_mix .fig-checks')
  await badge.locator('summary').click()
  await badge.getByRole('button', { name: NO_SOURCE }).click()
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: NO_SOURCE })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.doc figure#fig_mix')).toHaveClass(/doc-ring/)
})

test('Ask Occam to fix: a propose-only agent turn, back as a suggestion to review in place', async ({ page }) => {
  const turns: { tools: string[]; asked: string }[] = []
  await seed(page, { live: true })
  // The agent: one propose_block on the figure (the same chart with a source line), then a sentence.
  let step = 0
  await page.route('**/api/glm**', async (r: Route) => {
    const body = r.request().postDataJSON() as { tools?: { function: { name: string } }[]; messages: { role: string; content: string }[] }
    if (!body.tools) return r.fulfill({ json: { choices: [{ message: { content: '{"proposals":[]}' } }] } })
    if (step++ === 0) {
      turns.push({ tools: body.tools.map((t) => t.function.name), asked: body.messages.at(-1)?.content ?? '' })
      const figure = { kind: 'chart', body: { caption: 'Mid-market revenue · £m', source: 'Company filings', chart: { categories: ['2023', '2024', '2025'], format: '£{v}m', series: [{ name: 'Revenue', mark: 'bar', color: 'focus', values: [12, 18, 25] }] } } }
      const args = { blockIds: ['fig_mix'], mode: 'replace', figure, label: 'Add the source', why: 'The chart names no source.' }
      return r.fulfill({ json: { choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'propose_block', arguments: JSON.stringify(args) } }] } }] } })
    }
    return r.fulfill({ json: { choices: [{ message: { content: 'I left a suggestion that adds the source.' } }] } })
  })
  // The server's propose_block, on this browser's dev store.
  await page.route('**/api/tool', async (r: Route) => {
    const { name, input } = r.request().postDataJSON() as { name: string; input: Record<string, unknown> }
    if (name !== 'propose_block') return r.fulfill({ json: {} })
    await page.evaluate(([id, p]) => {
      const all = JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { proposals?: unknown[] }>
      all[id].proposals = [...(all[id].proposals ?? []), { ...p, id: 'p_fix', by: 'Occam', at: 2, rev: 1 }]
      localStorage.setItem('smartchart.docs.v1', JSON.stringify(all))
    }, [DOC_ID, input] as const)
    return r.fulfill({ json: { proposed: 'p_fix', keeps: 'all', mode: 'replace' } })
  })

  await openPanel(page)
  await panel(page).getByRole('button', { name: NO_SOURCE }).click()
  await panel(page).getByRole('button', { name: 'Ask Occam to fix' }).click()
  await expect(panel(page)).toContainText('Occam left a suggestion: Add the source')
  // The agent could only read and propose; it was told the check, the block and that the writer agrees.
  expect(turns[0].tools).toContain('propose_block')
  expect(turns[0].tools).not.toContain('update_block')
  expect(turns[0].asked).toContain('fig_mix')
  expect(turns[0].asked).toContain('I agree with this check')
  // Nothing was written: the doc is as it was until the writer approves.
  expect(await page.evaluate((id) => (JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { text: string }>)[id].text, DOC_ID)).toBe(TEXT)

  await panel(page).getByRole('button', { name: 'Review suggestion' }).click()
  await expect(page.locator('.doc-editing')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
})

test('on a phone, a picked block shows above the checks sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page)
  await openPanel(page)
  await panel(page).getByRole('button', { name: NO_SOURCE }).click()
  const fig = await page.locator('.doc figure#fig_mix').boundingBox(), sheet = await panel(page).boundingBox()
  expect(fig && sheet && fig.y >= 0 && fig.y < sheet.y).toBeTruthy()
})
