/* A doc open in the app, kept up to date: its revision and who else is editing, read every 15 s, and this tab's own
   presence while it edits (renewed every 30 s, cleared when it stops). `tick` counts the reads, for what else follows them. */
import { useEffect, useState } from 'react'
import type { DocMeta, DocRepo } from '@/app/docs'

const POLL = 15_000, RENEW = 30_000

export interface DocLive {
  meta: DocMeta | null
  /** Others editing now (not you), by name. */
  others: string[]
  /** The doc has moved on since this tab read or wrote it. */
  newer: boolean
  tick: number
}

export function useDocLive(docs: DocRepo, id: string, editing: boolean, me: string): DocLive {
  const [meta, setMeta] = useState<DocMeta | null>(null), [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setMeta(null)
    const read = () => void docs.meta(id).then((m) => { if (live) { setMeta(m); setTick((t) => t + 1) } })
    read()
    const t = window.setInterval(read, POLL)
    return () => { live = false; window.clearInterval(t) }
  }, [docs, id])
  useEffect(() => {
    if (!editing) return
    void docs.presence(id, true)
    const t = window.setInterval(() => void docs.presence(id, true), RENEW)
    return () => { window.clearInterval(t); void docs.presence(id, false) }
  }, [docs, id, editing])

  const e = meta?.presence.editing, mine = me.trim().toLowerCase()
  const others = e && e.until > Date.now() && e.by.trim().toLowerCase() !== mine ? [e.by] : []
  return { meta, others, newer: !!meta && meta.rev > docs.known(id), tick }
}
