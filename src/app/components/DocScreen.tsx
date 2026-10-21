import '@/engine/docs/doc.css'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DocComment } from '@/engine/comments'
import { PanelLeft } from 'lucide-react'
import { parseDoc } from '@/engine/docs/parse'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import { serializeDoc } from '@/engine/docs/serialize'
import { describeDocDiff, docFrom } from '@/engine/docs/versions'
import { plainOf } from '@/engine/slides/markup'
import type { Block, Doc } from '@/engine/docs/types'
import type { Account } from '@/app/auth'
import { DOC_STALE, type Doc as DocRecord, type DocRepo, type DocVersionRow } from '@/app/docs'
import { authorOf } from '@/app/useComments'
import { timeOf } from '@/app/versions'
import { AccountMenu } from './AccountMenu'
import { Toggle } from './Bar'
import { LookPanel } from './LookPanel'
import { VersionsPanel } from './VersionsPanel'
import { anchorsOf } from './docs/anchors'
import { CommentTriggers } from './docs/CommentTriggers'
import { DocComments, type CommentTarget } from './docs/DocComments'
import { ReadBar } from './docs/DocBar'
import type { PageRef } from '@/engine/pages/tree'
import { Crumbs } from './Crumbs'
import type { Crumb } from './sidebar/usePageCrumbs'
import { DocPreview } from './docs/DocPreview'
import { useDocLive } from './docs/useDocLive'
import { lazyScreen, whenIdle } from '@/app/lazy-screen'
import './docs/docs-comments.css'

interface Props {
  id: string
  docs: DocRepo
  /** Editors and owners write; a viewer reads. */
  canEdit: boolean
  /** Bumped when the doc changed elsewhere (renamed in the sidebar): read it again, unless it is being edited. */
  tick: number
  /** After a save, so the sidebar lists the new name and time. */
  onSaved: () => void
  /** The workspace sidebar; null while hidden. */
  sidebar: ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSite: () => void
  account: Account
  /** The pages above this doc, outermost first, and how to open one. */
  crumbs?: Crumb[]; onOpenPage?: (ref: PageRef) => void
  /** The doc's name as the sidebar lists it: shown until the doc itself has been read. */
  name?: string
}

/** A doc in the workspace shell: the sidebar, a quiet bar, and the doc, read (M2) or edited (M4). */
// The editor (Tiptap and ProseMirror) loads once a doc is open and the browser is idle (or at the first Edit), not with the app.
const docEditing = lazyScreen(() => import('./docs/DocEditing').then((m) => m.DocEditing))

