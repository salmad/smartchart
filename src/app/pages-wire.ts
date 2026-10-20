import type { PageRef } from '@/engine/pages/tree'

/** A page named in a server answer, or null when the field is missing or not one. */
export function refOf(v: unknown): PageRef | null {
  const o = (v && typeof v === 'object' ? v : {}) as { kind?: unknown; id?: unknown }
  return (o.kind === 'deck' || o.kind === 'doc') && typeof o.id === 'string' ? { kind: o.kind, id: o.id } : null
}
