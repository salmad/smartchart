import { test, expect } from '@playwright/test'
import { addStatusFilter, openFreshRoadmap, seedSixIssues, signInRoadmapTests } from './roadmap-helpers'

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
  const scale = page.getByRole('group', { name: 'Scale' })
  await expect(scale.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')

  await scale.getByRole('button', { name: 'Quarter' }).click()
  await page.reload()
  await expect(nav.getByRole('button', { name: 'Gantt' })).toHaveAttribute('aria-pressed', 'true')
  await expect(scale.getByRole('button', { name: 'Quarter' })).toHaveAttribute('aria-pressed', 'true')

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
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
  // No room for the label beside this bar without crossing the today line: it moves to the tooltip.
  await expect(lane('i_blk')).not.toContainText('Overdue')
  await lane('i_blk').locator('rect[data-bar]').hover()
  await expect(page.getByRole('tooltip')).toContainText('Overdue 1 day · blocked')
  await expect(lane('i_fr_a')).toHaveAttribute('data-mark', 'milestone')
  await expect(lane('i_fr_a')).toContainText('1 Apr 2027')
  await expect(timeline.locator('[data-list-issue="i_fr_b"]')).not.toContainText('No dates')

  const todayLine = page.getByRole('separator', { name: shortDate(today, today) })
  await expect(todayLine).toBeVisible()
  await expect(todayLine).toBeInViewport()

  await timeline.getByRole('button', { name: 'Collapse UK launch' }).click()
  await expect(lane('i_done')).toHaveCount(0)
  await expect(lane('i_blk')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByText('Shipped piece')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Gantt' }).click()
  await addStatusFilter(page, 'Blocked')
  await expect(timeline.locator('[data-list-issue="i_uk"]')).toHaveAttribute('data-dim', 'true')
  await expect(page.getByText('Blocked piece')).toBeVisible()

  await page.getByRole('button', { name: 'Remove Status is Blocked' }).click()
  await timeline.getByRole('button', { name: 'Expand UK launch' }).click()
  await lane('i_done').click()
  await expect(page.getByRole('complementary', { name: 'Issue panel' })).toBeVisible()
})

async function scrollBarClearOfList(
  page: import('@playwright/test').Page,
  issueId: string,
  from: 'center' | 'left' | 'right' = 'center',
) {
  await page.evaluate(
    ({ id, from }) => {
      const laneEl = document.querySelector(`[data-issue="${id}"]`) as HTMLElement | null
      const scroll = laneEl?.closest('.overflow-auto') as HTMLElement | null
      const sticky = scroll?.querySelector('.sticky.left-0.bg-app-bg') as HTMLElement | null
      if (!laneEl || !scroll || !sticky) return
      const bar = laneEl.querySelector('rect[data-bar]')
      if (!bar) return
      const listRight = sticky.getBoundingClientRect().right
      const barRect = bar.getBoundingClientRect()
      let anchor = barRect.left + barRect.width / 2
      if (from === 'left') anchor = barRect.left + 3
      if (from === 'right') anchor = barRect.right - 3
      const clearX = listRight + 12
      if (anchor < clearX) scroll.scrollLeft -= clearX - anchor
      const viewRight = scroll.getBoundingClientRect().right - 8
      if (barRect.right > viewRight) scroll.scrollLeft += barRect.right - viewRight
    },
    { id: issueId, from },
  )
}

async function dragOnLane(
  page: import('@playwright/test').Page,
  issueId: string,
  dx: number,
  from: 'center' | 'left' | 'right' = 'center',
) {
  await scrollBarClearOfList(page, issueId, from)
  const hit = await page.evaluate(
    ({ id, from }) => {
      const laneEl = document.querySelector(`[data-issue="${id}"]`) as HTMLElement | null
      const bar = laneEl?.querySelector('rect[data-bar]')
      if (!laneEl || !bar) throw new Error(`No bar for ${id}`)
      const r = bar.getBoundingClientRect()
      let x = r.left + r.width / 2
      if (from === 'left') x = r.left + 3
      if (from === 'right') x = r.right - 3
      const y = r.top + r.height / 2
      return { x, y }
    },
    { id: issueId, from },
  )
  await page.mouse.move(hit.x, hit.y)
  await page.mouse.down()
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(hit.x + (dx * i) / 5, hit.y, { steps: 2 })
  }
  await page.mouse.up()
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
  await expect(activity.getByText(/changed the dates/i).first()).toBeVisible()

  const linesBefore = await activity.getByText(/changed the dates/i).count()
  await dragOnLane(page, 'i_fr_b', 2)
  await expect(panel).toBeVisible()
  await expect(activity.getByText(/changed the dates/i)).toHaveCount(linesBefore)

  await panel.getByRole('button', { name: 'Close issue panel' }).click()
  await expect(panel).toBeHidden()
  await page.waitForTimeout(400) // the timeline widens as the panel leaves

  await page.evaluate(() => localStorage.setItem('smartchart.roadmapWriteGate', '1'))
  await page.route('**/api/roadmaps?writeGate=1**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.fulfill({ status: 500, body: 'fail' })
  })

  await dragOnLane(page, 'i_fr_b', 12)
  await expect(lane('i_fr_b')).toContainText('17 Dec')
  await nav.getByRole('button', { name: 'Table' }).click()
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-17' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-17' })).toBeVisible()
  await expect(page.getByText(/offline|couldn't be reached|server can't be reached|Couldn’t save/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-15' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-15' })).toBeVisible()
})