export function DocScreen({ id, docs, canEdit, tick, onSaved, sidebar, sidebarOpen, onToggleSidebar, onSite, account, crumbs, onOpenPage, name }: Props) {
  const page = useRef<HTMLDivElement>(null), [pageEl, setPageEl] = useState<HTMLDivElement | null>(null)
  const [state, setState] = useState<DocRecord | 'missing' | 'failed' | null>(() => docs.peek?.(id)?.doc ?? null), [editing, setEditing] = useState(false), [reload, setReload] = useState(0)
  const record = typeof state === 'object' ? state : null
  const parsed = useMemo(() => (record ? parseDoc(record.text).doc : null), [record])
  const me = authorOf(account), live = useDocLive(docs, id, editing, me)
  const [side, setSide] = useState<'comments' | 'versions' | 'look' | null>(null), [saves, setSaves] = useState(0), [refused, setRefused] = useState(false)
  const [preview, setPreview] = useState<{ v: DocVersionRow; before: DocVersionRow | null; current: boolean; doc: Doc | 'missing' | null } | null>(null), [restoring, setRestoring] = useState(false)
  const [comments, setComments] = useState<DocComment[]>(() => docs.peek?.(id)?.comments ?? []), [target, setTarget] = useState<CommentTarget | null>(null), [ring, setRing] = useState<string | null>(null), [commentError, setCommentError] = useState<string | null>(null)
  const blocks = useRef(new Map<string, Block>())
  const shown = preview?.doc && preview.doc !== 'missing' && !preview.current ? preview.doc : parsed

  // Another doc picked: reset while rendering, not after, so the old doc never paints under the new id. A doc read before
  // opens at once from memory (or, on a new visit, from this browser), and the server is asked again behind it.
  const [openId, setOpenId] = useState(id)
  if (openId !== id) {
    const kept = docs.peek?.(id)
    setOpenId(id); setEditing(false); setState(kept?.doc ?? null); setPreview(null); setSide(null); setComments(kept?.comments ?? [])
  }
  useEffect(() => {
    if (canEdit) whenIdle(() => void docEditing.preload())
  }, [canEdit])
  useEffect(() => {
    blocks.current = new Map()
    let go = true
    if (!docs.peek?.(id)?.doc) void docs.kept?.(id).then((k) => { if (go && k?.doc) { const { doc } = k; setState((s) => s ?? doc); setComments((c) => (c.length ? c : k.comments)) } })
    return () => { go = false }
  }, [docs, id])
  // The server's read of the doc on screen: Edit waits for it, so a draft never starts from a kept copy's revision.
  const read = useRef<{ id: string; done: Promise<unknown> }>({ id, done: Promise.resolve() })
  useEffect(() => {
    if (editing) return
    let go = true
    // The same doc read again keeps the object on screen, so the page is not drawn twice.
    const same = (a: DocRecord, b: DocRecord) => a.id === b.id && a.text === b.text && a.name === b.name
    const done = docs.get(id).then((d) => { if (go) setState((s) => (d && s && typeof s === 'object' && same(s, d) ? s : d ?? 'missing')) }, () => { if (go) setState((s) => (s && typeof s === 'object' ? s : 'failed')) })
    read.current = { id, done }
    return () => { go = false }
  }, [id, docs, tick, reload]) // eslint-disable-line react-hooks/exhaustive-deps -- a rename while editing waits for the next read
  const startEditing = () => { const at = read.current; void at.done.then(() => { if (read.current.id === at.id) setEditing(true) }) }
  // Someone saved while this tab was only reading: show what they wrote.
  useEffect(() => { if (live.newer && !editing && record) setReload((n) => n + 1) }, [live.newer]) // eslint-disable-line react-hooks/exhaustive-deps
  // Editing starts from the current doc: a version preview, Versions and Look are for reading.
  useEffect(() => { if (editing) { setPreview(null); setSide((s) => (s === 'versions' || s === 'look' ? null : s)); setRefused(false) } }, [editing])
  useEffect(() => { let go = true; void docs.comments(id).then((c) => { if (go) setComments(c) }); return () => { go = false } }, [docs, id, live.tick])

  // The read view, drawn from the doc shown (a version, while one is previewed); again after each save.
  useEffect(() => {
    if (!record || !shown || editing) return
    let go = true, mounted: { destroy(): void } | null = null
    // Figures measure text, as slides do: the fonts first.
    void loadFaces().then(() => { if (go && page.current) { mounted = mountDoc(page.current, shown, record.id); setPageEl(page.current) } })
    return () => { go = false; mounted?.destroy() }
  }, [record, shown, editing])
  // The page redrawn gives a ring a new element to wear.
  useEffect(() => {
    const el = ring && pageEl ? pageEl.querySelector<HTMLElement>(`[id="${CSS.escape(ring)}"]`) : null, on = el?.matches('.doc-sec') ? el.querySelector<HTMLElement>(':scope > h2') : el
    on?.classList.add('doc-ring')
    return () => on?.classList.remove('doc-ring')
  }, [ring, pageEl, shown])

  const save = useCallback(async (doc: Doc, opts?: { label?: string }) => {
    if (!record) return 'This doc is gone.'
    const next = { id: record.id, name: plainOf(doc.title).trim(), text: serializeDoc(doc), workspaceId: record.workspaceId }
    const why = await docs.save(next, opts)
    setRefused(why === DOC_STALE)
    if (!why) { setState({ ...next, updated: Date.now() }); setSaves((n) => n + 1); onSaved() }
    return why
  }, [record, docs, onSaved])

  // A version previewed: its blocks fetched once per hash.
  const showVersion = useCallback(async (v: DocVersionRow, before: DocVersionRow | null, current: boolean) => {
    setPreview({ v, before, current, doc: current ? parsed : null })
    if (current) return
    const want = [...new Set(v.tree.blocks)].filter((h) => !blocks.current.has(h))
    if (want.length) for (const [h, b] of Object.entries(await docs.blobs(id, want).catch(() => ({})))) blocks.current.set(h, b)
    const doc = docFrom(v.tree, Object.fromEntries(blocks.current))
    setPreview((p) => (p?.v.n === v.n ? { ...p, doc: doc ?? 'missing' } : p))
  }, [docs, id, parsed])
  const restore = async () => {
    if (!preview || !preview.doc || preview.doc === 'missing' || preview.current) return
    setRestoring(true)
    const why = await save(preview.doc, { label: `Restored the version from ${timeOf(preview.v.at)}` })
    setRestoring(false)
    if (why) window.alert(why); else setPreview(null)
  }

  const comment = async (op: Parameters<DocRepo['comment']>[1]) => {
    const r = await docs.comment(id, op)
    if (typeof r === 'string') setCommentError(r); else { setCommentError(null); setComments(r) }
  }
  const mine = (c: DocComment) => c.userId === account.id || c.userId === 'local'
  const reveal = (anchor: string) => {
    const el = pageEl?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`), sec = el?.closest<HTMLElement>('.doc-sec')
    if (sec?.classList.contains('folded')) sec.querySelector<HTMLElement>(':scope > h2 > .fold')?.click()
    el?.scrollIntoView({ block: 'center' })
  }
  const pick = useCallback((t: CommentTarget) => { setTarget(t); setSide('comments') }, [])
  const toggleComments = () => setSide((s) => (s === 'comments' ? null : 'comments'))
  const commenting = { open: side === 'comments', count: comments.filter((c) => !c.done).length, onToggle: toggleComments }

  const toggle = (which: 'versions' | 'look') => () => { setSide((s) => (s === which ? null : which)); setPreview(null) }
  // The look is the doc's own front matter: a change is a save, so it is a version like any other.
  const setLook = async (look: { theme: Doc['theme'] } | { accent: string | null }) => {
    if (!parsed) return
    const { accent: _old, ...rest } = parsed, accent = 'accent' in look ? look.accent : parsed.accent
    const why = await save({ ...rest, ...('theme' in look ? { theme: look.theme } : {}), ...(accent ? { accent } : {}) }, { label: 'Changed the look' })
    if (why) window.alert(why)
  }

  const header = (bar: ReactNode) => (
    <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
      <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
        <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
      </div>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
        <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
        <span aria-hidden className="text-ink-3">/</span>
        <Crumbs crumbs={crumbs} onOpen={(r) => onOpenPage?.(r)} />
        <span className="truncate text-ink-2">{record?.name ?? name ?? ''}</span>
      </nav>
      {bar}
      <AccountMenu account={account} />
    </header>
  )
  const body = (content: ReactNode) => (
    <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto">
      {sidebar}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-app-bg">
        {!editing && preview && record && shown && <DocPreview version={preview.v} current={preview.current} ready={preview.doc === 'missing' ? 'missing' : !!preview.doc} busy={restoring}
          what={describeDocDiff(preview.before?.tree ?? null, preview.v.tree)} onRestore={() => void restore()} onBack={() => setPreview(null)} />}
        {state === 'missing' && <p className="px-8 py-10 text-[13.5px] text-ink-2">That doc isn’t in this workspace.</p>}
        {state === 'failed' && <p className="px-8 py-10 text-[13.5px] text-ink-2">Couldn’t open the doc. Reload to try again.</p>}
        {content}
      </main>
      {!editing && side === 'look' && parsed && canEdit && <LookPanel noun="doc" theme={parsed.theme ?? 'paper'} accent={parsed.accent ?? null}
        onTheme={(theme) => void setLook({ theme })} onAccent={(accent) => void setLook({ accent })} onClose={() => setSide(null)} />}
      {!editing && side === 'versions' && <VersionsPanel list={() => docs.versions(id)} describe={(v, before) => describeDocDiff(before?.tree ?? null, v.tree)} noun="doc"
        saves={saves} selected={preview?.v.n ?? null} onPreview={(v, before, current) => void showVersion(v, before, current)} onClose={() => { setSide(null); setPreview(null) }} />}
      {side === 'comments' && parsed && <DocComments comments={comments} anchors={anchorsOf(parsed)} target={target} onTarget={setTarget} error={commentError}
        canResolve={(c) => canEdit || mine(c)} canDelete={mine} onShow={reveal} onHover={setRing} onClose={() => { setSide(null); setTarget(null); setRing(null) }}
        onAdd={(text) => { void comment({ add: { text, anchor: target?.anchor ?? 'doc', ...(target?.quote ? { quote: target.quote } : {}) } }); setTarget(null) }}
        onResolve={(cid) => void comment({ resolve: { id: cid } })} onDelete={(cid) => void comment({ remove: { id: cid } })} />}
    </div>
  )

  if (editing && parsed) {
    const DocEditing = docEditing.get()
    return (
      <Suspense fallback={<>{header(null)}{body(null)}</>}>
        <DocEditing doc={parsed} save={save} onDone={() => setEditing(false)} comments={commenting}
          stale={refused || live.newer ? { by: live.others[0] ?? null, refused, onReload: () => { setEditing(false); setReload((n) => n + 1) } } : null}>
          {(bar, editor) => <>{header(bar)}{body(editor)}</>}
        </DocEditing>
      </Suspense>
    )
  }
  return (
    <>
      {/* The bar stays while the next doc is read, so its buttons do not blink; Edit waits for the doc. */}
      {header(state !== 'missing' && state !== 'failed' && <ReadBar canEdit={canEdit && !preview} onEdit={() => { if (record) startEditing() }} others={live.others} comments={commenting}
        look={canEdit ? { open: side === 'look', onToggle: toggle('look') } : null} versions={{ open: side === 'versions', onToggle: toggle('versions') }} />)}
      {body(<><div ref={page} />{record && <CommentTriggers page={pageEl} theme={shown?.theme ?? 'paper'} onPick={pick} />}</>)}
    </>
  )
}
