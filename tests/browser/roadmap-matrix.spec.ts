import { test, expect } from '@playwright/test'
import { openFreshRoadmap, seedSixIssues, seedWorkedMatrix, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

async function configureMatrixDisplay(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Display' }).click()
  const display = page.getByLabel('Display settings')
  await display.locator('section').filter({ hasText: 'Rows' }).getByRole('button', { name: 'Workstream' }).click()
  const colPick = display.locator('section').filter({ hasText: 'Columns' }).getByRole('button', { name: 'Country', exact: true })
  await colPick.click()
  await page.keyboard.press('Escape')
}

test('switches to Matrix and keeps settings after reload', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Matrix' }).click()
  await expect(nav.getByRole('button', { name: 'Matrix' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Matrix' })).toBeVisible()

  await page.getByRole('button', { name: 'Display' }).click()
  const display = page.getByLabel('Display settings')
  const colPick = display.locator('section').filter({ hasText: 'Columns' }).getByRole('button', { name: 'Country', exact: true })
  await colPick.click()
  await expect(colPick).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await page.reload()
  await expect(nav.getByRole('button', { name: 'Matrix' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Matrix' })).toBeVisible()

  await page.getByRole('button', { name: 'Display' }).click()
  await expect(colPick).toHaveAttribute('aria-pressed', 'true')

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
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

  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Status is Blocked' }).click()

  const matrix = page.getByRole('region', { name: 'Matrix' })
  await expect(matrix.getByRole('columnheader', { name: 'UK' })).toBeVisible()
  await expect(matrix.getByRole('columnheader', { name: 'France' })).toBeHidden()

  const parentRow = matrix.locator('tr[data-matrix-row="U"]')
  await expect(parentRow.getByRole('button', { name: /Open SCL-4 Chase.*UK/ })).toBeVisible()
})
