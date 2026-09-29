import { useLayoutEffect, useRef } from 'react'
import type { TraceStep } from '@/engine/agent/agent'
import type { Message } from '@/app/store'
import { WORKING } from '@/app/turn'
import { cn } from '@/app/lib/utils'
import { config } from '@/app/config'
import { phaseLinesOf } from '@/app/phase'
import { Glint, Thinking } from './Working'

const OFFLINE = 'The models are not reachable right now. You can still browse and pick slides.'

interface Props { messages: Message[]; legacyThread: string | null; offline: boolean }

/** The conversation: an old prototype chat (read-only) first, then the messages, newest at the bottom. */
export function Chat({ messages, legacyThread, offline }: Props) {
  const thread = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight }, [messages, legacyThread, offline])

  return (
    <div ref={thread} className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] py-5 max-[900px]:overflow-visible max-[900px]:px-4">
      {/* HTML the prototype itself produced and escaped when it saved this deck; shown as it was, never edited. */}
      {legacyThread && <div className="legacy" dangerouslySetInnerHTML={{ __html: legacyThread }} />}
      {/* A new deck: the question the first message answers. */}
      {!messages.length && !legacyThread && (
        <div className="grid gap-1.5">
          <h2 className="text-[17px] font-medium tracking-[-.01em] text-ink">What should this slide say?</h2>
          <p className="text-ink-2">Paste your numbers, notes or doc and say what the room should take away. Or start from a slide on the right.</p>
        </div>
      )}
      {messages.map((m, k) => <Bubble key={k} m={m} />)}
      {offline && <p className="text-[13px] text-ink-2">{OFFLINE}</p>}
    </div>
  )
}

function Bubble({ m }: { m: Message }) {
  if (m.kind === 'user') {
    return <div className="max-w-[88%] self-end whitespace-pre-wrap rounded-[12px_12px_4px_12px] border border-line bg-raise px-[13px] py-2.5">{m.text}</div>
  }
  // Traces (which model did what, and how long it took) are for debugging, not for the person writing a deck.
  const working = m.kind === 'bot' && !m.text && m.sub === WORKING, trace = config.debug ? m.trace ?? [] : []
  return (
    <div className="grid gap-2">
      {m.text.split(/\n{2,}/).filter((p) => p.trim()).map((p, k) => <p key={k} className={cn('whitespace-pre-line', m.kind === 'error' ? 'text-bad' : 'text-ink')}>{p.trim()}</p>)}
      {m.sub && !(working && trace.length) && (working || config.debug || m.trace === undefined) && <p className="flex items-center gap-2 text-[13px] text-ink-2">{working && <Glint />}{working ? <Thinking lines={phaseLinesOf(m.trace)} /> : m.sub}</p>}
      {trace.length > 0 && <Trace trace={trace} pending={working} />}
    </div>
  )
}

function Trace({ trace, pending }: { trace: TraceStep[]; pending: boolean }) {
  const row = 'grid grid-cols-[96px_1fr_auto] items-baseline gap-2 text-[12.5px] text-ink-2'
  const step = 'font-mono text-[11px] font-medium uppercase leading-[1.6] tracking-[.04em]'
  return (
    <ul className="grid gap-0.5 border-l border-line-2 pl-3">
      {trace.map((t, k) => (
        <li key={k} className={row}>
          <b className={cn(step, 'text-ink')}>{t.step}</b>
          <span className="[overflow-wrap:anywhere]">{t.detail} <i className="not-italic text-ink-3">· {t.model}</i></span>
          <em className="whitespace-nowrap font-mono text-[11px] not-italic leading-[1.6] text-ink-3">{t.ms ? `${(t.ms / 1000).toFixed(1)}s` : ''}</em>
        </li>
      ))}
      {pending && <li className={cn(row, 'text-ink-3')}><b className={step}>Working…</b></li>}
    </ul>
  )
}
