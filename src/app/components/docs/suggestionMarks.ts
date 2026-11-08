/* The quiet margin mark beside a block that has a suggestion (Google Docs' margin suggestions): one per block, with a
   count when there are several. In the read view it is put beside the block after each draw; in the editor it is a
   decoration (editor/proposal.ts). Never inside a figure: it sits before the block, in the page's left margin. */
import { useEffect, useRef } from 'react'
import type { DocProposal } from '@/engine/docs/proposals'

/** Suggestions by the block they start at, in list order. */
export function byFirstBlock(list: DocProposal[]): Map<string, DocProposal[]> {
  const out = new Map<string, DocProposal[]>()
  for (const p of list) { const id = p.blockIds[0]; if (id) out.set(id, [...(out.get(id) ?? []), p]) }
  return out
}

/** The mark's button: opens the first suggestion on its block in place. */
export function suggestionMark(list: DocProposal[], open: (p: DocProposal) => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'doc-sugg'
  b.contentEditable = 'false'
  b.dataset.suggFor = list[0].blockIds[0]
  b.dataset.suggIds = list.map((p) => p.id).join(' ')
  const what = list.length === 1 ? `Suggestion: ${list[0].label}` : `${list.length} suggestions: ${list.map((p) => p.label).join('; ')}`
  b.title = what
  b.setAttribute('aria-label', what)
  const star = document.createElement('span'); star.setAttribute('aria-hidden', 'true'); star.textContent = '✦'
  const text = document.createElement('span'); text.className = 'doc-sugg-text'; text.textContent = list.length === 1 ? 'Suggestion' : `${list.length} suggestions`
  b.append(star, text)
  if (list.length > 1) { const n = document.createElement('span'); n.className = 'doc-sugg-n'; n.textContent = String(list.length); b.append(n) }
  b.addEventListener('mousedown', (e) => e.preventDefault())
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(list[0]) })
  return b
}

/** Where a block starts in the read view: a ## heading's own line, otherwise the element named by its id. */
function blockEl(root: ParentNode, id: string): Element | null {
  const el = root.querySelector(`[data-block="${CSS.escape(id)}"], [id="${CSS.escape(id)}"]`)
  return el?.matches('.doc-sec') ? el.querySelector(':scope > h2') : el
}

/** Put a mark before each suggested block in the read view; take away marks whose suggestions are gone. */
export function markSuggestions(root: ParentNode, list: DocProposal[], open: (p: DocProposal) => void) {
  const want = byFirstBlock(list)
  for (const m of root.querySelectorAll<HTMLElement>('.doc-sugg')) {
    const ids = want.get(m.dataset.suggFor ?? '')?.map((p) => p.id).join(' ')
    if (ids !== m.dataset.suggIds || m.nextElementSibling !== blockEl(root, m.dataset.suggFor ?? '')) m.remove()
  }
  for (const [id, ps] of want) {
    const el = blockEl(root, id)
    if (!el || el.previousElementSibling?.matches(`.doc-sugg[data-sugg-for="${CSS.escape(id)}"]`)) continue
    el.before(suggestionMark(ps, open))
  }
}

/** The read view's marks, kept up as the page is drawn again. Off while editing (the editor draws its own). */
export function useSuggestionMarks(root: HTMLElement | null, list: DocProposal[], onOpen: (p: DocProposal) => void, on: boolean) {
  const latest = useRef(onOpen)
  latest.current = onOpen
  useEffect(() => {
    const page = on ? root?.querySelector('.doc') ?? null : null
    if (!root || !on) return
    const open = (p: DocProposal) => latest.current(p)
    let frame = 0
    const pass = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const doc = root.querySelector('.doc'); if (doc) markSuggestions(doc, list, open) }) }
    if (page) markSuggestions(page, list, open)
    const watch = new MutationObserver(pass)
    watch.observe(root, { childList: true, subtree: true })
    return () => { cancelAnimationFrame(frame); watch.disconnect(); root.querySelectorAll('.doc .doc-sugg').forEach((m) => m.remove()) }
  }, [root, list, on])
}
