import { expect } from '@playwright/test'
import { signInAsDev } from './dev-account'

export const EMPTY = 'Plan the work. See when it lands.'

/** Filter on Status: the property, then tick each value; the menu stays open until it is closed. */
export async function addStatusFilter(page: import('@playwright/test').Page, ...statusNames: string[]) {
  await page.getByRole('button', { name: 'Filter' }).click()
  const panel = page.getByLabel('Add a filter')
  await panel.getByRole('option', { name: 'Status' }).click()
  for (const name of statusNames) {
    await panel.getByRole('option', { name, exact: true }).click()
    await expect(panel.getByRole('option', { name, exact: true })).toHaveAttribute('aria-checked', 'true')
  }
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
}
export const ROADMAPS_KEY = 'smartchart.roadmaps.v1'

export function signInRoadmapTests() {
  signInAsDev()
}

export async function openFreshRoadmap(page: import('@playwright/test').Page, { checkPrefix = false } = {}) {
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

type IssueSeed = { start?: string; due?: string; status?: string }

/** Worked matrix example from the M3 spec (Workstream × Country). */
export async function seedWorkedMatrix(page: import('@playwright/test').Page) {
  const id = /\/r\/(rm_[\w-]+)/.exec(page.url())?.[1]
  if (!id) throw new Error('Expected a roadmap URL')
  await page.evaluate(
    ({ roadmapId, key }) => {
      const now = Date.now()
      const row = (base: Record<string, unknown>) => ({
        parentId: null,
        sortKey: 'a',
        title: 'Issue',
        status: 'todo',
        assignee: null,
        start: null,
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
      const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, {
        issues: unknown[]
        fields: unknown[]
        nextNumber: number
        seq: number
      }>
      const rm = all[roadmapId]
      if (!rm) return
      rm.fields = [
        { id: 'ws', name: 'Workstream', type: 'choice', options: [{ id: 'vendors', name: 'Vendors' }] },
        {
          id: 'country',
          name: 'Country',
          type: 'choice',
          options: [
            { id: 'uk', name: 'UK' },
            { id: 'fr', name: 'France' },
            { id: 'sg', name: 'Singapore' },
          ],
        },
      ]
      rm.issues = [
        row({ id: 'U', number: 1, sortKey: 'a', title: 'Underwriting', fields: { ws: 'vendors' } }),
        row({
          id: 'U-uk',
          number: 2,
          parentId: 'U',
          sortKey: 'a',
          title: 'Underwriting',
          status: 'in_progress',
          due: '2027-02-01',
          fields: { ws: 'vendors', country: 'uk' },
        }),
        row({
          id: 'T1',
          number: 3,
          parentId: 'U-uk',
          sortKey: 'a',
          title: 'Send RFP',
          status: 'done',
          fields: { ws: 'vendors', country: 'uk' },
        }),
        row({
          id: 'T2',
          number: 4,
          parentId: 'U-uk',
          sortKey: 'b',
          title: 'Chase',
          status: 'blocked',
          due: '2026-01-01',
          fields: { ws: 'vendors', country: 'uk' },
        }),
        row({
          id: 'U-fr',
          number: 5,
          parentId: 'U',
          sortKey: 'b',
          title: 'Underwriting',
          fields: { ws: 'vendors', country: 'fr' },
        }),
        row({
          id: 'U-sg',
          number: 6,
          parentId: 'U',
          sortKey: 'c',
          title: 'Underwriting',
          fields: { ws: 'vendors', country: 'sg' },
        }),
      ]
      rm.nextNumber = 7
      rm.seq = 6
      localStorage.setItem(key, JSON.stringify(all))
    },
    { roadmapId: id, key: ROADMAPS_KEY },
  )
}

export async function seedSixIssues(
  page: import('@playwright/test').Page,
  over: Record<string, IssueSeed> = {},
) {
  const id = /\/r\/(rm_[\w-]+)/.exec(page.url())?.[1]
  if (!id) throw new Error('Expected a roadmap URL')
  await page.evaluate(
    ({ roadmapId, key, overrides }) => {
      const now = Date.now()
      const row = (base: Record<string, unknown>) => ({
        parentId: null,
        sortKey: 'a',
        title: 'Issue',
        status: 'todo',
        assignee: null,
        start: null,
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
      const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, {
        issues: unknown[]
        fields: unknown[]
        nextNumber: number
        seq: number
      }>
      const rm = all[roadmapId]
      if (!rm) return
      rm.fields = [
        {
          id: 'f_country',
          name: 'Country',
          type: 'choice',
          options: [
            { id: 'uk', name: 'UK', emoji: '🇬🇧' },
            { id: 'fr', name: 'France', emoji: '🇫🇷' },
          ],
        },
      ]
      const issues: Record<string, unknown>[] = [
        row({ id: 'i_uk', number: 1, sortKey: 'a', title: 'UK launch', fields: { f_country: 'uk' } }),
        row({ id: 'i_done', number: 2, sortKey: 'b', parentId: 'i_uk', title: 'Shipped piece', status: 'done' }),
        row({ id: 'i_blk', number: 3, sortKey: 'c', parentId: 'i_uk', title: 'Blocked piece', status: 'blocked' }),
        row({ id: 'i_fr', number: 4, sortKey: 'd', title: 'France launch', fields: { f_country: 'fr' } }),
        row({ id: 'i_fr_a', number: 5, sortKey: 'e', parentId: 'i_fr', title: 'France task A' }),
        row({ id: 'i_fr_b', number: 6, sortKey: 'f', parentId: 'i_fr', title: 'France task B', status: 'in_progress' }),
      ]
      for (const i of issues) {
        const patch = overrides[String(i.id)]
        if (patch) {
          for (const [key, val] of Object.entries(patch)) {
            if (val !== undefined) i[key] = val
          }
        }
      }
      rm.issues = issues
      rm.nextNumber = 7
      rm.seq = 6
      localStorage.setItem(key, JSON.stringify(all))
    },
    { roadmapId: id, key: ROADMAPS_KEY, overrides: over },
  )
}
