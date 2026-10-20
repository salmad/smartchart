import { useEffect, useState } from 'react'
import { descendants, type PageKind, type PageRef } from '@/engine/pages/tree'
import { starterDoc, type DocStarter } from '@/engine/starters'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { DeckRepo } from '@/app/store'
import type { DocRepo } from '@/app/docs'
import type { PageRepo } from '@/app/pages'
import type { WorkspaceRepo } from '@/app/workspaces'
import { DeleteDeck } from '../DeleteDeck'
import { MovePicker } from './MovePicker'
import { Members } from './Members'
import { NewDoc } from './NewDoc'
import { pathTo, type Row } from './flatten'
import { PageTree } from './PageTree'
import { usePageTree } from './usePageTree'
import { RenameItem } from './RenameItem'
import type { WorkspaceState } from './useWorkspace'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

interface Props {
  ws: WorkspaceState
  repos: { decks: DeckRepo; docs: DocRepo; pages: PageRepo; workspaces: WorkspaceRepo }
  /** The deck held in the editor (its name is live, and it lists before its first save), and the doc on screen. */
  open: { deck: { id: string | null; name: string; slides: number; parent: PageRef | null }; doc: string | null; docTick: number }
  busy: boolean
  onOpenDeck: (id: string) => void; onNewDeck: (parent: PageRef | null) => void; onDeckDeleted: (id: string) => void
  onOpenDoc: (id: string) => void; onDocDeleted: (id: string) => void; onDocRenamed: () => void
  /** The open deck is renamed through the editor, so its live state and its next save agree. */
  onRenameOpenDeck: (name: string) => void
  /** The signed-in user's id, for their own row in Members. */
  me: string
}

