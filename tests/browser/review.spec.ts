/* The red-pen review opens from a new deck's chat and from the account menu. The test server has no models, so the
   drop zone says so; reading and reviewing are covered by tests/unit/review.test.ts. */
import { test, expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()

test('the red-pen review opens from the empty chat and the account menu', async ({ page }) => {
  await page.goto('/new')
  await page.getByRole('button', { name: 'Have a deck already? Get a red-pen review' }).click()
  const dialog = page.getByRole('dialog', { name: 'Red-pen review' })
  await expect(dialog).toContainText('Drop a PowerPoint or PDF')
  await expect(dialog).toContainText('The models are not reachable right now.')
  await expect(dialog.getByRole('group', { name: 'Deck style' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Account:/ }).click()
  await page.getByRole('menuitem', { name: 'Review a deck' }).click()
  await expect(page.getByRole('dialog', { name: 'Red-pen review' })).toBeVisible()
})
