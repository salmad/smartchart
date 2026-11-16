import { buildIndex } from './index.js'
import { dateSpan } from './rollup.js'
import type { Issue } from './types.js'

export type Scale = 'week' | 'month' | 'quarter'

export const SCALES: readonly Scale[] = ['week', 'month', 'quarter']

export const SCALE_LABEL: Record<Scale, string> = {
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
}

export const PX_PER_DAY: Record<Scale, number> = {
  week: 28,
  month: 6,
  quarter: 2,
}

export const DROP_DAYS = 14

const MS_PER_DAY = 86_400_000

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function parseUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function formatIso(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  return formatIso(parseUtc(iso) + n * MS_PER_DAY)
}

export function daysBetween(a: string, b: string): number {
  return (parseUtc(b) - parseUtc(a)) / MS_PER_DAY
}

export interface Range {
  from: string
  to: string
}

function startOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return formatIso(Date.UTC(y, m - 1, 1))
}

function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return formatIso(Date.UTC(y, m, 0))
}

function addMonthsToStart(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + delta, 1))
  return formatIso(t.getTime())
}

function quarterIndex(iso: string): number {
  const m = Number(iso.slice(5, 7))
  return Math.ceil(m / 3) - 1
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

function startOfQuarter(y: number, q: number): string {
  return formatIso(Date.UTC(y, q * 3, 1))
}

function endOfQuarter(y: number, q: number): string {
  return formatIso(Date.UTC(y, q * 3 + 3, 0))
}

function shiftQuarter(y: number, q: number, delta: number): { y: number; q: number } {
  const t = y * 4 + q + delta
  return { y: Math.floor(t / 4), q: ((t % 4) + 4) % 4 }
}

function mondayOfWeek(iso: string): string {
  const day = new Date(parseUtc(iso)).getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(iso, offset)
}

function sundayOfWeek(mondayIso: string): string {
  return addDays(mondayIso, 6)
}

function liveDates(issues: Issue[]): string[] {
  const out: string[] = []
  for (const i of issues) {
    if (i.deletedAt !== null) continue
    if (i.start != null) out.push(i.start)
    if (i.due != null) out.push(i.due)
  }
  return out
}

function defaultMonthRange(today: string): Range {
  return {
    from: startOfMonth(addMonthsToStart(today, -1)),
    to: endOfMonth(addMonthsToStart(today, 6)),
  }
}

function snapMonthRange(range: Range, dates: string[]): Range {
  let { from, to } = range
  for (const d of dates) {
    const start = startOfMonth(d)
    const end = endOfMonth(addMonthsToStart(startOfMonth(d), 1))
    if (start < from) from = start
    if (end > to) to = end
  }
  return { from, to }
}

function defaultWeekRange(today: string): Range {
  const thisMon = mondayOfWeek(today)
  const from = addDays(thisMon, -7)
  const to = addDays(sundayOfWeek(thisMon), 7 * 8)
  return { from, to }
}

function snapWeekRange(range: Range, dates: string[]): Range {
  let { from, to } = range
  for (const d of dates) {
    const mon = mondayOfWeek(d)
    const sun = sundayOfWeek(mon)
    if (mon < from) from = mon
    if (sun > to) to = sun
  }
  return { from: mondayOfWeek(from), to: sundayOfWeek(mondayOfWeek(to)) }
}

function defaultQuarterRange(today: string): Range {
  const y = yearOf(today)
  const q = quarterIndex(today)
  const before = shiftQuarter(y, q, -1)
  const after = shiftQuarter(y, q, 3)
  return { from: startOfQuarter(before.y, before.q), to: endOfQuarter(after.y, after.q) }
}

function snapQuarterRange(range: Range, dates: string[]): Range {
  let { from, to } = range
  for (const d of dates) {
    const y = yearOf(d)
    const q = quarterIndex(d)
    const start = startOfQuarter(y, q)
    const after = shiftQuarter(y, q, 1)
    const end = endOfQuarter(after.y, after.q)
    if (start < from) from = start
    if (end > to) to = end
  }
  return { from, to }
}

export function ganttRange(issues: Issue[], today: string, scale: Scale): Range {
  const dates = liveDates(issues)
  let range: Range
  if (scale === 'month') {
    range = snapMonthRange(defaultMonthRange(today), dates)
  } else if (scale === 'week') {
    range = snapWeekRange(defaultWeekRange(today), dates)
  } else {
    range = snapQuarterRange(defaultQuarterRange(today), dates)
  }
  return range
}

export interface Tick {
  iso: string
  label: string
  x: number
}

function monthTickLabel(iso: string, today: string): string {
  const y = yearOf(iso)
  const m = Number(iso.slice(5, 7)) - 1
  if (y === yearOf(today)) return MONTH_SHORT[m]
  return `${MONTH_SHORT[m]} '${String(y).slice(2)}`
}

function weekTickLabel(iso: string): string {
  const d = new Date(parseUtc(iso))
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`
}

function quarterTickLabel(iso: string, today: string): string {
  const y = yearOf(iso)
  const q = quarterIndex(iso) + 1
  if (y === yearOf(today)) return `Q${q}`
  return `Q${q} '${String(y).slice(2)}`
}

export function ticks(range: Range, scale: Scale, today: string): Tick[] {
  const px = PX_PER_DAY[scale]
  const out: Tick[] = []
  if (scale === 'month') {
    let cur = startOfMonth(range.from)
    const end = range.to
    while (cur <= end) {
      out.push({ iso: cur, label: monthTickLabel(cur, today), x: daysBetween(range.from, cur) * px })
      cur = addMonthsToStart(cur, 1)
    }
    return out
  }
  if (scale === 'week') {
    let cur = mondayOfWeek(range.from)
    const end = range.to
    while (cur <= end) {
      out.push({ iso: cur, label: weekTickLabel(cur), x: daysBetween(range.from, cur) * px })
      cur = addDays(cur, 7)
    }
    return out
  }
  let y = yearOf(range.from)
  let q = quarterIndex(range.from)
  const endY = yearOf(range.to)
  const endQ = quarterIndex(range.to)
  while (y < endY || (y === endY && q <= endQ)) {
    const iso = startOfQuarter(y, q)
    if (iso <= range.to) {
      out.push({ iso, label: quarterTickLabel(iso, today), x: daysBetween(range.from, iso) * px })
    }
    const next = shiftQuarter(y, q, 1)
    y = next.y
    q = next.q
  }
  return out
}

export type Mark =
  | { kind: 'bar'; start: string; due: string; done: boolean; alert: boolean; overdue: boolean; label: string | null }
  | { kind: 'bracket'; start: string; due: string; own: boolean; alert: boolean; overdue: boolean; label: string | null }
  | { kind: 'milestone'; day: string; done: boolean; alert: boolean; overdue: boolean; label: string | null }
  | { kind: 'none' }

/** What is wrong with an open issue, in words: late against `due`, blocked, or both. */
function alertOf(self: Issue, today: string, due: string | null): { alert: boolean; overdue: boolean; label: string | null } {
  const live = self.status !== 'done' && self.status !== 'cancelled'
  const blocked = self.status === 'blocked'
  const overdue = live && due !== null && due < today
  if (!overdue && !blocked) return { alert: false, overdue: false, label: null }
  const parts: string[] = []
  if (overdue && due !== null) {
    const n = daysBetween(due, today)
    parts.push(`Overdue ${n} day${n === 1 ? '' : 's'}`)
  }
  if (blocked) parts.push(parts.length === 0 ? 'Blocked' : 'blocked')
  return { alert: true, overdue, label: parts.join(' · ') }
}

function leafMark(self: Issue, today: string): Mark {
  const { start, due } = self
  const done = self.status === 'done'
  if (start != null && due != null && start !== due) {
    return { kind: 'bar', start, due, done, ...alertOf(self, today, due) }
  }
  const day = due ?? start
  if (day == null) return { kind: 'none' }
  return { kind: 'milestone', day, done, ...alertOf(self, today, due ?? null) }
}

export function markFor(issues: Issue[], id: string, today: string): Mark {
  const idx = buildIndex(issues)
  const self = idx.byId.get(id)
  if (!self) return { kind: 'none' }
  if (idx.children(id).length === 0) return leafMark(self, today)

  const span = dateSpan(issues, id)
  if (span.start === null || span.due === null) return { kind: 'none' }
  const own = self.start != null && self.due != null
  return { kind: 'bracket', start: span.start, due: span.due, own, ...alertOf(self, today, own ? self.due ?? null : null) }
}

/** Where a mark's label goes: right of the mark if it fits, else left, else nowhere (the caller falls back to a
    tooltip). It never crosses the today line or leaves the timeline. `x` is the label's near edge. */
export function placeLabel(
  mark: { x: number; w: number },
  labelW: number,
  todayX: number,
  width: number,
  gap = 8,
): { side: 'right' | 'left'; x: number } | null {
  const clear = (from: number, to: number) => from >= 0 && to <= width && (to < todayX - gap || from > todayX + gap)
  const right = mark.x + mark.w + gap
  if (clear(right, right + labelW)) return { side: 'right', x: right }
  const left = mark.x - gap
  if (clear(left - labelW, left)) return { side: 'left', x: left }
  return null
}

export type DragMode = 'move' | 'start' | 'end'

export function dragDates(
  start: string,
  due: string,
  mode: DragMode,
  days: number,
): { start: string; due: string } {
  if (mode === 'move') {
    return { start: addDays(start, days), due: addDays(due, days) }
  }
  if (mode === 'start') {
    const next = addDays(start, days)
    const clamped = next > due ? due : next
    return { start: clamped, due }
  }
  const next = addDays(due, days)
  const clamped = next < start ? start : next
  return { start, due: clamped }
}

export function dropDates(day: string): { start: string; due: string } {
  return { start: day, due: addDays(day, DROP_DAYS - 1) }
}