const newDocId = () => `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The workspace down the left (Notion's shape): its name and switcher at the top, then its pages as one tree of docs and
    decks. Hidden with ⌘\\. Editors and owners make, rename and delete; a viewer only opens and expands. */
export function Sidebar({ ws, repos, open, busy, onOpenDeck, onNewDeck, onDeckDeleted, onOpenDoc, onDocDeleted, onDocRenamed, onRenameOpenDeck, me }: Props) {
  const wsId = ws.current?.id ?? null, canWrite = ws.current?.role !== 'viewer'
  const [renaming, setRenaming] = useState<{ kind: PageKind | 'workspace'; row?: Row } | null>(null)
  const [doomed, setDoomed] = useState<{ row: Row; subpages: number } | null>(null), [said, setSaid] = useState<string | null>(null), [making, setMaking] = useState<{ parent: PageRef | null } | null>(null)
  const [members, setMembers] = useState(false), [moving, setMoving] = useState<Row | null>(null)
  const { deck } = open
  const openRef: PageRef | null = open.doc !== null ? { kind: 'doc', id: open.doc } : deck.id ? { kind: 'deck', id: deck.id } : null
  const tree = usePageTree({ repo: repos.pages, workspaceId: wsId, viewer: me, open: openRef, deck, pendingParent: deck.parent, tick: open.docTick })
  // A workspace list that loaded with no workspace in it (a server without them) has no pages to show.
  const rows = ws.list !== null && !wsId ? [] : tree.rows
  // A refusal is said for a few seconds, then goes.
  useEffect(() => { if (!tree.notice) return; const t = setTimeout(tree.dismiss, 6000); return () => clearTimeout(t) }, [tree.notice, tree.dismiss])
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 6000); return () => clearTimeout(t) }, [said])
  const openPage = (ref: PageRef) => (ref.kind === 'deck' ? onOpenDeck(ref.id) : onOpenDoc(ref.id))

  // Switching opens the new workspace's most recent deck, or a new deck there.
  const switchTo = async (id: string) => {
    ws.switchTo(id)
    const first = (await repos.decks.list(id).catch(() => [])).find((d) => d.slides > 0)
    if (first) onOpenDeck(first.id)
    else onNewDeck(null)
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
    if (kind === 'deck') {
      if (row.ref.id === deck.id) { onRenameOpenDeck(name); return }
      const d = await repos.decks.get(row.ref.id)
      const why = d ? await repos.decks.save({ ...d, name }) : 'That deck is gone.'
      if (why) throw new Error(why)
      await tree.reload()
      return
    }
    // A doc's name is its title: renaming rewrites the title, so the two never drift apart.
    const d = await repos.docs.get(row.ref.id)
    const why = d ? await repos.docs.save({ id: d.id, name, text: serializeDoc({ ...parseDoc(d.text).doc, title: name }), workspaceId: d.workspaceId }) : 'That doc is gone.'
    if (why) throw new Error(why)
    onDocRenamed()
  }
  // Deleting takes every page below it too, so the dialog opens once it knows how many there are; if it can't know, nothing is deleted.
  const askDelete = async (row: Row) => {
    try { setDoomed({ row, subpages: await repos.pages.subpages(row.ref) }) } catch { setSaid('Couldn’t check for subpages.') }
  }
  const remove = async () => {
    if (!doomed) return
    const { ref } = doomed.row, branch = [ref, ...descendants(tree.pages ?? [], ref)]
    setDoomed(null)
    const gone = await (ref.kind === 'deck' ? repos.decks.remove(ref.id) : repos.docs.remove(ref.id))
    await tree.reload()
    if (!gone) return
    // The open page may be anywhere in the branch: each deleted page tells the app, which leaves only if it is the open one.
    for (const p of branch) if (p.kind === 'deck') onDeckDeleted(p.id); else onDocDeleted(p.id)
  }
  const createDoc = async (s: DocStarter) => {
    if (!wsId) return
    const id = newDocId(), why = await repos.docs.save({ id, name: starterDoc(s).title || s.label, text: s.markdown.join('\n'), workspaceId: wsId, ...(making?.parent ? { parent: making.parent } : {}) })
    if (why) throw new Error(why)
    await tree.reload()
    onOpenDoc(id)
  }

  return (
    <nav aria-label="Workspace" className="flex w-[248px] min-h-0 flex-none flex-col border-r border-line bg-app-bg max-[900px]:hidden">
      <div className="h-12 px-2 pb-1 pt-2">
        {ws.current && <WorkspaceSwitcher list={ws.list} current={ws.current} busy={busy} onSwitch={(id) => void switchTo(id)}
          onNew={() => setRenaming({ kind: 'workspace' })} onMembers={() => setMembers(true)} />}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start overflow-y-auto pb-4">
        <PageTree rows={rows} failed={tree.failed} canWrite={canWrite} busy={busy} onOpen={openPage} onToggle={tree.toggle}
          onNew={(kind, parent) => (kind === 'doc' ? setMaking({ parent }) : onNewDeck(parent))} onRename={(row) => setRenaming({ kind: row.ref.kind, row })} onPick={setMoving} onMove={(ref, to) => tree.move(ref, to)} onDelete={(row) => void askDelete(row)} />
        {(tree.notice ?? said) && <p role="status" className="mx-2 mt-1 rounded-lg bg-panel px-2.5 py-2 text-[12.5px] leading-[1.4] text-ink-2">{tree.notice ?? said}</p>}
      </div>

      <RenameItem open={renaming && (renaming.kind === 'workspace'
        ? { title: 'New workspace', name: '', action: 'Create', about: 'A place to share docs and decks with your team. You can invite people once it exists.' }
        : { title: `Rename ${renaming.kind}`, name: renaming.row?.name ?? '', action: 'Rename' })}
        onSubmit={rename} onClose={() => setRenaming(null)} />
      <DeleteDeck name={doomed?.row.name ?? null} what={doomed?.row.ref.kind ?? 'deck'} subpages={doomed?.subpages ?? 0} onCancel={() => setDoomed(null)} onConfirm={() => void remove()} />
      <MovePicker page={moving && { ref: moving.ref, name: moving.name }} pages={tree.pages ?? []} onClose={() => setMoving(null)}
        onMove={async (parent) => { const why = moving ? await tree.move(moving.ref, { parent }) : null; if (!why && parent) for (const p of [...pathTo(tree.pages ?? [], parent), parent]) tree.toggle(p, true); return why }} />
      <NewDoc open={making !== null} onCreate={createDoc} onClose={() => setMaking(null)} />
      {/* Leaving opens the most recently used workspace that is left. */}
      <Members workspace={members ? ws.current : null} repo={repos.workspaces} me={me} onClose={() => setMembers(false)}
        onLeft={() => { setMembers(false); void ws.reload().then(() => onNewDeck(null)) }} />
    </nav>
  )
}
