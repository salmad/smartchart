/* Geometry for dragging an item, row or column to another place: which way the list runs, and where a drop lands.
   Pure and in client pixels, so the slide's scale never matters. */
export interface Box { left: number; right: number; top: number; bottom: number }
export type Axis = 'x' | 'y'

/** A list runs along x when its second item sits further across than down from its first. */
export function axisOf(boxes: Box[]): Axis {
  if (boxes.length < 2) return 'y'
  return Math.abs(boxes[1].left - boxes[0].left) > Math.abs(boxes[1].top - boxes[0].top) ? 'x' : 'y'
}

/** The index the dragged item takes: how many of the other items lie before the pointer. */
export function dropIndex(boxes: Box[], from: number, p: { x: number; y: number }, axis: Axis): number {
  const centre = (b: Box) => (axis === 'x' ? (b.left + b.right) / 2 : (b.top + b.bottom) / 2), at = axis === 'x' ? p.x : p.y
  return boxes.filter((b, i) => i !== from && centre(b) < at).length
}

/** Where the drop line goes: at the leading edge of the item the drop lands before, or past the last item's end. */
export function dropLine(boxes: Box[], from: number, to: number, axis: Axis): Box | null {
  const rest = boxes.filter((_, i) => i !== from)
  if (!rest.length) return null
  const first = rest[0], last = rest[rest.length - 1], b = to >= rest.length ? last : rest[to]
  const x = to >= rest.length ? b.right : b.left, y = to >= rest.length ? b.bottom : b.top
  return axis === 'x' ? { left: x - 1, right: x + 1, top: Math.min(first.top, last.top), bottom: Math.max(first.bottom, last.bottom) } : { left: Math.min(first.left, last.left), right: Math.max(first.right, last.right), top: y - 1, bottom: y + 1 }
}
