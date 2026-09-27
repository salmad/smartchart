/* A slide's structure without its words and figures: what a content rewrite must keep (spec 4.1). */
import { MENU } from '@/engine/slides/schema'
import type { Slide } from '@/engine/types'

const len = (a: readonly unknown[] | undefined) => a?.length ?? 0

export function shapeOf(s: Slide): unknown {
  const c = s.chart
  return {
    template: s.template,
    variant: MENU[s.template].variant(s),
    keys: Object.keys(s).sort(),
    body: len(s.body),
    number: s.number ? { tone: s.number.tone } : undefined,
    notes: s.notes?.map((n) => ({ point: n.point })),
    steps: s.steps?.map((st) => ({ focus: st.focus })),
    cards: s.cards?.map((cd) => ({ tone: cd.tone, icon: cd.icon, hasValue: cd.value !== undefined, hasText: cd.text !== undefined, bullets: len(cd.bullets), facts: len(cd.facts) })),
    table: s.table && {
      columns: s.table.columns.map((col) => ({ focus: col.focus })),
      rows: s.table.rows.map((r) => ({ cells: r.cells.length, style: r.style })),
    },
    chart: c && {
      kind: c.kind, stacked: c.stacked, format: c.format, categories: len(c.categories),
      series: c.series?.map((se) => ({ mark: se.mark, color: se.color, format: se.format, area: se.area, dashed: se.dashed, values: se.values.length })),
      annotations: c.annotations?.map(({ label: _label, ...a }) => a),
      items: c.items?.map((it) => ({ total: it.total, focus: it.focus, sign: it.value === undefined ? undefined : Math.sign(it.value) })),
      periods: c.periods && c.periods.length,
      rows: c.rows?.map((r) => ({ start: r.start, end: r.end, focus: r.focus })),
      milestones: c.milestones?.map((m) => ({ at: m.at })),
    },
  }
}
