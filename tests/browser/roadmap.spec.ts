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
