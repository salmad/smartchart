/* Contents beside the doc while editing: same tree and collapse levels as the read view, scrolls to headings in the page. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { outlineTree, type OutlineSection } from '@/engine/docs/parse'
import type { DocEdit } from './useDocEdit'

function TocList({ tree, onGo }: { tree: OutlineSection[]; onGo: (id: string) => void }) {
  return (
    <ol>
      {tree.map((s) => (
        <li key={s.id} className={s.children.length ? 'l2 toc-branch' : 'l2'}>
          {s.children.length
            ? (
              <details className="toc-sec" open>
                <summary><a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); onGo(s.id) }}>{s.text}</a></summary>
                <ol>{s.children.map((c) => (
                  <li key={c.id} className="l3"><a href={`#${c.id}`} onClick={(e) => { e.preventDefault(); onGo(c.id) }}>{c.text}</a></li>
                ))}</ol>
              </details>
            )
            : <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); onGo(s.id) }}>{s.text}</a>}
        </li>
      ))}
    </ol>
  )
}

interface Props { edit: DocEdit; root: HTMLElement | null; docId: string }

export function DocContents({ edit, root, docId }: Props) {
  const [rev, setRev] = useState(0)
  useEffect(() => {
    if (!edit.editor) return
    const bump = () => setRev((n) => n + 1)
    edit.editor.on('transaction', bump)
    return () => { edit.editor?.off('transaction', bump) }
  }, [edit.editor])

  const tree = useMemo(() => { const d = edit.current(); return d ? outlineTree(d) : [] }, [edit, rev]) // eslint-disable-line react-hooks/exhaustive-deps -- rev

  const go = useCallback((id: string) => {
    if (!root || !id) return
    const target = root.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
    const sec = target?.closest<HTMLElement>('.doc-sec')
    if (sec?.classList.contains('folded')) {
      sec.classList.remove('folded')
      sec.querySelector(':scope > h2 > .fold')?.setAttribute('aria-expanded', 'true')
      try {
        const key = `occam.doc.fold.${docId}`
        const ids = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
        if (Array.isArray(ids)) localStorage.setItem(key, JSON.stringify(ids.filter((x) => x !== sec.id)))
      } catch { /* private mode */ }
    }
    target?.scrollIntoView({ block: 'start' })
    history.replaceState(null, '', `#${encodeURIComponent(id)}`)
  }, [root, docId])

  useEffect(() => {
    if (!root || !tree.length) return
    const heads = [...root.querySelectorAll<HTMLElement>('.doc-sec, .sec-body h3[id]')]
    const links = [...root.querySelectorAll<HTMLAnchorElement>('.doc-toc a, .doc-toc-mini a')]
    let frame = 0
    const spy = () => {
      frame = 0
      const current = heads.filter((h) => h.getBoundingClientRect().top <= 120).pop()?.id
      links.forEach((a) => {
        const href = a.getAttribute('href')
        if (href === `#${current}`) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current')
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(spy) }
    window.addEventListener('scroll', onScroll, { passive: true })
    spy()
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [root, tree, rev])

  if (!tree.length) return null
  const list = <TocList tree={tree} onGo={go} />
  return (
    <>
      <nav className="doc-toc" aria-label="Contents"><p className="toc-h">Contents</p>{list}</nav>
      <details className="doc-toc-mini"><summary>Contents</summary>{list}</details>
    </>
  )
}
