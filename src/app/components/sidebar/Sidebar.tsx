import { useEffect, useRef, useState } from 'react'
import { descendants, type PageKind, type PageRef } from '@/engine/pages/tree'
import { serializeDoc } from '@/engine/docs/serialize'
import { starterDoc, type DocStarter } from '@/engine/starters'
import type { DeckRepo } from '@/app/store'
import type { DocRepo } from '@/app/docs'
import type { PageRepo } from '@/app/pages'
import type { WorkspaceRepo } from '@/app/workspaces'
import { DEV_ACCOUNT } from '@/app/dev-account'
import { lastDeckIdInWorkspace } from '@/app/cached-decks'
import { DeleteDeck } from '../DeleteDeck'
import { MovePicker } from './MovePicker'
import { Members } from './Members'
import { NewDoc } from './NewDoc'
import { pathTo, type Row } from './flatten'
import { PageTree as PageTreePanel } from './PageTree.tsx'
import { usePageTree } from './usePageTree'
import { useSidebarWidth } from './useSidebarWidth'
import { RenameItem } from './RenameItem'
import type { RowActions } from './useRowActions'
import type { WorkspaceState } from './useWorkspace'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

interface Props {
  ws: WorkspaceState
  /** Rename, delete and new doc: shown at once, sent behind the scenes. */
  rows: RowActions
  repos: { decks: DeckRepo; docs: DocRepo; pages: PageRepo; workspaces: WorkspaceRepo }
  /** The deck held in the editor (its name is live, and it lists before its first save), and the doc on screen. */
  open: { deck: { id: string | null; name: string; slides: number; parent: PageRef | null }; doc: string | null; docTick: number }
  busy: boolean
  onOpenDeck: (id: string) => void; onNewDeck: (parent: PageRef | null) => void
  onOpenDoc: (id: string) => void
  /** The open deck is renamed through the editor, so its live state and its next save agree. */
  onRenameOpenDeck: (name: string) => void
  /** The signed-in user's id, for their own row in Members. */
  me: string
}

