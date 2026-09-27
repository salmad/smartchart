import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Pill } from '@/engine/agent/suggest'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

interface Props {
  chips: Pill[] | null; canSend: boolean; busy: boolean; onSend: (text: string) => void; onClear: () => void
  locked?: { text: string; action: string; onAction: () => void }
}

/** Prompt box with suggestion pills. It refuses empty text and a send while a turn runs: sendTurn does not check. */
export function Composer({ chips, canSend, busy, onSend, onClear, locked }: Props) {
  const [text, setText] = useState('')
  const send = (t: string) => { if (!t.trim() || !canSend) return; onSend(t.trim()); setText('') }
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }

  if (locked) {
    return (
      <div className="grid gap-3 border-t border-line px-3.5 pb-3.5 pt-4">
        <p className="text-[13.5px] text-ink-2">{locked.text}</p>
        <Button onClick={locked.onAction} className="h-10">{locked.action}</Button>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="grid gap-2.5 border-t border-line px-3.5 pb-3.5 pt-3">
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((p, k) => (
            <Tooltip key={k}>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => send(p.prompt)}
                  className="cursor-pointer rounded-full border border-line-2 px-2.5 py-1 text-left text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">{p.label}</button>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">{p.prompt}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} disabled={!canSend}
        placeholder="Describe a slide, or ask for a change…"
        className="min-h-0 resize-none rounded-[10px] border-line-2 bg-app-bg px-3 py-2.5 text-sm leading-[1.45] shadow-none focus-visible:border-ink-3 focus-visible:ring-0 disabled:opacity-50" />
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onClear} disabled={busy} className="mr-auto px-1 text-[12.5px] text-ink-3">Clear chat</Button>
        <Button type="submit" disabled={!canSend}>Send</Button>
      </div>
    </form>
  )
}