test('drops a dateless issue onto the timeline', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page, {
    i_done: { start: '2026-10-01', due: '2026-10-20', status: 'done' },
    i_fr_b: { start: undefined, due: undefined },
  })
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  const timeline = page.getByRole('region', { name: 'Timeline' })

  const listRow = timeline.locator('[data-list-issue="i_fr_b"]')
  const lane = timeline.locator('[data-issue="i_fr_b"]')
  await expect(listRow).toHaveAttribute('draggable', 'true')
  await expect(timeline.locator('[data-list-issue="i_done"]')).toHaveAttribute('draggable', 'false')

  await lane.hover()
  await expect(lane.locator('[data-ghost]')).toBeVisible()

  const dropInLane = await page.evaluate(() => {
    const region = document.querySelector('[aria-label="Timeline"]')
    if (!region) throw new Error('No timeline')
    const dec = [...region.querySelectorAll('text')].find((t) => t.textContent === 'Dec')
    if (!dec) throw new Error('No Dec tick')
    const tickLineX = Number(dec.getAttribute('x')) - 6
    return { x: tickLineX + 6 * 6, y: 16 }
  })

  await listRow.dragTo(lane, { targetPosition: dropInLane })

  await nav.getByRole('button', { name: 'Table' }).click()
  const row = page.locator('tr', { hasText: 'France task B' })
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-07' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-20' })).toBeVisible()
})

test('clicks a dateless lane to set dates', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page, {
    i_fr_b: { start: undefined, due: undefined },
  })
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  const timeline = page.getByRole('region', { name: 'Timeline' })
  const lane = timeline.locator('[data-issue="i_fr_b"]')

  const clickInLane = await page.evaluate(() => {
    const region = document.querySelector('[aria-label="Timeline"]')
    if (!region) throw new Error('No timeline')
    const dec = [...region.querySelectorAll('text')].find((t) => t.textContent === 'Dec')
    if (!dec) throw new Error('No Dec tick')
    const tickLineX = Number(dec.getAttribute('x')) - 6
    return { x: tickLineX + 6 * 6, y: 16 }
  })

  await lane.click({ position: clickInLane })
  await expect(lane).toHaveAttribute('data-mark', 'bar')

  await nav.getByRole('button', { name: 'Table' }).click()
  const row = page.locator('tr', { hasText: 'France task B' })
  await expect(row.getByRole('button', { name: 'Start date: 2026-12-07' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Due date: 2026-12-20' })).toBeVisible()
})

test('apple-bar 1440 gantt scales', async ({ page }) => {
  test.skip(!process.env.APPLE_BAR_CAPTURE, 'Set APPLE_BAR_CAPTURE=1 to refresh docs/temp screenshot')
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
  await page.getByRole('button', { name: 'Hide the sidebar' }).click()
  const scale = page.getByRole('group', { name: 'Scale' })
  await expect(page.getByRole('region', { name: 'Timeline' })).toBeVisible()

  for (const s of ['Week', 'Month', 'Quarter'] as const) {
    await scale.getByRole('button', { name: s }).click()
    await page.screenshot({ path: `docs/temp/roadmap-m2-gantt-1440-${s.toLowerCase()}.png` })
  }
})

test('New issue works from the Gantt: a title row at the end of the list, then the issue', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedSixIssues(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  await nav.getByRole('button', { name: 'Gantt' }).click()
  await page.getByRole('button', { name: 'New issue' }).click()
  const title = page.getByLabel('New issue title')
  await expect(title).toBeFocused()
  await title.fill('Launch review')
  await title.press('Enter')
  await expect(page.getByLabel('New issue title')).toHaveCount(0)
  await expect(page.getByText('Launch review')).toBeVisible()
  await expect(page.locator('[data-list-issue]', { hasText: 'Launch review' }).getByText('No dates')).toHaveCount(0)
})
