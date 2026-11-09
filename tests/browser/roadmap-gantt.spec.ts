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

function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return iso.slice(0, 4) === today.slice(0, 4) ? day : `${day} ${iso.slice(0, 4)}`
}

test('draws bars, a bracket, a milestone and alert labels', async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayIso = yesterday.toISOString().slice(0, 10)

  await openFreshRoadmap(page)
  await seedSixIssues(page, {
    i_done: { start: '2026-10-01', due: '2026-10-20', status: 'done' },
    i_blk: { start: '2026-10-05', due: yesterdayIso, status: 'blocked' },
    i_fr_a: { start: '2027-04-01', due: '2027-04-01' },
    i_fr_b: { start: undefined, due: undefined },
  })
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  const timeline = page.getByRole('region', { name: 'Timeline' })
  await expect(timeline).toBeVisible()

  const lane = (id: string) => timeline.locator(`[data-issue="${id}"]`)
  await expect(lane('i_uk')).toHaveAttribute('data-mark', 'bracket')
  await expect(lane('i_done')).toHaveAttribute('data-mark', 'bar')
  await expect(lane('i_done')).toHaveAttribute('data-done', 'true')
  await expect(lane('i_blk')).toHaveAttribute('data-alert', 'true')
  await expect(lane('i_blk')).toContainText('Overdue 1 day · blocked')
  await expect(lane('i_fr_a')).toHaveAttribute('data-mark', 'milestone')
  await expect(lane('i_fr_a')).toContainText('France task A · 1 Apr')
  await expect(timeline.locator('[data-list-issue="i_fr_b"]')).toContainText('No dates')

  const todayLine = page.getByRole('separator', { name: shortDate(today, today) })
  await expect(todayLine).toBeVisible()
  await expect(todayLine).toBeInViewport()

  await timeline.getByRole('button', { name: 'Collapse UK launch' }).click()
  await expect(lane('i_done')).toHaveCount(0)
  await expect(lane('i_blk')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByText('Shipped piece')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Gantt' }).click()
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Status is Blocked', exact: true }).click()
  await expect(timeline.locator('[data-list-issue="i_uk"]')).toHaveAttribute('data-dim', 'true')
  await expect(page.getByText('Blocked piece')).toBeVisible()

  await page.getByRole('button', { name: 'Remove Status is Blocked' }).click()
  await timeline.getByRole('button', { name: 'Expand UK launch' }).click()
  await lane('i_done').click()
  await expect(page.getByRole('complementary', { name: 'Issue panel' })).toBeVisible()
})
