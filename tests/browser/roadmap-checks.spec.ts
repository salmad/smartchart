import { test, expect } from '@playwright/test'
import { openFreshRoadmap, signInRoadmapTests } from './roadmap-helpers'

signInRoadmapTests()
test.use({ viewport: { width: 1440, height: 900 } })

async function seedOverdueClean(page: import('@playwright/test').Page) {
  const id = /\/r\/(rm_[\w-]+)/.exec(page.url())?.[1]
  if (!id) throw new Error('Expected a roadmap URL')
  await page.evaluate(
    ({ roadmapId, key }) => {
      const now = Date.now()
      const past = '2020-01-01'
      const future = '2030-01-01'
      const row = (base: Record<string, unknown>) => ({
        parentId: null,
        sortKey: 'a',
        title: 'Issue',
        status: 'todo',
        assignee: 'u1',
        start: '2026-05-01',
        due: null,
        fields: {},
        bodyRev: 0,
        seq: 1,
        createdBy: 'local',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        body: '',
        comments: [],
        ...base,
      })
      const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, { issues: unknown[]; seq: number }>
      const rm = all[roadmapId]
      if (!rm) return
      rm.issues = [
        row({ id: 'late', number: 1, sortKey: 'a', title: 'Late task', due: past, start: '2019-12-01' }),
        row({ id: 'ok', number: 2, sortKey: 'b', title: 'Clean task', due: future, start: future }),
      ]
      localStorage.setItem(key, JSON.stringify(all))
    },
    { roadmapId: id, key: 'smartchart.roadmaps.v1' },
  )
}

test('checks tab, badge, card opens filtered table', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedOverdueClean(page)
  await page.reload()

  const nav = page.getByRole('navigation', { name: 'Roadmap views' })
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))

  await nav.getByRole('button', { name: /Checks/ }).click()
  await expect(nav.getByRole('button', { name: /Checks/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Checks' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /Checks/ })).toContainText('1')

  const overdue = page.getByRole('button', { name: 'Overdue, 1 issues' })
  await overdue.click()
  await expect(nav.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Late task')).toBeVisible()
  await expect(page.getByText('Clean task')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Overdue' })).toBeVisible()

  await page.getByRole('button', { name: 'Overdue' }).click()
  await expect(page.getByText('Clean task')).toBeVisible()

  expect(requests.filter((u) => /\/api\/.*checks/i.test(u)).length).toBe(0)
})

test('checks layout keeps filter row and hides display', async ({ page }) => {
  await openFreshRoadmap(page)
  await seedOverdueClean(page)
  await page.reload()
  await page.getByRole('navigation', { name: 'Roadmap views' }).getByRole('button', { name: /Checks/ }).click()
  await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Display' })).toBeHidden()
})
