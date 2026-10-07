/* Cards: a number sits above its title while the slide has room, and beside it when it does not; the text under every
   title starts on one line however long the titles are. */
import { test, expect, type Page } from '@playwright/test'
import type { Slide } from '@/engine/types'
import { signInAsDev } from './dev-account'

signInAsDev()

const load = (page: Page, slides: object[]) => page.evaluate((s) => window.__journey?.load(s, 'consulting'), slides as Slide[])
async function boot(page: Page) {
  await page.route('**/api/health', (r) => r.fulfill({ json: { live: false } }))
  const health = page.waitForResponse('**/api/health')
  await page.goto('/new')
  await page.waitForFunction(() => window.__journey)
  await health
  await page.waitForTimeout(150)
}
const title = 'SMEs choose Acme because it solves three problems their bank leaves open for years on end'
const bullets = ['Banks cap SME cards at £25k and review once a year', 'Acme raises the limit live as revenue grows']

test('numbered cards: the number is above the title with room to spare, and can sit beside it', async ({ page }) => {
  await boot(page)
  await load(page, [{ template: 'cards', lead: 'number', title, cards: [{ title: 'A limit', bullets }, { title: 'One place for the money', bullets }, { title: 'Rewards that pay', bullets }] }])
  await expect(page.locator('[data-links] .cards.numbered')).not.toHaveClass(/inline/)
  // Short of room (a slide fuller than the limits allow) the number moves up beside its title.
  const stacked = await page.locator('[data-links] .cards .num').first().evaluate((n) => n.getBoundingClientRect().bottom <= (n.nextElementSibling?.getBoundingClientRect().top ?? 0) + 1)
  expect(stacked).toBe(true)
  await page.locator('[data-links] .cards.numbered').evaluate((el) => el.classList.add('inline'))
  const beside = await page.locator('[data-links] .cards .num').first().evaluate((n) => Math.abs(n.getBoundingClientRect().top - (n.nextElementSibling?.getBoundingClientRect().top ?? 1e6)) < 20)
  expect(beside).toBe(true)
})

test('the text under every card title starts on one line, whatever the titles’ lengths', async ({ page }) => {
  await boot(page)
  await load(page, [{ template: 'cards', lead: 'number', title, cards: [{ title: 'A limit', bullets }, { title: 'One place for the money and the cards', bullets }, { title: 'Rewards', bullets }] }])
  const tops = await page.locator('[data-links] .cards .card .bullets').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(tops).toHaveLength(3)
  expect(new Set(tops).size).toBe(1)
})

test('L7 warns when a card title runs to two lines, and says which', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/src/dev/review.html?stress=1&style=consulting')
  await page.waitForFunction(() => window.__fit)
  await expect(page.locator('figure').filter({ hasText: 'Stress · cards numbered ×3' }).first()).toContainText(/title of card [\d, ]+ runs to two lines.*\(L7\)/)
})
