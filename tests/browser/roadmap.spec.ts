/* Roadmaps on the dev account: create from the sidebar, empty table screen, kept across reload. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const EMPTY = 'No issues yet. Press C or New issue to add the first.'

async function openFreshRoadmap(page: import('@playwright/test').Page, { checkPrefix = false } = {}) {
  await page.goto('/new')
  await page.getByRole('button', { name: /^(Show|Hide) the sidebar$/ }).waitFor()
  const show = page.getByRole('button', { name: 'Show the sidebar' })
  if (await show.isVisible()) await show.click()
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'New page' }).click()
  await page.getByRole('menuitem', { name: 'New roadmap' }).click()
  const dialog = page.getByRole('dialog', { name: 'New roadmap' })
  await dialog.getByLabel('Name').fill('SME credit launch')
  if (checkPrefix) await expect(dialog.getByLabel('Prefix')).toHaveValue('SCL')
  await dialog.getByRole('button', { name: 'Create roadmap' }).click()
  await expect(page).toHaveURL(/\/r\/rm_[\w-]+$/)
  await expect(page.getByText(EMPTY)).toBeVisible()
}

test('creates a roadmap from the sidebar and shows the empty table screen', async ({ page }) => {
  await openFreshRoadmap(page, { checkPrefix: true })
  const showAgain = page.getByRole('button', { name: 'Show the sidebar' })
  if (await showAgain.isVisible()) await showAgain.click()
  const row = page.getByRole('tree', { name: 'Pages' }).getByRole('treeitem').filter({ hasText: 'SME credit launch' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(EMPTY)).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/r\/rm_[\w-]+$/)
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(EMPTY)).toBeVisible()
})

test('adds a choice field from Fields and shows it in the table header', async ({ page }) => {
  await openFreshRoadmap(page)
  await page.getByRole('button', { name: 'Fields' }).click()
  const fields = page.getByRole('dialog', { name: 'Fields' })
  await fields.getByRole('button', { name: 'Add field' }).click()
  await page.getByRole('menuitem', { name: 'Choice' }).click()
  await fields.getByLabel('Field name').fill('Country')
  await fields.getByLabel('Field name').blur()
  await fields.getByLabel('Emoji for Option').fill('🇬🇧')
  await fields.getByLabel('Option name').fill('UK')
  await fields.getByLabel('Option name').blur()
  await fields.getByRole('button', { name: 'Add option' }).click()
  await fields.getByLabel('Option name').nth(1).fill('France')
  await fields.getByLabel('Option name').nth(1).blur()
  await fields.getByLabel('Emoji for France').fill('🇫🇷')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'Country' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Fields' }).click()
  const fieldsAgain = page.getByRole('dialog', { name: 'Fields' })
  await fieldsAgain.getByRole('button', { name: 'Delete France' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete “France”?' })
  await expect(confirm).toContainText('0 issues')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(fieldsAgain.getByRole('button', { name: 'Delete France' })).toHaveCount(0)
})

const ROADMAPS_KEY = 'smartchart.roadmaps.v1'

async function seedSixIssues(page: import('@playwright/test').Page) {
  const id = /\/r\/(rm_[\w-]+)/.exec(page.url())?.[1]
  if (!id) throw new Error('Expected a roadmap URL')
  await page.evaluate(
    ({ roadmapId, key }) => {
      const now = Date.now()
      const row = (over: Record<string, unknown>) => ({
        parentId: null,
        sortKey: 'a',
        title: 'Issue',
        status: 'todo',
        assignee: null,
        start: null,
        due: null,
        fields: {},
        bodyRev: 0,
        seq: 1,
        createdBy: 'local',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        body: '',
        comments: [],
        ...over,
      })
      const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, {
        issues: unknown[]
        fields: unknown[]
        nextNumber: number
        seq: number
      }>
      const rm = all[roadmapId]
      if (!rm) return
      rm.fields = [
        {
          id: 'f_country',
          name: 'Country',
          type: 'choice',
          options: [
            { id: 'uk', name: 'UK', emoji: '🇬🇧' },
            { id: 'fr', name: 'France', emoji: '🇫🇷' },
          ],
        },
      ]
      rm.issues = [
        row({ id: 'i_uk', number: 1, sortKey: 'a', title: 'UK launch', fields: { f_country: 'uk' } }),
        row({ id: 'i_done', number: 2, sortKey: 'b', parentId: 'i_uk', title: 'Shipped piece', status: 'done' }),
        row({ id: 'i_blk', number: 3, sortKey: 'c', parentId: 'i_uk', title: 'Blocked piece', status: 'blocked' }),
        row({ id: 'i_fr', number: 4, sortKey: 'd', title: 'France launch', fields: { f_country: 'fr' } }),
        row({ id: 'i_fr_a', number: 5, sortKey: 'e', parentId: 'i_fr', title: 'France task A' }),
        row({ id: 'i_fr_b', number: 6, sortKey: 'f', parentId: 'i_fr', title: 'France task B', status: 'in_progress' }),
      ]
      rm.nextNumber = 7
      rm.seq = 6
      localStorage.setItem(key, JSON.stringify(all))
    },
    { roadmapId: id, key: ROADMAPS_KEY },
  )
}

test('table nesting, filters, grouping and saved view', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()
  await expect(page.getByText('UK launch')).toBeVisible()
  await expect(page.getByText('Shipped piece')).toBeVisible()
  await expect(page.getByText('France task A')).toBeVisible()

  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Status is Blocked', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Status is Blocked' })).toBeVisible()
  await expect(page.getByText('Blocked piece')).toBeVisible()
  await expect(page.locator('tr', { hasText: 'UK launch' })).toHaveClass(/opacity-45/)
  await page.getByRole('button', { name: 'Remove Status is Blocked' }).click()

  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Status is not Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Status is not Done' })).toBeVisible()
  await expect(page.getByText('Shipped piece')).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove Status is not Done' }).click()
  await expect(page.getByText('Shipped piece')).toBeVisible()

  await page.getByRole('button', { name: 'Collapse UK launch' }).click()
  await expect(page.getByText('Shipped piece')).toHaveCount(0)

  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Status is not Done', exact: true }).click()

  await page.getByRole('button', { name: 'Display' }).click()
  await page.getByLabel('Display settings').getByRole('button', { name: 'Country' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('span.font-medium', { hasText: /^UK$/ })).toBeVisible()
  await expect(page.locator('span.font-medium', { hasText: /^France$/ })).toBeVisible()
  await expect(page.getByText('Group by', { exact: false }).filter({ hasText: 'Country' }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove Status is not Done' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Group by.*Country/)).toBeVisible()
})

async function seedParentWithChildren(page: import('@playwright/test').Page) {
  const id = /\/r\/(rm_[\w-]+)/.exec(page.url())?.[1]
  if (!id) throw new Error('Expected a roadmap URL')
  await page.evaluate(
    ({ roadmapId, key }) => {
      const now = Date.now()
      const row = (over: Record<string, unknown>) => ({
        parentId: null,
        sortKey: 'a',
        title: 'Issue',
        status: 'todo',
        assignee: null,
        start: null,
        due: null,
        fields: {},
        bodyRev: 0,
        seq: 1,
        createdBy: 'local',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        body: '',
        comments: [],
        ...over,
      })
      const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, { issues: unknown[]; nextNumber: number; seq: number }>
      const rm = all[roadmapId] as { issues: unknown[]; nextNumber: number; seq: number; fields: unknown[] }
      if (!rm) return
      rm.issues = [
        row({ id: 'i_parent', number: 1, sortKey: 'a', title: 'Parent work', status: 'in_progress' }),
        row({ id: 'i_c1', number: 2, sortKey: 'b', parentId: 'i_parent', title: 'Child one' }),
        row({ id: 'i_c2', number: 3, sortKey: 'c', parentId: 'i_parent', title: 'Child two' }),
        row({ id: 'i_other', number: 4, sortKey: 'd', title: 'Other task', status: 'todo' }),
        row({ id: 'i_pick', number: 5, sortKey: 'e', title: 'Pick me', status: 'todo' }),
      ]
      rm.nextNumber = 6
      rm.seq = 5
      localStorage.setItem(key, JSON.stringify(all))
    },
    { roadmapId: id, key: ROADMAPS_KEY },
  )
}

test('edits in place, keyboard, bulk actions, delete undo and failed save', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smartchart.roadmapWriteGate', '1'))
  await openFreshRoadmap(page)
  await seedParentWithChildren(page)
  await page.reload()
  await page.getByRole('table').waitFor()

  let gate: { delay: number; fail: boolean } = { delay: 1000, fail: false }
  await page.route('**/api/roadmaps?writeGate=1**', async (route) => {
    await new Promise((r) => setTimeout(r, gate.delay))
    if (gate.fail) await route.fulfill({ status: 500, body: 'fail' })
    else await route.fulfill({ status: 204, body: '' })
  })

  const parent = page.locator('tr', { hasText: 'Parent work' })
  await parent.getByRole('button', { name: 'Status: In progress' }).click()
  await page.getByLabel('Choose status').getByRole('option', { name: 'Done' }).click()
  await expect(parent.getByRole('button', { name: 'Status: Done' })).toBeVisible({ timeout: 500 })

  await page.locator('tr', { hasText: 'Other task' }).click()
  await page.keyboard.press('c')
  await page.getByLabel('New issue title').fill('Fresh item')
  await page.keyboard.press('Enter')
  await expect(page.getByText('SCL-6')).toBeVisible({ timeout: 10_000 })

  const rowA = page.locator('tr', { hasText: 'Child one' })
  const rowB = page.locator('tr', { hasText: 'Child two' })
  await rowA.getByLabel('Select Child one').check()
  await rowB.getByLabel('Select Child two').check()
  await page.getByRole('button', { name: 'Set status' }).click()
  await page.getByLabel('Status', { exact: true }).getByRole('option', { name: 'Done' }).click()
  await expect(rowA.getByRole('button', { name: 'Status: Done' })).toBeVisible({ timeout: 10_000 })
  await expect(rowB.getByRole('button', { name: 'Status: Done' })).toBeVisible()

  await parent.getByLabel('Select Parent work').check()
  await page.getByText('1 selected').locator('..').getByRole('button', { name: 'Delete' }).click()
  const deleteDialog = page.getByRole('dialog', { name: /Delete Parent work/ })
  await expect(deleteDialog).toContainText('and 2 sub-issues')
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Child one')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Child one')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Child two')).toBeVisible()

  gate = { delay: 0, fail: true }
  const pick = page.locator('tr', { hasText: 'Pick me' })
  await expect(pick).toBeVisible()
  await pick.getByRole('button', { name: 'Status: To do' }).click()
  await page.getByLabel('Choose status').getByRole('option', { name: 'In progress' }).click()
  await expect(pick.getByRole('button', { name: 'Status: To do' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/offline|couldn't be reached|server can't be reached|Couldn’t save/i)).toBeVisible()
})

