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
  await page.getByRole('button', { name: 'Country' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('span.font-medium', { hasText: /^UK$/ })).toBeVisible()
  await expect(page.locator('span.font-medium', { hasText: /^France$/ })).toBeVisible()
  await expect(page.getByText('Group by', { exact: false }).filter({ hasText: 'Country' }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove Status is not Done' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Group by.*Country/)).toBeVisible()
})
