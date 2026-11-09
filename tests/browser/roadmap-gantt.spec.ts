import { test, expect } from '@playwright/test'
import { openFreshRoadmap, seedSixIssues, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

test('switches to Gantt and keeps it after reload', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  await expect(nav.getByRole('button', { name: 'Gantt' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Timeline' })).toBeVisible()
  const scale = page.getByRole('radiogroup', { name: 'Scale' })
  await expect(scale.getByRole('radio', { name: 'Month' })).toBeChecked()

  await scale.getByRole('radio', { name: 'Quarter' }).click()
  await page.reload()
  await expect(nav.getByRole('button', { name: 'Gantt' })).toHaveAttribute('aria-pressed', 'true')
  await expect(scale.getByRole('radio', { name: 'Quarter' })).toBeChecked()

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
})
