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

async function dragOnLane(
  page: import('@playwright/test').Page,
  issueId: string,
  dx: number,
  from: 'center' | 'left' | 'right' = 'center',
) {
  await page.evaluate(
    ({ id, dx, from }) => {
      const laneEl = document.querySelector(`[data-issue="${id}"]`) as HTMLElement | null
      const bar = laneEl?.querySelector('rect')
      if (!laneEl || !bar) throw new Error(`No bar for ${id}`)
      const r = bar.getBoundingClientRect()
      let x = r.left + r.width / 2
      if (from === 'left') x = r.left + 3
      if (from === 'right') x = r.right - 3
      const y = r.top + r.height / 2
      const down = (type: string, cx: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: y,
          button: 0,
          pointerId: 1,
          isPrimary: true,
          pointerType: 'mouse',
        })
      laneEl.dispatchEvent(down('pointerdown', x))
      for (let i = 1; i <= 5; i++) {
        window.dispatchEvent(down('pointermove', x + (dx * i) / 5))
      }
      window.dispatchEvent(down('pointerup', x + dx))
    },
    { id: issueId, dx, from },
  )
}

test('drags a bar, its end, and a click still opens', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page, {
    i_fr_b: { start: '2026-12-01', due: '2026-12-10' },
  })
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  const lane = (id: string) => page.getByRole('region', { name: 'Timeline' }).locator(`[data-issue="${id}"]`)
  await lane('i_fr_b').waitFor()
  await page.evaluate((id) => {
    const laneEl = document.querySelector(`[data-issue="${id}"]`)
    const scroll = laneEl?.closest('.overflow-auto') as HTMLElement | null
    if (!laneEl || !scroll) return
    const laneRect = laneEl.getBoundingClientRect()
    const box = scroll.getBoundingClientRect()
    if (laneRect.left < box.left + 340) scroll.scrollLeft -= box.left + 340 - laneRect.left
    if (laneRect.right > box.right - 8) scroll.scrollLeft += laneRect.right - box.right + 24
  }, 'i_fr_b')

  await dragOnLane(page, 'i_fr_b', 60)

  await nav.getByRole('button', { name: 'Table' }).click()
  const row = page.locator('tr', { hasText: 'France task B' })
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-11' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-20' })).toBeVisible()

  await nav.getByRole('button', { name: 'Gantt' }).click()
  await dragOnLane(page, 'i_fr_b', -30, 'right')

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-11' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-15' })).toBeVisible()

  await nav.getByRole('button', { name: 'Gantt' }).click()
  await dragOnLane(page, 'i_fr_b', 300, 'left')
  await expect(lane('i_fr_b')).toHaveAttribute('data-mark', 'milestone')

  await lane('i_fr_b').click()
  const panel = page.getByRole('complementary', { name: 'Issue panel' })
  await expect(panel).toBeVisible()
  const activity = panel.getByRole('region', { name: 'Activity' })
  await expect(activity.getByText(/set dates/i)).toHaveCount(3)

  const linesBefore = await activity.getByText(/set dates/i).count()
  await dragOnLane(page, 'i_fr_b', 2)
  await expect(panel).toBeVisible()
  await expect(activity.getByText(/set dates/i)).toHaveCount(linesBefore)

  await page.evaluate(() => localStorage.setItem('smartchart.roadmapWriteGate', '1'))
  await page.route('**/api/roadmaps?writeGate=1**', async (route) => {
    await route.fulfill({ status: 500, body: 'fail' })
  })

  await dragOnLane(page, 'i_fr_b', 12)
  await expect(lane('i_fr_b')).toHaveAttribute('data-mark', 'milestone')
  await expect(page.getByText(/offline|couldn't be reached|server can't be reached|Couldn’t save/i)).toBeVisible({ timeout: 10_000 })
  await expect(lane('i_fr_b')).toHaveAttribute('data-mark', 'milestone')

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-15' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-15' })).toBeVisible()
})
