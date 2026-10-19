import { useCallback, useEffect, useState } from 'react'
import { starterDoc, type DocStarter } from '@/engine/starters'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { DeckRepo } from '@/app/store'
import type { DocRepo } from '@/app/docs'
import type { WorkspaceRepo } from '@/app/workspaces'
import { DeleteDeck } from '../DeleteDeck'
import { ago } from './ago'
import { ItemList, type ListRow } from './ItemList'
import { Members } from './Members'
import { NewDoc } from './NewDoc'
import { RenameItem } from './RenameItem'
import type { WorkspaceState } from './useWorkspace'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

interface Props {
  ws: WorkspaceState
  repos: { decks: DeckRepo; docs: DocRepo; workspaces: WorkspaceRepo }
  /** The deck held in the editor (its name is live, and it lists before its first save), and the doc on screen. */
  open: { deck: { id: string | null; name: string; slides: number }; doc: string | null; docTick: number }
  busy: boolean
  onOpenDeck: (id: string) => void; onNewDeck: () => void; onDeckDeleted: (id: string) => void
  onOpenDoc: (id: string) => void; onDocDeleted: (id: string) => void; onDocRenamed: () => void
  /** The open deck is renamed through the editor, so its live state and its next save agree. */
  onRenameOpenDeck: (name: string) => void
  /** The signed-in user's id, for their own row in Members. */
  me: string
}

