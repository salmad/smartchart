import '@/engine/docs/doc.css'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
import { parseDoc } from '@/engine/docs/parse'
import { mountDoc } from '@/engine/docs/mount'
import { serializeDoc } from '@/engine/docs/serialize'
import { plainOf } from '@/engine/slides/markup'
import type { Doc } from '@/engine/docs/types'
import type { Account } from '@/app/auth'
import type { Doc as DocRecord, DocRepo } from '@/app/docs'
import { AccountMenu } from './AccountMenu'
import { Toggle } from './Bar'
import { ReadBar } from './docs/DocBar'
import { DocEditing } from './docs/DocEditing'

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
}

/** A doc in the workspace shell: the sidebar, a quiet bar, and the doc, read (M2) or edited (M4). */
export function DocScreen({ id, docs, canEdit, tick, onSaved, sidebar, sidebarOpen, onToggleSidebar, onSite, account }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<DocRecord | 'missing' | 'failed' | null>(null), [editing, setEditing] = useState(false)
  const record = typeof state === 'object' ? state : null
  const parsed = useMemo(() => (record ? parseDoc(record.text).doc : null), [record])

  useEffect(() => { setEditing(false); setState(null) }, [id])
  useEffect(() => {
    if (editing) return
    let live = true
    void docs.get(id).then((d) => { if (live) setState(d ?? 'missing') }, () => { if (live) setState('failed') })
    return () => { live = false }
  }, [id, docs, tick]) // eslint-disable-line react-hooks/exhaustive-deps -- a rename while editing waits for the next read

  // The read view, drawn from the record's text; again after each save.
  useEffect(() => {
    if (!record || !parsed || editing) return
    let live = true, mounted: { destroy(): void } | null = null
    // Figures measure text, as slides do: the fonts first.
    void document.fonts.ready.then(() => { if (live && page.current) mounted = mountDoc(page.current, parsed, record.id) })
    return () => { live = false; mounted?.destroy() }
  }, [record, parsed, editing])

  const save = useCallback(async (doc: Doc) => {
    if (!record) return 'This doc is gone.'
    const next = { id: record.id, name: plainOf(doc.title).trim(), text: serializeDoc(doc), workspaceId: record.workspaceId }
    const why = await docs.save(next)
    if (!why) { setState({ ...next, updated: Date.now() }); onSaved() }
    return why
  }, [record, docs, onSaved])

  const header = (bar: ReactNode) => (
    <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
      <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
        <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
      </div>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
        <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
        <span aria-hidden className="text-ink-3">/</span>
        <span className="truncate text-ink-2">{record?.name ?? ''}</span>
      </nav>
      {bar}
      <AccountMenu account={account} />
    </header>
  )
  const body = (content: ReactNode) => (
    <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto">
      {sidebar}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-app-bg">
        {state === 'missing' && <p className="px-8 py-10 text-[13.5px] text-ink-2">That doc isn’t in this workspace.</p>}
        {state === 'failed' && <p className="px-8 py-10 text-[13.5px] text-ink-2">Couldn’t open the doc. Reload to try again.</p>}
        {content}
      </main>
    </div>
  )

  if (editing && parsed) {
    return (
      <DocEditing doc={parsed} save={save} onDone={() => setEditing(false)}>
        {(bar, editor) => <>{header(bar)}{body(editor)}</>}
      </DocEditing>
    )
  }
  return <>{header(record && <ReadBar canEdit={canEdit} onEdit={() => setEditing(true)} />)}{body(<div ref={page} />)}</>
}
