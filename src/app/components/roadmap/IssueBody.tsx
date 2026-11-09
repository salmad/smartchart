import '@/engine/docs/doc.css'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import type { Doc } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import type { RoadmapRepo } from '@/app/roadmaps'
import { Button } from '../ui/button'
import { lazyScreen, whenIdle } from '@/app/lazy-screen'
import { patchIssueDetail } from './issueDetailCache'

const docEditing = lazyScreen(() => import('../docs/DocEditing').then((m) => m.DocEditing))

interface Props {
  roadmapId: string
  issueId: string
  /** The editor's schema needs a title: it carries the issue's, and the read view never draws it. */
  issueTitle: string
  body: string
  bodyRev: number
  canEdit: boolean
  look: { theme: Theme; accent?: string }
  repo: RoadmapRepo
  onSaved: (bodyRev: number, body: string) => void
}

export function IssueBody({ roadmapId, issueId, issueTitle, body, bodyRev, canEdit, look, repo, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  // The issue's title heads the panel, so the body's own title is never drawn (older bodies were saved with "Issue").
  const parsed = useMemo(() => ({ ...parseDoc(body).doc, title: '' }), [body])
  const empty = parsed.blocks.length === 0
  const drawn = useMemo(() => ({ ...parsed, theme: look.theme, ...(look.accent ? { accent: look.accent } : {}) }), [parsed, look.theme, look.accent])
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (editing || empty) return
    let go = true
    let mounted: { destroy(): void } | null = null
    void loadFaces().then(() => {
      if (go && page.current) mounted = mountDoc(page.current, drawn, `${roadmapId}:${issueId}`)
    })
    return () => { go = false; mounted?.destroy() }
  }, [drawn, editing, empty, issueId, roadmapId])

  useEffect(() => {
    if (canEdit) whenIdle(() => void docEditing.preload())
  }, [canEdit])

  const save = useCallback(async (doc: Doc) => {
    const text = serializeDoc(doc)
    const r = await repo.putBody(roadmapId, issueId, text, bodyRev)
    if (r === 'stale') { setStale(true); return 'Someone saved a newer version.' }
    if (typeof r === 'string') return r
    patchIssueDetail(roadmapId, issueId, { body: text, bodyRev: r.bodyRev })
    onSaved(r.bodyRev, text)
    return null
  }, [bodyRev, issueId, onSaved, repo, roadmapId])

  if (editing) {
    const DocEditing = docEditing.get()
    const wrap = (bar: ReactNode, editor: ReactNode) => (
      <div className="doc-embed">
        <div className="mb-2 flex items-center gap-2 border-b border-line pb-2">{bar}</div>
        {editor}
      </div>
    )
    return (
      <Suspense fallback={<p className="text-[13px] text-ink-2">Opening the editor…</p>}>
        <DocEditing
          doc={{ ...parsed, title: issueTitle, blocks: parsed.blocks.length ? parsed.blocks : [{ type: 'paragraph', text: '' }] }}
          docId={`${roadmapId}:${issueId}`}
          look={{ theme: look.theme, accent: look.accent }}
          save={save}
          onDone={() => { setEditing(false); setStale(false) }}
          stale={stale ? { by: null, refused: false, onReload: () => { setEditing(false); setStale(false) } } : null}
          comments={{ open: false, count: 0, onToggle: () => {} }}
        >
          {(bar, editor) => wrap(bar, editor)}
        </DocEditing>
      </Suspense>
    )
  }

  return (
    <section className="mt-4" aria-label="Description">
      {empty ? (
        canEdit ? (
          <button type="button" className="w-full rounded py-1 text-left text-[13px] text-ink-3 hover:text-ink-2" onClick={() => setEditing(true)}>
            Add a description…
          </button>
        ) : null
      ) : (
        <>
          {canEdit && (
            <div className="mb-1 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-ink-3 hover:text-ink" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          )}
          <div ref={page} className="doc-embed doc-read doc-theme max-w-none" data-doc-print-root />
        </>
      )}
    </section>
  )
}
