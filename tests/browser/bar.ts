/* The bar's menus, as a person reaches them: the page's ⋯ beside its name, and Appearance from the avatar. */
import { expect, type Page } from '@playwright/test'

/** Picks an item from the deck's or doc's ⋯ menu. */
export async function pageMenu(page: Page, noun: 'deck' | 'doc', item: string) {
  await page.getByRole('button', { name: noun === 'deck' ? 'Deck menu' : 'Doc menu' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** The deck's writing style radio in its ⋯ menu (Writing style ▸ Consulting / Pitch). */
export async function writingStyle(page: Page, style: 'Consulting' | 'Pitch') {
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Writing style' }).hover()
  return page.getByRole('menuitemradio', { name: style })
}

/** Opens Appearance (app chrome, slides palette and accent) from the avatar menu and returns its popover. */
export async function appearance(page: Page) {
  await page.getByRole('button', { name: /^Account/ }).click()
  await page.getByRole('menuitem', { name: 'Appearance…' }).click()
  const pop = page.getByRole('dialog', { name: 'Appearance' })
  await expect(pop).toBeVisible()
  return pop
}
