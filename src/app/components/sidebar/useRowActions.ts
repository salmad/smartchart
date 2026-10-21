/* Rename, delete and (for docs) create, as the sidebar does them: the list changes at once, the request goes out behind
   it, and a request that fails takes its change back with one sentence about it. Held above the sidebar (which can be
   hidden) so a failure is still told. The pending changes are laid over every list read from the server. */
import { useEffect, useRef, useState } from 'react'
import { descendants, keyOf, appendKey, type PageRef, type PageSummary } from '@/engine/pages/tree'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { DeckRepo } from '@/app/store'
import type { DocRepo } from '@/app/docs'
import { ordered, type Op } from '@/app/optimistic'
import { pageList } from './pageTree'


const NOTICE_MS = 6000

interface Deps {
  repos: { decks: DeckRepo; docs: DocRepo }
  /** The workspace on screen, whose list the changes belong to. */
  wsId: string | null
  onDeckDeleted: (id: string) => void
  onDocDeleted: (id: string) => void
  onOpenDoc: (id: string) => void
  /** A doc was renamed on the server: the one on screen is read again. */
  onDocRenamed: () => void
}

export interface NewDoc { id: string; name: string; text: string; workspaceId: string; parent?: PageRef }

export interface RowActions {
  /** The pending changes, to lay over every read of the page list. */
  ops: readonly Op<PageSummary>[]
  /** Rows with a request not yet answered. */
  pending: (ref: PageRef) => boolean
  /** Counts changes the server has answered, kept or not: the list is read again when it changes. */
  answered: number
  /** Lets go of the changes the server accepted, once the list has been read again and says so itself. */
  forget: () => void
  /** A sentence about the last failure, for a few seconds. */
  notice: string | null
  /** Resolves once nothing is queued for the page: opening it before that would show the old copy. */
  settled: (ref: PageRef) => Promise<void>
  /** Removes a page and the branch below it (`below`, as the list has it), the list changing at once. */
  remove: (page: { ref: PageRef; name: string }, below?: readonly PageRef[]) => void
  rename: (page: { ref: PageRef; name: string }, name: string) => void
  createDoc: (doc: NewDoc) => void
}

export function useRowActions(d: Deps): RowActions {
  const [ops, setOps] = useState<Op<PageSummary>[]>([])
  const [answered, setAnswered] = useState(0), [notice, setNotice] = useState<string | null>(null)
  const queue = useRef(ordered()).current, timer = useRef<ReturnType<typeof setTimeout>>(), sent = useRef(new Map<string, number>()), accepted = useRef(new Set<Op<PageSummary>>())
  const deps = useRef(d)
  deps.current = d
  useEffect(() => () => clearTimeout(timer.current), [])
  const tell = (s: string) => { setNotice(s); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), NOTICE_MS) }

  /** Shows the change now, sends the request behind it, and takes the change back (with a sentence) if it fails. */
  function act(op: Op<PageSummary>, sorry: [lead: string, tail: string], job: () => Promise<string | null>, done?: () => void) {
    setNotice(null)
    setOps((all) => [...all, op])
    sent.current.set(op.row, (sent.current.get(op.row) ?? 0) + 1)
    const end = () => { const n = (sent.current.get(op.row) ?? 1) - 1; if (n) sent.current.set(op.row, n); else sent.current.delete(op.row) }
    queue.run(op.row, job).catch(() => '').then((why) => {
      end()
      // An accepted change stays over the list until it has been read again, so no row flickers back meanwhile.
      if (why === null) accepted.current.add(op); else { setOps((all) => all.filter((o) => o !== op)); tell(`${sorry[0]} ${why || sorry[1]}`) }
      setAnswered((n) => n + 1)
      if (why === null) done?.()
    })
  }

  const op = (ref: PageRef, apply: (r: PageSummary[]) => PageSummary[]): Op<PageSummary> => ({ list: pageList(deps.current.wsId ?? ''), row: keyOf(ref), apply })
  const is = (a: PageRef, b: PageRef) => a.kind === b.kind && a.id === b.id

  return {
    ops, answered, notice,
    forget: () => {
      const gone = accepted.current
      if (!gone.size) return
      accepted.current = new Set()
      setOps((all) => all.filter((o) => !gone.has(o)))
    },
    pending: (ref) => sent.current.has(keyOf(ref)),
    settled: (ref) => queue.wait(keyOf(ref)),
    remove: ({ ref, name }, below = []) => {
      const { repos } = deps.current
      // The branch goes with it, as the server does it; each deleted page tells the app, which leaves only if it is the open one.
      act(op(ref, (r) => { const gone = [ref, ...descendants(r, ref)]; return r.filter((p) => !gone.some((g) => is(g, p))) }),
        [`Couldn’t delete “${name}”.`, 'It’s back in your list.'], async () => ((await (ref.kind === 'deck' ? repos.decks.remove(ref.id) : repos.docs.remove(ref.id))) ? null : ''))
      for (const p of [ref, ...below]) if (p.kind === 'deck') deps.current.onDeckDeleted(p.id); else deps.current.onDocDeleted(p.id)
    },
    rename: ({ ref, name: was }, name) => {
      const named = (r: PageSummary[]) => r.map((p) => (is(p, ref) ? { ...p, name } : p))
      if (ref.kind === 'deck') {
        act(op(ref, named), [`Couldn’t rename “${was}”.`, 'It has its old name back.'], async () => {
          const { decks } = deps.current.repos, deck = await decks.get(ref.id)
          return deck ? (await decks.save({ ...deck, name })) : 'That deck is gone.'
        })
        return
      }
      // A doc's name is its title: renaming rewrites the title, so the two never drift apart.
      act(op(ref, named), [`Couldn’t rename “${was}”.`, 'It has its old name back.'], async () => {
        const { docs } = deps.current.repos, doc = await docs.get(ref.id)
        return doc ? (await docs.save({ id: doc.id, name, text: serializeDoc({ ...parseDoc(doc.text).doc, title: name }), workspaceId: doc.workspaceId })) : 'That doc is gone.'
      }, () => deps.current.onDocRenamed())
    },
    createDoc: (doc) => {
      const ref: PageRef = { kind: 'doc', id: doc.id }, parent = doc.parent ?? null
      act(op(ref, (r) => (r.some((p) => is(p, ref)) ? r : [...r, { ...ref, name: doc.name, updated: Date.now(), slides: null, parent: parent && r.some((p) => is(p, parent)) ? parent : null, sortKey: appendKey(r, parent) }])),
        ['Couldn’t create the doc.', 'Try again.'], () => deps.current.repos.docs.save(doc), () => deps.current.onOpenDoc(doc.id))
    },
  }
}
