import '@/engine/docs/doc.css'
import { createPortal } from 'react-dom'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DocComment } from '@/engine/comments'
import { parseDoc } from '@/engine/docs/parse'
import { loadFaces, mountDoc } from '@/engine/docs/mount'
import { serializeDoc } from '@/engine/docs/serialize'
import { describeDocDiff, docFrom } from '@/engine/docs/versions'
import { plainOf } from '@/engine/slides/markup'
import type { Block, Doc } from '@/engine/docs/types'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Theme } from '@/engine/types'
import type { Account } from '@/app/auth'
import { DOC_STALE, type Doc as DocRecord, type DocRepo, type DocVersionRow } from '@/app/docs'
import { authorOf } from '@/app/useComments'
import { timeOf } from '@/app/versions'
import { AccountMenu } from './AccountMenu'
import { AppBar, ScreenBody } from './AppBar'
import { ChatPanel } from './ChatPanel'
import { EmptyDoc } from './docs/EmptyDoc'
import { phaseLinesOf } from '@/app/phase'
import { chipsForDoc, refreshDocPills } from '@/app/docPills'
import { sendDocTurn } from '@/app/doc-turn'
import type { Pill } from '@/engine/agent/suggest'
import type { ChatMessage } from '@/engine/agent/llm'
import type { Message } from '@/app/store'
import { PageMenu } from './PageMenu'
import { SourceDialog } from './SourceEditor'
import { VersionsPanel } from './VersionsPanel'
import { anchorsOf } from './docs/anchors'
import { CommentTriggers } from './docs/CommentTriggers'
import { DocComments, type CommentTarget } from './docs/DocComments'
import { DocChecks } from './docs/DocChecks'
import { Presence, ReadBar } from './docs/DocBar'
import { useDocChecks } from './docs/useDocChecks'
import { countText } from './docs/useDocProposals'
import { ShareMenu } from './ShareMenu'
import { docDownloads } from './Downloads'
import { PrintDoc } from './PrintDoc'
import { fileName } from '@/app/download'
import type { PageRef } from '@/engine/pages/tree'
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
  chatOpen: boolean
  /** How many pages sit under this one: a doc that holds pages may be empty on purpose. */
  subpages: (page: PageRef) => Promise<number>
  onToggleChat: () => void
  offline: boolean
  modelsLive: boolean
  /** Workspace palette and accent (not stored on the doc). */
  /** Your palette and accent (changed from the avatar menu). */
  look: { theme: Theme; accent: string | null }
  /** A share link on the server; null for the dev account. */
  shareId: string | null
}

/** A doc in the workspace shell: the sidebar, a quiet bar, and the doc, read (M2) or edited (M4). */
// The editor (Tiptap and ProseMirror) loads once a doc is open and the browser is idle (or at the first Edit), not with the app.
const docEditing = lazyScreen(() => import('./docs/DocEditing').then((m) => m.DocEditing))

