import { describe, expect, it } from 'vitest'
import { softChecks } from '../../src/engine/agent/soft'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import type { Slide } from '../../src/engine/types'

const chart = (title: string, extra: Record<string, unknown> = {}): Slide => ({ template: 'chart', title, chart: { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'Rev', mark: 'bar', color: 'focus', values: [4, 9] }], ...extra } } as Slide)

describe('softer checks', () => {
  it('a title that claims a change, with no annotation, gets one suggestion; with one, none', () => {
    expect(softChecks(chart('Revenue more than doubled to £9m')).map((x) => x.id)).toEqual(['S2'])
    expect(softChecks(chart('Revenue more than doubled to £9m', { annotations: [{ type: 'difference', from: 0, to: 1 }] }))).toEqual([])
    expect(softChecks(chart('Revenue by year'))).toEqual([])
  })
  it('judgements in words suggest marks', () => {
    const table = { template: 'table', title: 'Acme leads', table: { columns: [{ label: '' }, { label: 'Fast' }, { label: 'Cheap' }], rows: [{ cells: ['Acme', 'Yes', 'High'] }, { cells: ['Bank', 'No', 'Low'] }] } } as Slide
    expect(softChecks(table).map((x) => x.id)).toEqual(['S3'])
  })
  it('notes or a stacked chart already carry the change', () => {
    expect(softChecks({ ...chart('Revenue doubled'), notes: [{ title: 'Price' }, { title: 'Mix' }, { title: 'Churn' }] } as Slide)).toEqual([])
    expect(softChecks(chart('Revenue doubled', { stacking: 'stacked' }))).toEqual([])
  })
  it('the gallery mostly passes: suggestions are the exception, not the rule', () => {
    const hits = STARTERS.flatMap((s) => (['consulting', 'pitch'] as const).map((st) => softChecks(starterSlide(s, st)).length)).filter(Boolean).length
    expect(hits).toBe(0)
  })
})
