import { PenLine, Sparkles } from 'lucide-react'
import { Thinking } from '../Working'
import { pageButton, pageButtonQuiet } from './chrome'

interface Props {
  /** Opens the editor on the page; absent for a viewer. */
  onWrite?: () => void
  /** Opens the agent's panel to draft it; absent for a viewer, or with the models down. */
  onDraft?: () => void
  /** The agent is drafting: what it is doing, one line at a time. */
  working?: string[] | null
}

/** Where the first paragraph of a doc with nothing under its title will go: how to start, writing it yourself first and
    the agent second. It sits in the doc's own body, in the page's colours, so the title above it stays the page's. */
export function EmptyDoc({ onWrite, onDraft, working }: Props) {
  if (working) return <p className="m-0 text-[var(--fg-2)]"><Thinking lines={working.length ? working : ['Reading what you sent…']} /></p>
  if (!onWrite) return <p className="m-0 text-[var(--fg-2)]">Nothing written yet.</p>
  return (
    <div className="grid justify-items-start gap-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-500 ease-out-strong">
      <p className="m-0 text-[var(--fg-2)]">Lead with the conclusion, then the evidence. Every chart and table is checked like a slide.</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onWrite} className={pageButton}><PenLine strokeWidth={2} />Start writing</button>
        {onDraft && <button type="button" onClick={onDraft} className={pageButtonQuiet}><Sparkles strokeWidth={1.75} />Draft it with Occam AI</button>}
      </div>
    </div>
  )
}
