import { test, expect } from '@playwright/test'
import { openFreshRoadmap, seedSixIssues, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

test('set up sprints, put an issue in the current sprint, and see it in the Sprint view', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Sprint' }).click()
  const sprint = page.getByRole('region', { name: 'Sprint' })
  await expect(sprint.getByText("Sprints aren't set up for this roadmap.")).toBeVisible()

  await sprint.getByRole('button', { name: 'Set up sprints' }).click()
  await page.getByRole('dialog', { name: 'Sprint rhythm' }).getByRole('button', { name: 'Start sprints' }).click()
  await expect(sprint.getByRole('heading', { name: /^Sprint 1 · / })).toBeVisible()
  await expect(sprint.getByText('Nothing left in Sprint 1.')).toBeVisible()

  await nav.getByRole('button', { name: 'List' }).click()
  await page.getByText('France task A').click()
  const panel = page.getByRole('complementary', { name: 'Issue panel' })
  await panel.getByRole('button', { name: 'Sprint', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sprint 1 · Current' }).click()
  await expect(panel.getByRole('button', { name: 'Sprint: Sprint 1' })).toBeVisible()

  await nav.getByRole('button', { name: 'Sprint' }).click()
  await expect(sprint.getByText('France task A')).toBeVisible()
  await expect(sprint.getByText('Unassigned')).toBeVisible()
  // The parent shows muted after its task, for context; the task not in the sprint doesn't show.
  await expect(sprint.getByText('France launch')).toBeVisible()
  await expect(sprint.getByText('France task B')).toBeHidden()
})

test('Add tasks picks open tasks from the Sprint view and puts them in the sprint', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Sprint' }).click()
  const sprint = page.getByRole('region', { name: 'Sprint' })
  await sprint.getByRole('button', { name: 'Set up sprints' }).click()
  await page.getByRole('dialog', { name: 'Sprint rhythm' }).getByRole('button', { name: 'Start sprints' }).click()

  await sprint.getByRole('button', { name: 'Add tasks' }).click()
  const picker = page.getByRole('dialog', { name: 'Add tasks to Sprint 1' })
  await expect(picker.getByRole('button', { name: 'Add to Sprint 1' })).toBeDisabled()
  await picker.getByText('France task A').click()
  await picker.getByText('France task B').click()
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/5-add.png` })
  await picker.getByRole('button', { name: 'Add 2 to Sprint 1' }).click()

  await expect(sprint.getByText('France task A')).toBeVisible()
  await expect(sprint.getByText('France task B')).toBeVisible()
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/6-added.png` })
})
