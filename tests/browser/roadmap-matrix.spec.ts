import { test, expect } from '@playwright/test'
import { addStatusFilter, openFreshRoadmap, seedSixIssues, seedWorkedMatrix, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

type Page = import('@playwright/test').Page

/** Picks an option from one of Display's dropdowns. */
async function pick(page: Page, row: string, option: string) {
  await page.getByLabel('Display settings').getByRole('combobox', { name: row }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function configureMatrixDisplay(page: Page) {
  await page.getByRole('button', { name: 'Display' }).click()
  await pick(page, 'Group by', 'Workstream')
  await pick(page, 'Columns', 'Country')
  await page.keyboard.press('Escape')
}

test('empty roadmap can open matrix layout', async ({ page }) => {
  await openFreshRoadmap(page)
  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await expect(page.getByRole('heading', { name: 'The matrix needs a field' })).toBeVisible()
})

test('Display picks apply while Matrix is open', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await page.getByRole('button', { name: 'Display' }).click()
  await pick(page, 'Columns', 'Country')
  await expect(page.getByLabel('Display settings').getByRole('combobox', { name: 'Columns' })).toHaveText('Country')
  await expect(page.getByRole('region', { name: 'Matrix' }).getByRole('columnheader', { name: 'UK' })).toBeVisible()
})

test('switches to Matrix and keeps settings after reload', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await expect(nav.getByRole('button', { name: 'Matrix' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Matrix' })).toBeVisible()

  await page.getByRole('button', { name: 'Display' }).click()
  await pick(page, 'Columns', 'Country')
  const colPick = page.getByLabel('Display settings').getByRole('combobox', { name: 'Columns' })
  await expect(colPick).toHaveText('Country')

  await page.keyboard.press('Escape')
  await page.reload()
  await expect(nav.getByRole('button', { name: 'Matrix' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Matrix' })).toBeVisible()

  await page.getByRole('button', { name: 'Display' }).click()
  await expect(colPick).toHaveText('Country')
  await page.keyboard.press('Escape')

  await nav.getByRole('button', { name: 'List' }).click()
  await expect(page.getByRole('region', { name: 'Matrix' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
})

test('worked tree shows country columns and opens from a cell', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await configureMatrixDisplay(page)

  const matrix = page.getByRole('region', { name: 'Matrix' })
  await expect(matrix.getByRole('columnheader', { name: 'UK' })).toBeVisible()
  await expect(matrix.getByRole('columnheader', { name: 'France' })).toBeVisible()
  await expect(matrix.getByRole('columnheader', { name: 'Singapore' })).toBeVisible()

  const parentRow = matrix.locator('tr[data-matrix-row="U"]')
  await parentRow.getByRole('button', { name: /Open SCL-2.*UK/ }).click()
  await expect(page.getByRole('complementary', { name: 'Issue panel' })).toBeVisible()
  await expect(page.getByText('SCL-2').first()).toBeVisible()
})

test('blocked filter pivots the UK cell to Chase', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await configureMatrixDisplay(page)

  await addStatusFilter(page, 'Blocked')

  const matrix = page.getByRole('region', { name: 'Matrix' })
  await expect(matrix.getByRole('columnheader', { name: 'UK' })).toBeVisible()
  await expect(matrix.getByRole('columnheader', { name: 'France' })).toBeHidden()

  const parentRow = matrix.locator('tr[data-matrix-row="U"]')
  await expect(parentRow.getByRole('button', { name: /Open SCL-4 Chase.*UK/ })).toBeVisible()
})

test('duplicate country row then set field shows it in the matrix', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await configureMatrixDisplay(page)
  const matrix = page.getByRole('region', { name: 'Matrix' })
  await expect(matrix.getByRole('columnheader', { name: 'UK' })).toBeVisible()
  await expect(matrix.getByRole('button', { name: 'Duplicate' })).toHaveCount(0)

  await nav.getByRole('button', { name: 'List' }).click()
  const ukRow = page.locator('tr[data-issue-id="U-uk"]')
  await ukRow.getByLabel('Select Underwriting').check()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByText('3 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Set field' }).click()
  await page.getByRole('menuitem', { name: 'Country' }).focus()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('menuitem', { name: /Singapore/ }).click()
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0)

  await nav.getByRole('button', { name: 'Matrix' }).click()
  await expect(matrix.getByRole('columnheader', { name: 'Singapore' })).toBeVisible()
  await matrix.locator('tr[data-matrix-row="U"]').getByRole('button', { name: /^Expand/ }).click()
  await expect(matrix.getByRole('button', { name: /Open SCL-7 Underwriting.* in Singapore/ })).toBeVisible()
})

test('Matrix opens already configured: the second choice field makes the columns', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  const matrix = page.getByRole('region', { name: 'Matrix' })
  await expect(matrix.getByRole('columnheader', { name: 'UK' })).toBeVisible()
  await expect(matrix.getByRole('columnheader', { name: 'France' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The matrix needs a field' })).toHaveCount(0)
})

test('arrows move between cells and Enter opens the focused one', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedWorkedMatrix(page)
  await page.reload()

  await page.getByRole('navigation', { name: 'Roadmap views' }).getByRole('button', { name: 'Matrix' }).click()
  const matrix = page.getByRole('region', { name: 'Matrix' })
  const first = matrix.locator('[data-matrix-cell]').first()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  const moved = matrix.locator('[data-matrix-cell]:focus')
  await expect(moved).toHaveCount(1)
  await expect(moved).not.toHaveAttribute('data-matrix-cell', (await first.getAttribute('data-matrix-cell')) ?? '')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Issue panel' })).toBeVisible()
})
