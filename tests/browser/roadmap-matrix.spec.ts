import { test, expect } from '@playwright/test'
import { openFreshRoadmap, seedSixIssues, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

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
