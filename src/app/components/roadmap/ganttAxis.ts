import { addDays, daysBetween, type Range } from '@/engine/roadmaps/gantt'

export interface Axis {
  from: string
  px: number
  xOf(iso: string): number
  dayAt(x: number): string
}

export function makeAxis(range: Range, px: number): Axis {
  return {
    from: range.from,
    px,
    xOf(iso: string) {
      return daysBetween(range.from, iso) * px
    },
    dayAt(x: number) {
      const day = Math.round(x / px)
      return addDays(range.from, day)
    },
  }
}
