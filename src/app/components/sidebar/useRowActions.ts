/* Rename, delete and (for docs) create, as the sidebar does them: the list changes at once, the request goes out behind
   it, and a request that fails takes its change back with one sentence about it. Held above the sidebar (which can be
   hidden) so a failure is still told. The pending changes are laid over every list read from the server. */
import { useEffect, useRef, useState } from 'react'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { DeckRepo } from '@/app/store'
import type { DocRepo } from '@/app/docs'
import { ordered, type Op } from '@/app/optimistic'

/** What is stored of a list: what the rows show, not the slide a deck summary also carries. */
export interface SlimDeck { id: string; name: string; updated: number; slides: number }
export interface SlimDoc { id: string; name: string; updated: number }

/** The stored name of a workspace's list; without a workspace, every deck the user can open. */
export const deckList = (wsId: string | null) => `decks:${wsId ?? 'all'}`
export const docList = (wsId: string) => `docs:${wsId}`

const NOTICE_MS = 6000

interface Deps {
  repos: { decks: DeckRepo; docs: DocRepo }
  /** The workspace on screen, whose lists the changes belong to. */
  wsId: string | null
  onDeckDeleted: (id: string) => void
  onDocDeleted: (id: string) => void
  onOpenDoc: (id: string) => void
  /** A doc was renamed on the server: the one on screen is read again. */
  onDocRenamed: () => void
}

export interface RowActions {
  deckOps: readonly Op<SlimDeck>[]
  docOps: readonly Op<SlimDoc>[]
  /** Rows with a request not yet answered. */
  pending: (id: string) => boolean
  /** Counts failures: the lists are read again when it changes. */
  lost: number
  /** A sentence about the last failure, for a few seconds. */
  notice: string | null
  /** Resolves once nothing is queued for the row: opening it before that would show the old copy. */
  settled: (id: string) => Promise<void>
  removeDeck: (row: { id: string; name: string }) => void
  removeDoc: (row: { id: string; name: string }) => void
  renameDeck: (row: { id: string; name: string }, name: string) => void
  renameDoc: (row: { id: string; name: string }, name: string) => void
  createDoc: (doc: { id: string; name: string; text: string; workspaceId: string }) => void
}

export function useRowActions(d: Deps): RowActions {
  const [deckOps, setDeckOps] = useState<Op<SlimDeck>[]>([]), [docOps, setDocOps] = useState<Op<SlimDoc>[]>([])
  const [lost, setLost] = useState(0), [notice, setNotice] = useState<string | null>(null)
  const queue = useRef(ordered()).current, timer = useRef<ReturnType<typeof setTimeout>>(), sent = useRef(new Map<string, number>())
  const deps = useRef(d)
  deps.current = d
  useEffect(() => () => clearTimeout(timer.current), [])
  const tell = (s: string) => { setNotice(s); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), NOTICE_MS) }

  /** Shows the change now, sends the request behind it, and takes the change back (with a sentence) if it fails. */
  function act<R extends { id: string }>(set: React.Dispatch<React.SetStateAction<Op<R>[]>>, op: Op<R>, sorry: string, job: () => Promise<string | null>, done?: () => void) {
    setNotice(null)
    set((all) => [...all, op])
    sent.current.set(op.row, (sent.current.get(op.row) ?? 0) + 1)
    const end = () => { const n = (sent.current.get(op.row) ?? 1) - 1; if (n) sent.current.set(op.row, n); else sent.current.delete(op.row) }
    queue.run(op.row, job).catch(() => '').then((why) => {
      end()
      set((all) => all.filter((o) => o !== op))
      if (why === null) { done?.(); return }
      tell(why ? `${sorry} ${why}` : sorry)
      setLost((n) => n + 1)
    })
  }

  const deckOp = (row: string, apply: (r: SlimDeck[]) => SlimDeck[]): Op<SlimDeck> => ({ list: deckList(deps.current.wsId), row, apply })
  const docOp = (row: string, apply: (r: SlimDoc[]) => SlimDoc[]): Op<SlimDoc> => ({ list: docList(deps.current.wsId ?? ''), row, apply })
  const without = <T extends { id: string }>(id: string) => (r: T[]) => r.filter((x) => x.id !== id)
  const named = <T extends { id: string; name: string }>(id: string, name: string) => (r: T[]) => r.map((x) => (x.id === id ? { ...x, name } : x))

  return {
    deckOps, docOps, lost, notice,
    pending: (id) => sent.current.has(id),
    settled: (id) => queue.wait(id),
    removeDeck: ({ id, name }) => {
      act(setDeckOps, deckOp(id, without(id)), `Couldn’t delete “${name}”. It’s back in your list.`, async () => ((await deps.current.repos.decks.remove(id)) ? null : ''))
      deps.current.onDeckDeleted(id)
    },
    removeDoc: ({ id, name }) => {
      act(setDocOps, docOp(id, without(id)), `Couldn’t delete “${name}”. It’s back in your list.`, async () => ((await deps.current.repos.docs.remove(id)) ? null : ''))
      deps.current.onDocDeleted(id)
    },
    renameDeck: ({ id, name: was }, name) => act(setDeckOps, deckOp(id, named(id, name)), `Couldn’t rename “${was}”. It has its old name back.`, async () => {
      const { decks } = deps.current.repos, deck = await decks.get(id)
      return deck ? (await decks.save({ ...deck, name })) : 'That deck is gone.'
    }),
    // A doc's name is its title: renaming rewrites the title, so the two never drift apart.
    renameDoc: ({ id, name: was }, name) => act(setDocOps, docOp(id, named(id, name)), `Couldn’t rename “${was}”. It has its old name back.`, async () => {
      const { docs } = deps.current.repos, doc = await docs.get(id)
      return doc ? (await docs.save({ id: doc.id, name, text: serializeDoc({ ...parseDoc(doc.text).doc, title: name }), workspaceId: doc.workspaceId })) : 'That doc is gone.'
    }, () => deps.current.onDocRenamed()),
    createDoc: (doc) => act(setDocOps, docOp(doc.id, (r) => (r.some((x) => x.id === doc.id) ? r : [{ id: doc.id, name: doc.name, updated: Date.now() }, ...r])),
      'Couldn’t create the doc. Try again.', () => deps.current.repos.docs.save(doc), () => deps.current.onOpenDoc(doc.id)),
  }
}
