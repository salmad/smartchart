/* Where a doc comment can point: the doc itself, a section (## id), a subsection (### id) or a figure (its id). Each is
   named in the doc's words, and belongs to the section it sits in, so the comments panel can group by section. */
import { plainOf } from '@/engine/slides/markup'
import type { Doc } from '@/engine/docs/types'

export const WHOLE_DOC = 'doc'
export interface Anchor { id: string; label: string; section: string }

/** Every anchor in doc order. `section` is the id of the ## it sits under (WHOLE_DOC before the first). */
export function anchorsOf(doc: Doc): Anchor[] {
  const out: Anchor[] = [{ id: WHOLE_DOC, label: 'Whole doc', section: WHOLE_DOC }]
  let section = WHOLE_DOC
  for (const b of doc.blocks) {
    if (b.type === 'heading') {
      if (b.level === 2) section = b.id
      out.push({ id: b.id, label: plainOf(b.text), section })
    } else if (b.type === 'figure') {
      const cap = (b.body as { caption?: string }).caption
      out.push({ id: b.id, label: cap ? plainOf(cap) : `${b.kind[0].toUpperCase()}${b.kind.slice(1)}`, section })
    }
  }
  return out
}
