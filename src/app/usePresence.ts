/* Who is working on the deck, for a writer elsewhere (an agent over MCP, another tab) to see: a turn running, or a
   slide open for hand editing. Entries expire on the server, so both are renewed while they last and cleared when they end. */
import { useEffect, useRef } from 'react'
import type { DeckRepo } from './store'

export function usePresence(repo: DeckRepo, deckId: string | null, busy: boolean, editing: string | null) {
  const sent = useRef<{ id: string; active: boolean } | null>(null)
  useEffect(() => {
    const id = deckId
    if (!id || !repo.presence) return
    if (sent.current && sent.current.id !== id && sent.current.active) void repo.presence(sent.current.id, {})
    const active = busy || editing !== null
    if (!active && !(sent.current?.id === id && sent.current.active)) { sent.current = { id, active }; return }
    const send = () => void repo.presence?.(id, { ...(busy ? { busy: true } : {}), ...(editing ? { editing: editing } : {}) })
    sent.current = { id, active }
    send()
    if (!active) return
    const t = window.setInterval(send, 30_000)
    return () => window.clearInterval(t)
  }, [deckId, busy, editing, repo])
}
