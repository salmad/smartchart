import { describe, expect, it } from 'vitest'
import { activityItems } from '../../src/app/components/roadmap/issueActivityLine'
import { SYSTEM_USER } from '../../src/engine/roadmaps/ops'
import type { IssueEvent } from '../../src/engine/roadmaps/types'
import { issue } from './roadmap-builders'

const rhythm = { start: '2026-11-02', weeks: 2, rolled: null }
const members = [{ id: 'ann', name: 'Ann', email: 'ann@example.com' }]
const set = (by: string, from: string | null, to: string | null, at = 1): IssueEvent =>
  ({ issueId: 'a', by, byClient: 'app', at, what: 'set', changes: [{ path: 'sprint', from, to }] })
const lines = (events: IssueEvent[], r = rhythm as typeof rhythm | null) =>
  activityItems(issue({ id: 'a' }), [{ ...set('ann', null, null), what: 'created', changes: [] }, ...events], [], members, [], r).slice(1).map((i) => `${i.who} ${i.did}`)

describe('sprint activity lines', () => {
  it('says what moved where, and names the system user Occam', () => {
    expect(lines([set(SYSTEM_USER, '2026-11-02', '2026-11-16')])).toEqual(['Occam moved it from Sprint 1 to Sprint 2'])
  })
  it('says when work is added to or removed from a sprint', () => {
    expect(lines([set('ann', null, '2026-11-16')])).toEqual(['Ann added it to Sprint 2'])
    expect(lines([set('ann', '2026-11-16', null)])).toEqual(['Ann removed it from the sprint'])
  })
  it('does not number sprints it has no rhythm for', () => {
    expect(lines([set('ann', null, '2026-11-16')], null)).toEqual(['Ann added it to a sprint'])
  })
})
