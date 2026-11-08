/* Occam's suggestions for a doc, kept in this browser by what they were made for (the doc's blocks and its dismissed
   checks), so opening the doc again asks the model only after a change. Storage can fail; then nothing is kept. */
import { hash } from '@/engine/versions'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'

const KEY = 'smartchart.occamSuggestions.v1'
const KEEP = 30

type Kept = Record<string, { sig: string; list: DocProposal[]; at: number }>

/** What a set of suggestions was made for: the blocks, and the checks set aside. */
export const suggestionSig = (doc: Doc, quiet: ReadonlySet<string>) => `${hash(JSON.stringify(doc.blocks))}|${hash([...quiet].sort().join('\n'))}`

const read = (): Kept => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Kept } catch { return {} } }

export function keptSuggestions(docId: string, sig: string): DocProposal[] | null {
  const k = read()[docId]
  return k && k.sig === sig ? k.list : null
}

export function keepSuggestions(docId: string, sig: string, list: DocProposal[]) {
  const all = read()
  all[docId] = { sig, list, at: Date.now() }
  // The most recent docs only.
  const trimmed = Object.fromEntries(Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP))
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)) } catch { /* full or blocked: ask again next time */ }
}

/** A suggestion dismissed: it stays gone for this version of the doc. */
export function dropSuggestion(docId: string, id: string) {
  const all = read(), k = all[docId]
  if (!k) return
  keepSuggestions(docId, k.sig, k.list.filter((p) => p.id !== id))
}
