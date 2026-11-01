/* Section folding in the editor: same control and storage as the read view (mount.ts). */
import { useEffect } from 'react'
import { drawIcons } from '@/engine/components/fit'
import type { DocEdit } from './useDocEdit'

const load = (key: string): string[] => { try { const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
const save = (key: string, ids: string[]) => { try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* private window */ } }

interface Options { root: HTMLElement | null; docId: string; editor: DocEdit['editor'] }

/** Fold chevrons on ## sections; state is kept per doc like the read view. */
export function useDocFold({ root, docId, editor }: Options) {
  useEffect(() => {
    if (!root) return
    const store = `occam.doc.fold.${docId}`
    const folded = () => [...root.querySelectorAll<HTMLElement>('.doc-sec.folded')].map((s) => s.id).filter(Boolean)
    const setFold = (sec: HTMLElement, fold: boolean) => {
      sec.classList.toggle('folded', fold)
      sec.querySelector(':scope > h2 > .fold')?.setAttribute('aria-expanded', String(!fold))
    }
    const wire = () => {
      root.querySelectorAll<HTMLElement>('.doc-sec').forEach((sec) => {
        const h2 = sec.querySelector<HTMLElement>(':scope > h2')
        if (h2?.id) sec.id = h2.id
      })
      drawIcons(root)
      for (const id of load(store)) { const sec = root.querySelector<HTMLElement>(`.doc-sec[id="${CSS.escape(id)}"]`); if (sec) setFold(sec, true) }
    }
    const click = (e: MouseEvent) => {
      const fold = (e.target instanceof Element ? e.target : null)?.closest<HTMLElement>('.fold')
      const sec = fold?.closest<HTMLElement>('.doc-sec')
      if (!fold || !sec) return
      e.preventDefault()
      setFold(sec, !sec.classList.contains('folded'))
      save(store, folded())
    }
    wire()
    root.addEventListener('click', click)
    editor?.on('transaction', wire)
    return () => { root.removeEventListener('click', click); editor?.off('transaction', wire) }
  }, [root, docId, editor])
}
