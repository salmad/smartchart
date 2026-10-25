/* Composer pills on a doc: starters on an empty thread, then next steps from suggestDoc (with code soft checks). */
import { suggestDoc, type Pill } from '@/engine/agent/suggest'
import type { Doc } from '@/engine/docs/types'
import type { ChatMessage } from '@/engine/agent/llm'

const STARTERS: Pill[] = [
  { label: 'Market section with a five-year chart', prompt: 'Add a section on market size with a bar chart of revenue over the last five years and a source I can fill in.' },
  { label: 'Competitive comparison table', prompt: 'Add a section comparing three competitors in a table with Harvey balls for key criteria.' },
  { label: 'Executive summary', prompt: 'Add an executive summary section: two short paragraphs and one chart figure that states the main number.' },
]

let inflight: { key: string; ctl: AbortController } | null = null

/** Pills for the doc chat, or null while fetching / unavailable. */
export function chipsForDoc(doc: Doc | null, opts: { live: boolean; busy: boolean; editing: boolean; fresh: boolean; history: ChatMessage[] }): Pill[] | null {
  if (!opts.live || opts.busy || opts.editing || !doc) return null
  if (opts.fresh && doc.blocks.length < 4) return STARTERS
  return null
}

/** Fetch tailored pills when the doc changes; aborts on busy or a new version. */
export function refreshDocPills(
  doc: Doc | null,
  key: string,
  opts: { live: boolean; busy: boolean; editing: boolean; history: ChatMessage[] },
  onReady: (pills: Pill[]) => void,
): void {
  if (inflight) {
    inflight.ctl.abort()
    inflight = null
  }
  if (!opts.live || opts.busy || opts.editing || !doc || doc.blocks.length < 4) return
  const ctl = new AbortController()
  inflight = { key, ctl }
  void suggestDoc({ doc, history: opts.history }, ctl.signal).then(({ pills }) => {
    if (inflight?.ctl !== ctl || inflight.key !== key) return
    inflight = null
    if (pills.length) onReady(pills)
  })
}
