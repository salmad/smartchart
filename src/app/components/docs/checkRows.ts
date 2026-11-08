/* The Checks panel's rows: each check under the block it is about, named in the doc's own words, in doc order. Pure. */
import { checkKey, type DocCheck } from '@/engine/docs/checks'
import { identify } from '@/engine/docs/ops'
import type { Doc } from '@/engine/docs/types'
import { plainOf } from '@/engine/slides/markup'
import { WHOLE_DOC } from './anchors'

export interface CheckRow { key: string; check: DocCheck; soft: boolean }
export interface CheckGroup { blockId: string; label: string; rows: CheckRow[] }

const cap = (s: string) => `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`
const quoted = (s: string, max = 48) => `“${s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s}”`

/** What a block is called in the panel: a figure by its caption, a section by its heading, prose by the section it sits in. */
export function blockLabels(doc: Doc): Map<string, string> {
  const out = new Map<string, string>([[WHOLE_DOC, 'Whole doc']])
  let section: string | null = null
  for (const { id, block } of identify(doc)) {
    if (block.type === 'heading') {
      const text = plainOf(block.text)
      if (block.level === 2) section = text
      out.set(id, `Section ${quoted(text)}`)
    } else if (block.type === 'figure') {
      const c = (block.body as { caption?: string }).caption
      out.set(id, c ? `${cap(block.kind)} ${quoted(plainOf(c))}` : `${cap(block.kind)} with no caption`)
    } else {
      const what = block.type === 'paragraph' ? 'Paragraph' : block.type === 'bullets' || block.type === 'numbered' ? 'List' : cap(block.type)
      out.set(id, section ? `${what} in ${quoted(section)}` : `${what} before the first section`)
    }
  }
  return out
}

/** A check's words in the panel. The whole-doc verdict says what it found before its counts. */
export const checkText = (c: DocCheck) => (c.id === 'D7' && !c.ok ? `Reads as a wall of text: ${c.msg}` : c.msg)

/** Checks grouped by block in doc order; the whole doc first. A check on a block no longer in the doc goes last, by itself. */
export function groupChecks(doc: Doc, checks: DocCheck[]): CheckGroup[] {
  const labels = blockLabels(doc), order = [WHOLE_DOC, ...identify(doc).map((x) => x.id)]
  const groups = new Map<string, CheckGroup>()
  for (const c of checks) {
    const g = groups.get(c.blockId) ?? { blockId: c.blockId, label: labels.get(c.blockId) ?? 'A block', rows: [] }
    g.rows.push({ key: checkKey(c), check: c, soft: /^S\d/.test(c.id) })
    groups.set(c.blockId, g)
  }
  const at = (id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i }
  return [...groups.values()].sort((a, b) => at(a.blockId) - at(b.blockId))
}

/** Open checks: failed and not dismissed. */
export const openChecks = (checks: DocCheck[], quiet: ReadonlySet<string>) => checks.filter((c) => !c.ok && !quiet.has(checkKey(c)))
