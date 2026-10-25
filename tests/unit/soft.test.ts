import { describe, expect, it } from 'vitest'
import { softChecks } from '../../src/engine/agent/soft'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import type { Slide } from '../../src/engine/types'

const chart = (title: string, extra: Record<string, unknown> = {}): Slide => ({ template: 'chart', title, chart: { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'Rev', mark: 'bar', color: 'focus', values: [4, 9] }], ...extra } } as Slide)
const trend = (title: string, extra: Record<string, unknown> = {}): Slide => ({ template: 'chart', title, chart: { categories: ['2021', '2022', '2023', '2024', '2025'], format: '£{v}m', series: [{ name: 'Rev', mark: 'bar', color: 'focus', values: [2, 3, 4, 6, 9] }], ...extra } } as Slide)

describe('softer checks', () => {
  it('a title that claims a change, with no annotation, gets one suggestion; with one, none', () => {
    expect(softChecks(chart('Revenue more than doubled to £9m')).map((x) => x.id)).toEqual(['S2'])
    expect(softChecks(chart('Revenue more than doubled to £9m', { annotations: [{ type: 'difference', from: 0, to: 1 }] }))).toEqual([])
    expect(softChecks(chart('Revenue by year'))).toEqual([])
  })
  it('a multi-year bar chart with no annotation suggests CAGR', () => {
    expect(softChecks(trend('Revenue by year')).map((x) => x.id)).toEqual(['S4'])
    expect(softChecks(trend('Revenue by year', { annotations: [{ type: 'cagr', from: 0, to: 4 }] }))).toEqual([])
  })
  it('each chart in a pair slide gets soft checks', () => {
    const pair: Slide = {
      template: 'pair', title: 'Two markets',
      halves: [
        { caption: 'UK', chart: { categories: ['2021', '2022', '2023', '2024', '2025'], format: '£{v}m', series: [{ name: 'R', mark: 'bar', values: [2, 3, 4, 6, 9] }] } },
        { caption: 'US', chart: { categories: ['2021', '2022'], format: '£{v}m', series: [{ name: 'R', mark: 'bar', values: [4, 9] }] } },
      ],
    }
    expect(softChecks(pair).map((x) => x.id)).toEqual(['S4'])
    expect(softChecks(pair)[0].msg).toMatch(/^UK:/)
  })
  it('actuals beside a plan series suggests a target line', () => {
    const slide = { template: 'chart', title: 'Revenue by quarter', chart: { categories: ['Q1', 'Q2'], format: '£{v}m', series: [{ name: 'Actual', mark: 'bar', values: [10, 12] }, { name: 'Plan', mark: 'line', values: [9, 11] }] } } as Slide
    expect(softChecks(slide).map((x) => x.id)).toEqual(['S5'])
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
