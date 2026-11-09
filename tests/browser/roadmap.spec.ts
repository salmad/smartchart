/* Roadmaps on the dev account: create from the sidebar, empty table screen, kept across reload. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
test.use({ viewport: { width: 1440, height: 900 } })

const EMPTY = 'No issues yet. Press C or New issue to add the first.'

test('creates a roadmap from the sidebar and shows the empty table screen', async ({ page }) => {
  await page.goto('/new')
  await page.getByRole('button', { name: /^(Show|Hide) the sidebar$/ }).waitFor()
  const show = page.getByRole('button', { name: 'Show the sidebar' })
  if (await show.isVisible()) await show.click()
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'New page' }).click()
  await page.getByRole('menuitem', { name: 'New roadmap' }).click()
  const dialog = page.getByRole('dialog', { name: 'New roadmap' })
  await dialog.getByLabel('Name').fill('SME credit launch')
  await expect(dialog.getByLabel('Prefix')).toHaveValue('SCL')
  await dialog.getByRole('button', { name: 'Create roadmap' }).click()
  await expect(page).toHaveURL(/\/r\/rm_[\w-]+$/)
  const showAgain = page.getByRole('button', { name: 'Show the sidebar' })
  if (await showAgain.isVisible()) await showAgain.click()
  const sidebar = page.getByRole('navigation', { name: 'Workspace' })
  const row = sidebar.locator('[role=treeitem]').filter({ hasText: 'SME credit launch' })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(EMPTY)).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/r\/rm_[\w-]+$/)
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(EMPTY)).toBeVisible()
})