test('issue panel, body edit, comment, full page and sub-issue', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedParentWithChildren(page)
  await page.reload()
  await page.getByRole('table').waitFor()

  const row = page.locator('tr', { hasText: 'Parent work' })
  await row.click()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('complementary', { name: 'Issue panel' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('SCL-1')).toBeVisible()
  await expect(panel.getByLabel('Issue title')).toHaveValue('Parent work')

  await panel.getByRole('button', { name: /Assignee:/ }).click()
  await page.getByLabel('Choose assignee').getByRole('option', { name: 'You' }).click()
  await expect(row.getByRole('button', { name: 'Assignee: You' })).toBeVisible({ timeout: 5000 })

  await panel.getByRole('button', { name: 'Add a description…' }).click()
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor()
  await editor.locator('p:not(.doc-sub)').first().click()
  await page.keyboard.type('Launch checklist paragraph.')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Edit' }).waitFor({ timeout: 15_000 })
  await expect(panel.getByText('Launch checklist paragraph.')).toBeVisible()

  await panel.getByLabel('Comment').fill('Ship when ready.')
  await panel.getByRole('button', { name: 'Post' }).click()
  const activity = panel.getByRole('region', { name: 'Activity' })
  await expect(activity.getByText(/created/)).toBeVisible()
  await expect(activity.getByText(/Ship when ready/)).toBeVisible()

  const roadmapUrl = page.url()
  const issueId = await row.getAttribute('data-issue-id')
  if (!issueId) throw new Error('missing issue id')
  await panel.getByRole('button', { name: 'Open full page' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/[^/]+/${issueId}$`))
  await expect(page.getByLabel('Issue title')).toHaveValue('Parent work')
  await expect(page.getByText('Launch checklist paragraph.')).toBeVisible()

  await page.goto(roadmapUrl)
  await row.click()
  await page.keyboard.press('Enter')
  await page.getByRole('complementary', { name: 'Issue panel' }).getByRole('button', { name: 'Add sub-issue' }).click()
  await panel.getByLabel('New sub-issue title').fill('Panel child')
  await page.keyboard.press('Enter')
  await expect(page.locator('tr', { hasText: 'Panel child' })).toBeVisible()

  await page.reload()
  await row.click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Issue panel' }).getByText('Launch checklist paragraph.')).toBeVisible()
})

test('apple-bar 1440 table and panel', async ({ page }) => {
  test.skip(!process.env.APPLE_BAR_CAPTURE, 'Set APPLE_BAR_CAPTURE=1 to refresh docs/temp screenshot')
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()
  await page.getByRole('button', { name: 'Hide the sidebar' }).click()
  await page.getByRole('row', { name: /UK launch/ }).click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Issue panel' })).toBeVisible()
  await page.screenshot({ path: 'docs/temp/roadmap-m1-table-panel-1440.png' })
})