type Kind = 'deck' | 'doc'
const slides = (n: number) => `${n} slide${n === 1 ? '' : 's'}`
const newDocId = () => `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The workspace down the left (Notion's shape): its name and switcher at the top, then its docs and its decks, newest
    first. Hidden with ⌘\\. Editors and owners make, rename and delete; a viewer only opens. */
export function Sidebar({ ws, repos, open, busy, onOpenDeck, onNewDeck, onDeckDeleted, onOpenDoc, onDocDeleted, onDocRenamed, onRenameOpenDeck, me }: Props) {
  const wsId = ws.current?.id ?? null, canWrite = ws.current?.role !== 'viewer'
  const [decks, setDecks] = useState<ListRow[] | null>(null), [docs, setDocs] = useState<ListRow[] | null>(null)
  const [failed, setFailed] = useState<Record<Kind, boolean>>({ deck: false, doc: false })
  const [renaming, setRenaming] = useState<{ kind: Kind | 'workspace'; row?: ListRow } | null>(null)
  const [doomed, setDoomed] = useState<{ kind: Kind; row: ListRow } | null>(null), [making, setMaking] = useState(false)
  const [members, setMembers] = useState(false)

  // Without a workspace (the list failed, or a server without them), every deck the user can open is listed, and no docs.
  const loaded = ws.list !== null
  const loadDecks = useCallback(async () => {
    if (!loaded) return
    try { setDecks((await repos.decks.list(wsId ?? undefined)).filter((d) => d.slides > 0).map((d) => ({ id: d.id, name: d.name, sub: `${slides(d.slides)} · ${ago(d.updated)}` }))); setFailed((f) => ({ ...f, deck: false })) }
    catch { setFailed((f) => ({ ...f, deck: true })) }
  }, [repos.decks, wsId, loaded])
  const loadDocs = useCallback(async () => {
    if (!wsId) return
    try { setDocs((await repos.docs.list(wsId)).map((d) => ({ id: d.id, name: d.name, sub: ago(d.updated) }))); setFailed((f) => ({ ...f, doc: false })) }
    catch { setFailed((f) => ({ ...f, doc: true })) }
  }, [repos.docs, wsId])
  // Read again when the open deck or doc changes, so one saved for the first time shows with its real time.
  useEffect(() => { void loadDecks() }, [loadDecks, open.deck.id])
  useEffect(() => { void loadDocs() }, [loadDocs, open.doc, open.docTick])

  // The open deck lists before its first save, and always under its live name.
  const { deck } = open, onDeck = open.doc === null
  const deckRows = decks && (deck.id && deck.slides && !decks.some((r) => r.id === deck.id)
    ? [{ id: deck.id, name: deck.name, sub: `${slides(deck.slides)} · just now` }, ...decks]
    : decks.map((r) => (r.id === deck.id ? { ...r, name: deck.name, sub: `${slides(deck.slides)} · ${r.sub.split(' · ')[1]}` } : r)))

  // Switching opens the new workspace's most recent deck, or a new deck there.
  const switchTo = async (id: string) => {
    ws.switchTo(id)
    const first = (await repos.decks.list(id).catch(() => [])).find((d) => d.slides > 0)
    if (first) onOpenDeck(first.id)
    else onNewDeck()
  }
  const rename = async (name: string) => {
    if (!renaming) return
    const { kind, row } = renaming
    if (kind === 'workspace') {
      const id = await repos.workspaces.create(name)
      await ws.reload(id)
      void repos.workspaces.use(id).catch(() => undefined)
      onNewDeck()
      return
    }
    if (!row) return
    if (kind === 'deck') {
      if (row.id === deck.id) { onRenameOpenDeck(name); setDecks((d) => d?.map((r) => (r.id === row.id ? { ...r, name } : r)) ?? null); return }
      const d = await repos.decks.get(row.id)
      const why = d ? await repos.decks.save({ ...d, name }) : 'That deck is gone.'
      if (why) throw new Error(why)
      await loadDecks()
      return
    }
    // A doc's name is its title: renaming rewrites the title, so the two never drift apart.
    const d = await repos.docs.get(row.id)
    const why = d ? await repos.docs.save({ id: d.id, name, text: serializeDoc({ ...parseDoc(d.text).doc, title: name }), workspaceId: d.workspaceId }) : 'That doc is gone.'
    if (why) throw new Error(why)
    onDocRenamed()
  }
  const remove = async () => {
    if (!doomed) return
    const { kind, row } = doomed
    setDoomed(null)
    if (kind === 'deck') {
      setDecks((all) => all?.filter((x) => x.id !== row.id) ?? null)
      if (await repos.decks.remove(row.id)) onDeckDeleted(row.id); else { setFailed((f) => ({ ...f, deck: true })); void loadDecks() }
      return
    }
    setDocs((all) => all?.filter((x) => x.id !== row.id) ?? null)
    if (await repos.docs.remove(row.id)) onDocDeleted(row.id); else { setFailed((f) => ({ ...f, doc: true })); void loadDocs() }
  }
  const createDoc = async (s: DocStarter) => {
    if (!wsId) return
    const id = newDocId(), why = await repos.docs.save({ id, name: starterDoc(s).title || s.label, text: s.markdown.join('\n'), workspaceId: wsId })
    if (why) throw new Error(why)
    await loadDocs()
    onOpenDoc(id)
  }

  return (
    <nav aria-label="Workspace" className="flex w-[248px] min-h-0 flex-none flex-col border-r border-line bg-app-bg max-[900px]:hidden">
      <div className="h-12 px-2 pb-1 pt-2">
        {ws.current && <WorkspaceSwitcher list={ws.list} current={ws.current} busy={busy} onSwitch={(id) => void switchTo(id)}
          onNew={() => setRenaming({ kind: 'workspace' })} onMembers={() => setMembers(true)} />}
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-4">
        {(wsId || !loaded) && <ItemList title="Docs" rows={wsId ? docs : null} error={failed.doc} current={open.doc} canWrite={canWrite} busy={busy}
          onOpen={onOpenDoc} onNew={() => setMaking(true)} onRename={(row) => setRenaming({ kind: 'doc', row })} onDelete={(row) => setDoomed({ kind: 'doc', row })} />}
        <ItemList title="Decks" rows={loaded ? deckRows : null} error={failed.deck} current={onDeck ? deck.id : null} canWrite={canWrite} busy={busy}
          onOpen={onOpenDeck} onNew={onNewDeck} onRename={(row) => setRenaming({ kind: 'deck', row })} onDelete={(row) => setDoomed({ kind: 'deck', row })} />
      </div>

      <RenameItem open={renaming && (renaming.kind === 'workspace'
        ? { title: 'New workspace', name: '', action: 'Create', about: 'A place to share docs and decks with your team. You can invite people once it exists.' }
        : { title: `Rename ${renaming.kind}`, name: renaming.row?.name ?? '', action: 'Rename' })}
        onSubmit={rename} onClose={() => setRenaming(null)} />
      <DeleteDeck name={doomed?.row.name ?? null} what={doomed?.kind ?? 'deck'} onCancel={() => setDoomed(null)} onConfirm={() => void remove()} />
      <NewDoc open={making} onCreate={createDoc} onClose={() => setMaking(false)} />
      {/* Leaving opens the most recently used workspace that is left. */}
      <Members workspace={members ? ws.current : null} repo={repos.workspaces} me={me} onClose={() => setMembers(false)}
        onLeft={() => { setMembers(false); void ws.reload().then(onNewDeck) }} />
    </nav>
  )
}
