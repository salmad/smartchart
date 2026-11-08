/* A real edit to the open deck, so it saves: opening a deck alone does not, and the palette and accent are the user's
   now, not the deck's. Speaker notes on the first slide, typed in edit mode and saved. */
import type { Page } from '@playwright/test'

export async function editDeck(page: Page, notes = 'Open with the payroll story.') {
  await page.locator('[data-strip-thumb]').first().waitFor()
  await page.keyboard.press('e')
  await page.getByRole('button', { name: 'Add speaker notes' }).click()
  await page.getByPlaceholder(/What you say over this slide/).fill(notes)
  await page.getByRole('button', { name: 'Save' }).click()
}
