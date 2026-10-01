import { test, expect } from 'vitest'
import { checkWrite } from '@/engine/agent/write'
import type { Slide } from '@/engine/types'

const jev = async () => { throw new Error('Jev is not called without "auto"') }
const measure = () => ({ issues: [], lines: 1, warnings: [] })

test('strict (the agent): a shape error refuses the write', async () => {
  const w = await checkWrite({ template: 'cards', title: '', cards: [] }, { style: 'consulting', jev, brief: '', strict: true, measure })
  expect(w.applied).toBe(false)
})

test('not strict (a human): the slide is kept with its errors as issues', async () => {
  const w = await checkWrite({ template: 'steps', title: '', steps: [{ when: 'Q1', title: 'Build', text: 'x' }, { when: 'Q2', title: 'Ship', text: 'y' }] }, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied).toBe(true)
  if (w.applied) expect(w.issues.some((i) => i.startsWith('title: required'))).toBe(true)
})

test('an over-long title is kept word for word: no shortening here', async () => {
  const title = 'A'.repeat(130)
  const w = await checkWrite({ template: 'section', title }, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied && w.slide.title).toBe(title)
})

test('a slide that cannot render is refused', async () => {
  const w = await checkWrite({ template: 'section', title: 'X' }, { style: 'consulting', jev, brief: '', strict: false, measure: () => { throw new Error('boom') } })
  expect(w).toMatchObject({ applied: false, issues: ['slide could not be rendered: boom'] })
})

test('an empty optional field is dropped (autofix)', async () => {
  const w = await checkWrite({ template: 'section', title: 'X', subtitle: '' } as Slide, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied && 'subtitle' in w.slide).toBe(false)
})