export function DocScreen({ id, docs, canEdit, tick, onSaved, sidebar, sidebarOpen, onToggleSidebar, onSite, account, crumbs, onOpenPage, name, chatOpen, subpages, onToggleChat, offline, modelsLive, look, shareId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const historyRef = useRef<ChatMessage[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const page = useRef<HTMLDivElement>(null), [pageEl, setPageEl] = useState<HTMLDivElement | null>(null), [mainEl, setMainEl] = useState<HTMLElement | null>(null), [bodyEl, setBodyEl] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<DocRecord | 'missing' | 'failed' | null>(() => docs.peek?.(id)?.doc ?? null), [editing, setEditing] = useState(false), [reload, setReload] = useState(0)
  const record = typeof state === 'object' ? state : null
  const parsed = useMemo(() => (record ? parseDoc(record.text).doc : null), [record])
  const docKey = useMemo(() => (parsed ? JSON.stringify(parsed.blocks) : ''), [parsed])
  const [docChips, setDocChips] = useState<{ key: string; pills: Pill[] } | null>(null)
  const me = authorOf(account), live = useDocLive(docs, id, editing, me)
  const [side, setSide] = useState<'comments' | 'checks' | 'versions' | null>(null), [saves, setSaves] = useState(0), [refused, setRefused] = useState(false)
  const [preview, setPreview] = useState<{ v: DocVersionRow; before: DocVersionRow | null; current: boolean; doc: Doc | 'missing' | null } | null>(null), [restoring, setRestoring] = useState(false)
  const [comments, setComments] = useState<DocComment[]>(() => docs.peek?.(id)?.comments ?? []), [target, setTarget] = useState<CommentTarget | null>(null), [ring, setRing] = useState<string | null>(null), [commentError, setCommentError] = useState<string | null>(null)
  const [activeProposal, setActiveProposal] = useState<DocProposal | null>(null)
  const [printing, setPrinting] = useState(false)
  const blocks = useRef(new Map<string, Block>())
  const shown = preview?.doc && preview.doc !== 'missing' && !preview.current ? preview.doc : parsed
  const drawn = useMemo(() => (shown ? { ...shown, theme: look.theme, ...(look.accent ? { accent: look.accent } : {}) } : null), [shown, look.theme, look.accent])

  // Another doc picked: reset while rendering, not after, so the old doc never paints under the new id. A doc read before
  // opens at once from memory (or, on a new visit, from this browser), and the server is asked again behind it.
  const [openId, setOpenId] = useState(id)
  if (openId !== id) {
    const kept = docs.peek?.(id)
    setOpenId(id); setEditing(false); setState(kept?.doc ?? null); setPreview(null); setSide(null); setComments(kept?.comments ?? []); setActiveProposal(null)
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
  useEffect(() => { if (editing) { setPreview(null); setSide((s) => (s === 'versions' ? null : s)); setRefused(false) } }, [editing])
  useEffect(() => {
    if (!parsed || !modelsLive || !canEdit || chatBusy || editing) return
    const starters = chipsForDoc(parsed, { live: modelsLive, busy: chatBusy, editing, fresh: !messages.length, history: historyRef.current })
    if (starters) { setDocChips({ key: docKey, pills: starters }); return }
    setDocChips(null)
    refreshDocPills(parsed, docKey, { live: modelsLive, busy: chatBusy, editing, history: historyRef.current }, (pills) => setDocChips({ key: docKey, pills }))
  }, [parsed, docKey, modelsLive, canEdit, chatBusy, editing, messages.length])
  const chips = docChips?.key === docKey ? docChips.pills : null
  useEffect(() => { let go = true; void docs.comments(id).then((c) => { if (go) setComments(c) }); return () => { go = false } }, [docs, id, live.tick])

  // The read view, drawn from the doc shown (a version, while one is previewed); again after each save.
  useEffect(() => {
    if (!record || !drawn || editing) return
    let go = true, mounted: { destroy(): void } | null = null
    // Figures measure text, as slides do: the fonts first.
    void loadFaces().then(() => { if (go && page.current) { mounted = mountDoc(page.current, drawn, record.id); setPageEl(page.current); setBodyEl(page.current.querySelector<HTMLElement>('.doc-body')) } })
    return () => { go = false; mounted?.destroy() }
  }, [record, drawn, editing])
  // The page redrawn gives a ring a new element to wear.
  useEffect(() => {
    const el = ring && mainEl ? mainEl.querySelector<HTMLElement>(`[id="${CSS.escape(ring)}"], [data-block="${CSS.escape(ring)}"]`) : null, on = el?.matches('.doc-sec') ? el.querySelector<HTMLElement>(':scope > h2') : el
    on?.classList.add('doc-ring')
    return () => on?.classList.remove('doc-ring')
  }, [ring, mainEl, pageEl, drawn, editing])

  useEffect(() => {
    if (!pageEl || editing || !activeProposal) return
    const id = activeProposal.blockIds[0]
    const el = pageEl.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"], [data-block="${CSS.escape(id)}"]`)
    el?.classList.add('doc-proposal-marked')
    return () => el?.classList.remove('doc-proposal-marked')
  }, [pageEl, activeProposal, editing, drawn])

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
  const reveal = useCallback((anchor: string) => {
    const el = mainEl?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"], [data-block="${CSS.escape(anchor)}"]`), sec = el?.closest<HTMLElement>('.doc-sec')
    if (sec?.classList.contains('folded')) sec.querySelector<HTMLElement>(':scope > h2 > .fold')?.click()
    // On a phone the panel is a sheet over the lower part of the screen: the block goes to the top.
    el?.scrollIntoView({ block: window.matchMedia('(max-width: 900px)').matches ? 'start' : 'center' })
  }, [mainEl])
  const showBlock = useCallback((blockId: string | null) => { setRing(blockId); if (blockId) reveal(blockId) }, [reveal])
  const review = (p: DocProposal) => { setActiveProposal(p); if (canEdit && !editing && !preview && record) startEditing() }
  const openChecks = useCallback(() => setSide('checks'), [])
  const checks = useDocChecks({ docs, id, doc: parsed, canEdit, root: mainEl, gate: { editing, live: modelsLive && !offline, busy: chatBusy },
    chat: { history: historyRef, setMessages, setBusy: setChatBusy }, show: showBlock, openPanel: openChecks, onReview: (p) => review(p) })
  const checksState = checks.state
  // The panel opened (from the bar or a figure's badge): suggestions are read again, and Occam's asked for once per revision.
  useEffect(() => { if (side === 'checks') void checksState.openPanel() }, [side]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((t: CommentTarget) => { setTarget(t); setSide('comments') }, [])
  const toggleComments = () => setSide((s) => (s === 'comments' ? null : 'comments'))
  const toggleChecks = () => {
    setSide((s) => {
      const next = s === 'checks' ? null : 'checks'
      if (!next) checks.reset()
      return next
    })
  }
  const commenting = { open: side === 'comments', count: comments.filter((c) => !c.done).length, onToggle: toggleComments }
  const checking = { open: side === 'checks', count: checksState.badge.count, pass: checksState.badge.pass, label: countText(checksState.badge), onToggle: toggleChecks }

  // The right slot: a panel open takes the agent's place, closing it brings the agent back; the agent's toggle (and ⌘L)
  // while a panel is up goes back to the agent.
  const panelShown = (!editing && side === 'versions') || ((side === 'comments' || side === 'checks') && !!parsed)
  const sendChat = (text: string) => { setChatBusy(true); void sendDocTurn(text, { docId: id, getHistory: () => historyRef.current, setHistory: (h) => { historyRef.current = h }, setMessages, onDone: () => setReload((n) => n + 1) }).finally(() => setChatBusy(false)) }
  // A doc with nothing in it opens on its start screen; until something is asked, the prompt box is there, not in the
  // agent's panel (one prompt box on the page).
  // A doc with nothing under its title says how to start, under the title: writing it first, the agent second. The
  // agent's panel stays out of the way until it is asked for (Draft it with Occam, or its toggle).
  const blank = !!parsed && !parsed.blocks.length && !preview && !editing
  const [agentAsked, setAgentAsked] = useState(false)
  // A doc that holds pages may have nothing of its own on purpose: it gets no invitation. Unknown until asked: none either.
  const [holds, setHolds] = useState<number | null>(null)
  useEffect(() => {
    setHolds(null)
    if (!blank) return
    let go = true
    subpages({ kind: 'doc', id }).then((n) => { if (go) setHolds(n) }, () => { if (go) setHolds(null) })
    return () => { go = false }
  }, [blank, id, tick, subpages])
  useEffect(() => setAgentAsked(false), [id])
  const invite = blank && holds === 0
  const quiet = invite && !messages.length && !agentAsked
  const draft = () => { setAgentAsked(true); setSide(null); if (!chatOpen) onToggleChat() }
  const chatShown = chatOpen && !panelShown && !quiet
  const toAgent = () => { setSide(null); setPreview(null); setTarget(null); setRing(null); checks.reset(); if (!chatOpen) onToggleChat() }
  useEffect(() => {
    if (!panelShown) return
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); e.stopPropagation(); toAgent() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [panelShown, chatOpen]) // eslint-disable-line react-hooks/exhaustive-deps -- toAgent reads the latest state
  const toggleVersions = () => { setSide((s) => (s === 'versions' ? null : 'versions')); setPreview(null) }
  const [source, setSource] = useState(false)

  const downloads = (r: { name: string; text: string }) => docDownloads(r.name, r.text, () => page.current, () => setPrinting(true))
  const header = (bar: ReactNode) => (
    <AppBar sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} chat={{ open: chatShown, onToggle: quiet ? draft : panelShown ? toAgent : onToggleChat }} onSite={onSite} crumbs={crumbs} onOpenPage={onOpenPage}
      title={<>
        <span className="truncate text-ink-2">{record?.name ?? name ?? ''}</span>
        {record && !editing && <PageMenu noun="doc" name={record.name} busy={false} onVersions={toggleVersions} onSource={() => setSource(true)}
          downloads={downloads(record)} />}
      </>}
      badge={!editing && <Presence names={live.others} />}>
      {bar}
      <AccountMenu account={account} />
    </AppBar>
  )
  const body = (content: ReactNode) => (
    <ScreenBody>
      {sidebar}
      {/* On a phone the checks are a sheet over the page's foot: room below, so the last block can scroll above it. */}
      <main ref={setMainEl} className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-app-bg ${side === 'checks' ? 'max-[900px]:pb-[45dvh]' : ''}`}>
        {!editing && preview && record && shown && <DocPreview version={preview.v} current={preview.current} ready={preview.doc === 'missing' ? 'missing' : !!preview.doc} busy={restoring}
          what={describeDocDiff(preview.before?.tree ?? null, preview.v.tree)} onRestore={() => void restore()} onBack={() => setPreview(null)} />}
        {state === 'missing' && <p className="px-8 py-10 text-[13.5px] text-ink-2">That doc isn’t in this workspace.</p>}
        {state === 'failed' && <p className="px-8 py-10 text-[13.5px] text-ink-2">Couldn’t open the doc. Reload to try again.</p>}
        {content}
      </main>
      {!quiet && <ChatPanel about="doc" open={chatShown} messages={messages} offline={offline} onUndo={null} busy={chatBusy || editing} fresh={!messages.length}
        chips={chips} canSend={modelsLive && canEdit && !editing} composerBusy={chatBusy} hint={editing ? 'Save or discard to keep chatting' : undefined}
        onSend={sendChat}
        onClear={() => { setMessages([]); historyRef.current = [] }} />}
      {!editing && side === 'versions' && <VersionsPanel list={() => docs.versions(id)} describe={(v, before) => describeDocDiff(before?.tree ?? null, v.tree)} noun="doc"
        saves={saves} selected={preview?.v.n ?? null} onPreview={(v, before, current) => void showVersion(v, before, current)} onClose={() => { setSide(null); setPreview(null) }} />}
      {side === 'comments' && parsed && <DocComments comments={comments} anchors={anchorsOf(parsed)} target={target} onTarget={setTarget} error={commentError}
        canResolve={(c) => canEdit || mine(c)} canDelete={mine} onShow={reveal} onHover={setRing} onClose={() => { setSide(null); setTarget(null); setRing(null) }}
        onAdd={(text) => { void comment({ add: { text, anchor: target?.anchor ?? 'doc', ...(target?.quote ? { quote: target.quote } : {}) } }); setTarget(null) }}
        onResolve={(cid) => void comment({ resolve: { id: cid } })} onDelete={(cid) => void comment({ remove: { id: cid } })} />}
      {side === 'checks' && parsed && (
        <DocChecks doc={parsed} checks={checksState.checks} count={checksState.badge.count} countLabel={countText(checksState.badge)} quiet={checks.quiet} proposals={checksState.proposals}
          loading={checksState.occamOn && checksState.loading} canEdit={canEdit} actions={checks.actions} error={checks.error} onPick={review}
          onDismiss={canEdit ? (pid) => void checksState.dismiss(pid) : undefined}
          onClose={() => { setSide(null); checks.reset() }} />
      )}
    </ScreenBody>
  )

  if (editing && parsed) {
    const DocEditing = docEditing.get()
    return (
      <Suspense fallback={<>{header(null)}{body(null)}</>}>
        <DocEditing doc={parsed} docId={id} look={{ theme: look.theme, accent: look.accent ?? undefined }} save={save} onDone={() => setEditing(false)} comments={commenting} checks={checking}
          proposals={checksState.proposals} activeProposal={activeProposal} onActiveProposal={setActiveProposal}
          onDismissProposal={async (pid) => { await checksState.dismiss(pid) }}
          stale={refused || live.newer ? { by: live.others[0] ?? null, refused, onReload: () => { setEditing(false); setReload((n) => n + 1) } } : null}>
          {(bar, editor) => <>{header(bar)}{body(editor)}</>}
        </DocEditing>
      </Suspense>
    )
  }
  return (
    <>
      {/* The bar stays while the next doc is read, so its buttons do not blink; Edit waits for the doc. */}
      {header(state !== 'missing' && state !== 'failed' && <ReadBar canEdit={canEdit && !preview} onEdit={() => { if (record) startEditing() }} checks={checking} comments={commenting}
        share={shareId ? <ShareMenu target="doc" id={shareId} downloads={record ? downloads(record) : []} /> : null} />)}
      {record && <SourceDialog title="Doc source" text={record.text} open={source} onOpenChange={setSource} />}
      {body(<>
        {invite && bodyEl && createPortal(<EmptyDoc onWrite={canEdit ? () => { if (record) startEditing() } : undefined} onDraft={canEdit && modelsLive && !offline ? draft : undefined}
          working={chatBusy ? phaseLinesOf(messages.at(-1)?.trace) : null} />, bodyEl)}
        <div ref={page} data-doc-print-root />{record && <CommentTriggers page={pageEl} theme={look.theme} onPick={pick} />}
      </>)}
      {printing && record && <PrintDoc name={fileName(record.name)} onDone={() => setPrinting(false)} />}
    </>
  )
}
