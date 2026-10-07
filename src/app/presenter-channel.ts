/* The editor, the presentation and the presenter view are three independent tabs on one BroadcastChannel (same origin).
   The source (the editor, or a shared deck's page) publishes the deck whenever it changes; the presentation (/present)
   and the presenter view (/presenter) each show it and keep to one slide between them. None owns another: closing one
   leaves the rest running, and an edit made in the source shows in both at once. A key ties a source to its viewers, so
   two decks open in two tabs never mix. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Deck } from '@/engine/types'

type Msg =
  | { type: 'hello'; k: string | null }
  | { type: 'deck'; k: string; deck: Deck }
  | { type: 'at'; k: string | null; index: number }

const liveChannel = () => new BroadcastChannel('occam-live')

/** Publishes the deck for the presentation and the presenter view: on every change, and to any viewer that asks. */
export function usePublishDeck(deck: Deck | null, key: string) {
  const latest = useRef(deck), channel = useRef<BroadcastChannel | null>(null)
  latest.current = deck
  useEffect(() => {
    const ch = liveChannel()
    channel.current = ch
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.type === 'hello' && (m.k === null || m.k === key) && latest.current) ch.postMessage({ type: 'deck', k: key, deck: latest.current } satisfies Msg)
    }
    return () => { ch.close(); channel.current = null }
  }, [key])
  useEffect(() => { if (deck) channel.current?.postMessage({ type: 'deck', k: key, deck } satisfies Msg) }, [deck, key])
}

/** A fresh key for one source tab. */
export const newLiveKey = () => Math.random().toString(36).slice(2, 10)

const params = () => new URLSearchParams(location.search)
const fromHash = () => { const m = /^#\/(\d+)$/.exec(location.hash); return m ? Number(m[1]) - 1 : null }

/** A viewer's side: the deck as last published, and the slide shown, kept the same in every viewer. */
export function useLiveShow() {
  const key = useMemo(() => params().get('k'), [])
  const start = useMemo(fromHash, [])
  const [deck, setDeck] = useState<Deck | null>(null), [at, setAt] = useState(start ?? 0)
  const channel = useRef<BroadcastChannel | null>(null), atRef = useRef(at), deckRef = useRef<Deck | null>(null), source = useRef<string | null>(key)
  const count = deck?.slides.length ?? 0
  const index = Math.max(0, Math.min(at, count - 1))
  atRef.current = index

  useEffect(() => {
    const ch = liveChannel()
    channel.current = ch
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.type === 'deck') {
        if (source.current !== null && m.k !== source.current) return
        source.current = m.k
        const first = deckRef.current === null
        deckRef.current = m.deck
        setDeck(m.deck)
        // A viewer opened without a slide asks the others which one it is on.
        if (first && start === null) ch.postMessage({ type: 'hello', k: m.k } satisfies Msg)
      }
      if (m.type === 'at' && (source.current === null || m.k === source.current)) { atRef.current = m.index; setAt(m.index) }
      if (m.type === 'hello' && deckRef.current && (source.current === null || m.k === source.current)) ch.postMessage({ type: 'at', k: source.current, index: atRef.current } satisfies Msg)
    }
    ch.postMessage({ type: 'hello', k: key } satisfies Msg)
    return () => { ch.close(); channel.current = null }
  }, [key, start])

  const go = (to: number) => {
    const n = deckRef.current?.slides.length ?? 0
    if (!n) return
    const next = Math.max(0, Math.min(n - 1, to))
    atRef.current = next
    setAt(next)
    channel.current?.postMessage({ type: 'at', k: source.current, index: next } satisfies Msg)
  }
  return { deck, index, go, atRef, key: source }
}

/** The presentation, in its own tab (the editor's tab stays free to edit); it finds the deck over the channel. */
export const openPresentation = (key: string, index: number) => window.open(`/present?k=${key}#/${index + 1}`, 'occam-present')

/** The presenter view, in its own window (P while presenting). */
export const openPresenter = (key: string | null, index: number) => window.open(`/presenter${key ? `?k=${key}` : ''}#/${index + 1}`, 'occam-presenter', 'popup,width=1280,height=820')
