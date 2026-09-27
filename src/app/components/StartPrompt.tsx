import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Style } from '@/engine/types'
import { EXAMPLES } from '@/app/examples'
import { Button } from '@/app/components/ui/button'

interface Props {
  deckStyle: Style; onStyle: (s: Style) => void; onSend: (text: string) => void
  /** False while the models are down: examples still work, the prompt waits. */
  live: boolean
  /** A visitor after their free slide: sign in instead of a new prompt. */
  locked?: { text: string; action: string; onAction: () => void }
}

const STYLES: [Style, string, string][] = [
  ['consulting', 'Consulting', 'The argument in the title, the evidence below.'],
  ['pitch', 'Pitch', 'One bold claim, big numbers, little text.'],
]

/** The new deck's first question, as on the site: what should this slide say? */
export function StartPrompt({ deckStyle, onStyle, onSend, live, locked }: Props) {
  const [text, setText] = useState('')
  const send = () => { if (text.trim() && live && !locked) onSend(text.trim()) }
  const submit = (e: FormEvent) => { e.preventDefault(); send() }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid rounded-[16px] border border-line-2 bg-panel p-2 transition-colors focus-within:border-ink-3">
        <label htmlFor="start-text" className="sr-only">Describe your slide</label>
        <textarea id="start-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} rows={3} disabled={!!locked}
          placeholder="Paste your numbers and say what the slide should argue. Revenue grew from £2.1m in 2023 to £5.4m in 2025…"
          className="min-h-[88px] resize-none bg-transparent px-3 pt-2.5 text-[15px] leading-[1.5] text-ink outline-none placeholder:text-ink-3" />
        <div className="flex items-center justify-between gap-3 pl-1">
          <div role="group" aria-label="Writing style" className="flex gap-1">
            {STYLES.map(([v, label, line]) => (
              <button key={v} type="button" aria-pressed={deckStyle === v} title={line} onClick={() => onStyle(v)}
                className="h-8 rounded-full px-3 text-[13px] text-ink-3 transition-colors hover:text-ink-2 aria-pressed:bg-raise aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">
                {label}
              </button>
            ))}
          </div>
          {locked
            ? <Button type="button" onClick={locked.onAction} className="h-10 rounded-full px-5">{locked.action}</Button>
            : <Button type="submit" disabled={!live || !text.trim()} className="h-10 rounded-full px-5">Make a slide</Button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {EXAMPLES.map(([label, st, prompt]) => (
          <button key={label} type="button" onClick={() => { setText(prompt); onStyle(st) }}
            className="h-8 rounded-full border border-line px-3 text-[12.5px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink">
            {label}
          </button>
        ))}
        <span className="text-[12.5px] text-ink-3">
          {locked ? locked.text : !live ? 'The models are not reachable right now. You can still start from an example below.' : STYLES.find(([v]) => v === deckStyle)?.[2]}
        </span>
      </div>
    </form>
  )
}
