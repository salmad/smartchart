import '@/engine/docs/doc.css'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import type { Doc } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import type { RoadmapRepo } from '@/app/roadmaps'
import { Button } from '../ui/button'
import { lazyScreen, whenIdle } from '@/app/lazy-screen'
import { patchIssueDetail } from './issueDetailCache'

const bodyEditor = lazyScreen(() => import('./IssueBodyEditor').then((m) => m.IssueBodyEditor))

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

/** The issue's description: a doc drawn at panel size. Empty, it is one quiet line that opens the editor. */
export function IssueBody({ roadmapId, issueId, issueTitle, body, bodyRev, canEdit, look, repo, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [stale, setStale] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  const docId = `${roadmapId}:${issueId}`
  // The issue's title heads the panel, so the body's own title is never drawn (older bodies were saved with "Issue").
  const parsed = useMemo(() => ({ ...parseDoc(body).doc, title: '' }), [body])
  const empty = parsed.blocks.length === 0
  const drawn = useMemo(() => ({ ...parsed, theme: look.theme, ...(look.accent ? { accent: look.accent } : {}) }), [parsed, look.theme, look.accent])
  const draft = useMemo<Doc>(
    () => ({ ...parsed, title: issueTitle, blocks: parsed.blocks.length ? parsed.blocks : [{ type: 'paragraph', text: '' }] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the title only fills the schema; a rename must not rebuild the open editor
    [parsed],
  )

  useEffect(() => {
    if (editing || empty) return
    let go = true
    let mounted: { destroy(): void } | null = null
    void loadFaces().then(() => {
      if (go && page.current) mounted = mountDoc(page.current, drawn, docId)
    })
    return () => { go = false; mounted?.destroy() }
  }, [drawn, editing, empty, docId])

  useEffect(() => {
    if (canEdit) whenIdle(() => void bodyEditor.preload())
  }, [canEdit])

  const save = useCallback(async (doc: Doc) => {
    const text = serializeDoc(doc)
    const r = await repo.putBody(roadmapId, issueId, text, bodyRev)
    if (r === 'stale') { setStale(true); return 'Someone saved a newer description.' }
    if (typeof r === 'string') return r
    patchIssueDetail(roadmapId, issueId, { body: text, bodyRev: r.bodyRev })
    onSaved(r.bodyRev, text)
    return null
  }, [bodyRev, issueId, onSaved, repo, roadmapId])

  const close = useCallback(() => { setEditing(false); setStale(false) }, [])

  if (editing) {
    const Editor = bodyEditor.get()
    return (
      <section className="mt-5" aria-label="Description">
        <Suspense fallback={<p className="text-[13px] text-ink-3">Opening the editor…</p>}>
          <Editor doc={draft} docId={docId} look={look} save={save} onDone={close} onReload={stale ? close : null} />
        </Suspense>
      </section>
    )
  }

  if (empty) {
    if (!canEdit) return null
    return (
      <section className="mt-5" aria-label="Description">
        <button
          type="button"
          className="w-full cursor-text rounded-md py-1 text-left text-[14px] leading-[1.6] text-ink-3 transition-colors hover:text-ink-2 focus-visible:text-ink-2 focus-visible:outline-none"
          onClick={() => setEditing(true)}
        >
          Add a description…
        </button>
      </section>
    )
  }

  return (
    <section className="group/body relative mt-5" aria-label="Description">
      <div ref={page} className="doc-embed doc-read doc-theme max-w-none" data-doc-print-root />
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="absolute -top-1 right-0 bg-app-bg opacity-0 transition-opacity focus-visible:opacity-100 group-hover/body:opacity-100"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      )}
    </section>
  )
}
