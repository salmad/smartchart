import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Pill } from '@/engine/agent/suggest'
import type { Style } from '@/engine/types'
import { EXAMPLES } from '@/app/examples'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

interface Props {
  chips: Pill[] | null; canSend: boolean; busy: boolean; onSend: (text: string) => void; onClear: () => void
  /** A new deck: the writing style to pick (it is set once the first slide is made) and example prompts to start from. */
  start?: { style: Style; onStyle: (s: Style) => void }
}

const STYLES: [Style, string, string][] = [
  ['consulting', 'Consulting', 'The argument in the title, the evidence below.'],
  ['pitch', 'Pitch', 'One bold claim, big numbers, little text.'],
]

/** Prompt box with suggestion pills; in a new deck, the style and example prompts instead. It refuses empty text and a
    send while a turn runs: sendTurn does not check. */
export function Composer({ chips, canSend, busy, onSend, onClear, start }: Props) {
  const [text, setText] = useState('')
  const send = (t: string) => { if (!t.trim() || !canSend) return; onSend(t.trim()); setText('') }
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }

  return (
    <form onSubmit={submit} className="grid gap-2.5 border-t border-line px-3.5 pb-3.5 pt-3">
      {start && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map(([label, st, prompt]) => (
            <button key={label} type="button" onClick={() => { setText(prompt); start.onStyle(st) }}
              className="cursor-pointer rounded-full border border-line-2 px-2.5 py-1 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">{label}</button>
          ))}
        </div>
      )}
      {!start && chips && chips.length > 0 && (
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
        placeholder={start ? 'Paste your numbers and say what the slide should argue…' : 'Describe a slide, or ask for a change…'}
        className="min-h-0 resize-none rounded-[10px] border-line-2 bg-app-bg px-3 py-2.5 text-sm leading-[1.45] shadow-none focus-visible:border-ink-3 focus-visible:ring-0 disabled:opacity-50" />
      <div className="flex items-center gap-2">
        {start
          ? <div role="group" aria-label="Writing style" className="mr-auto flex gap-1">
              {STYLES.map(([v, label, line]) => (
                <button key={v} type="button" aria-pressed={start.style === v} title={line} onClick={() => start.onStyle(v)}
                  className="h-7 cursor-pointer rounded-md px-2.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink-2 aria-pressed:bg-raise aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">{label}</button>
              ))}
            </div>
          : <Button type="button" variant="ghost" onClick={onClear} disabled={busy} className="mr-auto px-1 text-[12.5px] text-ink-3">Clear chat</Button>}
        <Button type="submit" disabled={!canSend || !text.trim()}>{start ? 'Make a slide' : 'Send'}</Button>
      </div>
    </form>
  )
}