const BLANK_TITLE = 'Untitled doc'
const newDocId = () => `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The workspace down the left (Notion's shape): its name and switcher at the top, then its pages as one tree of docs and
    decks. Hidden with ⌘\\. Editors and owners make, rename and delete; a viewer only opens and expands. */
export function Sidebar({ ws, rows: actions, repos, open, busy, onOpenDeck, onNewDeck, onOpenDoc, onRenameOpenDeck, me }: Props) {
  const size = useSidebarWidth()
  const wsId = ws.current?.id ?? null, canWrite = ws.current?.role !== 'viewer'
  const [renaming, setRenaming] = useState<{ kind: PageKind | 'workspace'; row?: Row } | null>(null)
  const [doomed, setDoomed] = useState<{ row: Row; subpages: number } | null>(null), [said, setSaid] = useState<string | null>(null), [making, setMaking] = useState<{ parent: PageRef | null } | null>(null)
  const [members, setMembers] = useState(false), [moving, setMoving] = useState<Row | null>(null)
  const { deck } = open
  const openRef: PageRef | null = open.doc !== null ? { kind: 'doc', id: open.doc } : deck.id ? { kind: 'deck', id: deck.id } : null
  const tree = usePageTree({ repo: repos.pages, workspaceId: wsId, viewer: me, open: openRef, deck, pendingParent: deck.parent, tick: open.docTick,
    ops: actions.ops, account: me === DEV_ACCOUNT.id ? undefined : me })
  // Once the server has answered a change, the list is read again, so it says what the server says; a change it accepted is let go of then.
  useEffect(() => { if (actions.answered) void tree.reload().finally(actions.forget) }, [actions.answered]) // eslint-disable-line react-hooks/exhaustive-deps
  // Pointing at a page for a moment reads it ahead, so the click opens it without waiting: a deck into this browser once,
  // never the open one; a doc into memory.
  const ahead = useRef(new Set<string>())
  const readAhead = (ref: PageRef) => {
    if (ref.kind === 'doc') {
      if (ref.id === open.doc || repos.docs.peek?.(ref.id)?.doc || actions.pending(ref)) return
      void repos.docs.get(ref.id).then(() => repos.docs.comments(ref.id)).catch(() => undefined)
      return
    }
    if (ref.kind !== 'deck' || ref.id === deck.id || repos.decks.peek?.(ref.id) || ahead.current.has(ref.id) || me === DEV_ACCOUNT.id || actions.pending(ref)) return
    ahead.current.add(ref.id)
    void repos.decks.get(ref.id).catch(() => undefined)
  }
  // A workspace list that loaded with no workspace in it (a server without them) has no pages to show.
  const rows = ws.list !== null && !wsId ? [] : tree.rows
  // A refusal is said for a few seconds, then goes.
  useEffect(() => { if (!tree.notice) return; const t = setTimeout(tree.dismiss, 6000); return () => clearTimeout(t) }, [tree.notice, tree.dismiss])
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 6000); return () => clearTimeout(t) }, [said])
  // A page with a request on its way opens once that has been answered: its stored copy is not up to date before.
  const openPage = (ref: PageRef) => void actions.settled(ref).then(() => (ref.kind === 'deck' ? onOpenDeck(ref.id) : onOpenDoc(ref.id)))

  // Switching opens the deck last used in that workspace from cache when possible; list fills in behind.
  const switchTo = (id: string) => {
    ws.switchTo(id)
    const account = me === DEV_ACCOUNT.id ? undefined : me
    void (async () => {
      if (account) {
        const last = await lastDeckIdInWorkspace(account, id)
        if (last && (repos.decks.peek?.(last) || await repos.decks.kept?.(last))) {
          onOpenDeck(last)
          return
        }
      }
      const list = await repos.decks.list(id).catch(() => [])
      const first = list.find((d) => d.slides > 0)
      if (first) onOpenDeck(first.id)
      else onNewDeck(null)
    })()
  }
  const rename = async (name: string) => {
    if (!renaming) return
    const { kind, row } = renaming
    if (kind === 'workspace') {
      const id = await repos.workspaces.create(name)
      await ws.reload(id)
      void repos.workspaces.use(id).catch(() => undefined)
      onNewDeck(null)
      return
    }
    if (!row) return
    if (kind === 'deck' && row.ref.id === deck.id) { onRenameOpenDeck(name); return }
    actions.rename({ ref: row.ref, name: row.name }, name)
  }
  // Deleting takes every page below it too, so the dialog opens once it knows how many there are; if it can't know, nothing is deleted.
  const askDelete = async (row: Row) => {
    try { setDoomed({ row, subpages: await repos.pages.subpages(row.ref) }) } catch { setSaid('Couldn’t check for subpages.') }
  }
  const remove = () => {
    if (!doomed) return
    const { ref } = doomed.row, branch = [ref, ...descendants(tree.pages ?? [], ref)]
    setDoomed(null)
    actions.remove({ ref, name: doomed.row.name }, branch.slice(1))
  }
  const createDoc = async (s: DocStarter | null) => {
    const name = s ? starterDoc(s).title || s.label : BLANK_TITLE, text = s ? s.markdown.join('\n') : serializeDoc({ title: BLANK_TITLE, blocks: [] })
    if (wsId) actions.createDoc({ id: newDocId(), name, text, workspaceId: wsId, ...(making?.parent ? { parent: making.parent } : {}) })
  }

  return (
    <nav ref={size.nav} aria-label="Workspace" className="relative flex w-[var(--sidebar-w,248px)] min-h-0 flex-none flex-col border-r border-line bg-app-bg max-[900px]:hidden">
      <div {...size.gripProps} className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none"><span className="mx-auto block h-full w-px bg-transparent transition-colors group-hover:bg-gold/60 group-focus-visible:bg-gold group-active:bg-gold" /></div>
      <div className="h-12 px-2 pb-1 pt-2">
        {ws.current && <WorkspaceSwitcher list={ws.list} current={ws.current} busy={busy} onSwitch={(id) => void switchTo(id)}
          onNew={() => setRenaming({ kind: 'workspace' })} onMembers={() => setMembers(true)} />}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto] overflow-y-auto pb-4">
        <PageTreePanel rows={rows} failed={tree.failed} canWrite={canWrite} busy={busy} onOpen={openPage} onToggle={tree.toggle} onAhead={readAhead}
          onNew={(kind, parent) => (kind === 'doc' ? setMaking({ parent }) : onNewDeck(parent))} onRename={(row) => setRenaming({ kind: row.ref.kind, row })} onPick={setMoving} onMove={(ref, to) => tree.move(ref, to)} onDelete={(row) => void askDelete(row)} pages={tree.pages} />
        {(tree.notice ?? said) && <p role="status" className="mx-2 mt-1 rounded-lg bg-panel px-2.5 py-2 text-[12.5px] leading-[1.4] text-ink-2">{tree.notice ?? said}</p>}
      </div>

      <RenameItem open={renaming && (renaming.kind === 'workspace'
        ? { title: 'New workspace', name: '', action: 'Create', about: 'A place to share docs and decks with your team. You can invite people once it exists.' }
        : { title: `Rename ${renaming.kind}`, name: renaming.row?.name ?? '', action: 'Rename' })}
        onSubmit={rename} onClose={() => setRenaming(null)} />
      <DeleteDeck name={doomed?.row.name ?? null} what={doomed?.row.ref.kind ?? 'deck'} subpages={doomed?.subpages ?? 0} onCancel={() => setDoomed(null)} onConfirm={remove} />
      <MovePicker page={moving && { ref: moving.ref, name: moving.name }} pages={tree.pages ?? []} onClose={() => setMoving(null)}
        onMove={async (parent) => { const why = moving ? await tree.move(moving.ref, { parent }) : null; if (!why && parent) for (const p of [...pathTo(tree.pages ?? [], parent), parent]) tree.toggle(p, true); return why }} />
      {actions.notice && <p role="alert" className="border-t border-line px-4 py-3 text-[12.5px] leading-[1.45] text-ink-2">{actions.notice}</p>}
      <NewDoc open={making !== null} onCreate={createDoc} onClose={() => setMaking(null)} />
      {/* Leaving opens the most recently used workspace that is left. */}
      <Members workspace={members ? ws.current : null} repo={repos.workspaces} me={me} onClose={() => setMembers(false)}
        onLeft={() => { setMembers(false); void ws.reload().then(() => onNewDeck(null)) }} />
    </nav>
  )
}
