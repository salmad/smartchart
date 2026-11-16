import { PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'
import { PICTURE, Proof, StartScreen, Working } from '../StartScreen'

/* A doc, drawn small, writing itself: the title, the summary line by line, the decision in its gold rule, then a figure
   whose bars rise. Written out whole (Tailwind reads classes from the source). */
const LINES = ['w-full [animation-delay:200ms]', 'w-[92%] [animation-delay:280ms]', 'w-[64%] [animation-delay:360ms]'] as const
const BARS = ['h-[40%] bg-ink/20 [animation-delay:700ms]', 'h-[58%] bg-ink/20 [animation-delay:780ms]', 'h-[72%] bg-gold/80 [animation-delay:860ms]', 'h-[96%] bg-gold [animation-delay:940ms]'] as const

function MiniDoc({ working }: { working: boolean }) {
  return (
    <div aria-hidden className="grid w-full justify-items-center gap-3">
      <div className={cn(PICTURE, 'grid w-full max-w-[320px] gap-3 p-6 text-left', working && 'opacity-60')}>
        <span className="grid gap-1.5">
          <span className="h-3 w-44 rounded-sm bg-ink/80" />
          <span className="h-1.5 w-32 rounded-full bg-ink/30" />
        </span>
        <span className="grid gap-1.5">
          {LINES.map((l) => <span key={l} className={cn('h-1.5 origin-left rounded-full bg-ink/20 motion-safe:animate-stretch', l)} />)}
        </span>
        <span className="grid gap-1.5 border-l-2 border-gold pl-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:delay-500 motion-safe:fill-mode-both">
          <span className="h-1 w-12 rounded-full bg-gold/80" />
          <span className="h-1.5 w-40 rounded-full bg-ink/50" />
        </span>
        <span className="flex h-16 items-end gap-2.5 border-b border-line-2 px-1">
          {BARS.map((b) => <span key={b} className={cn('flex-1 origin-bottom rounded-t-[2px] motion-safe:animate-grow', b)} />)}
        </span>
      </div>
      <Proof hidden={working}>Every chart and table is checked like a slide</Proof>
    </div>
  )
}

interface Props {
  /** The prompt box, while nothing has been asked yet; absent for a viewer and once the agent has the conversation. */
  composer?: ReactNode
  /** The agent is drafting: what it is doing, one line at a time. */
  working?: string[] | null
  /** Opens the editor on the blank page; absent for a viewer. */
  onWrite?: () => void
}

/** A doc with nothing in it: a page writing itself, the promise, the prompt box, and writing it yourself as the quiet
    second way in. A viewer gets the picture and a sentence. */
export function EmptyDoc({ composer, working, onWrite }: Props) {
  if (!onWrite) return <StartScreen visual={<MiniDoc working={false} />} title="Nothing written yet" body="When someone writes this doc, it appears here." />
  return (
    <StartScreen wide visual={<MiniDoc working={!!working} />} title={working ? 'Drafting your doc' : 'Write the doc that gets the decision.'}
      body={working ? <Working lines={working} /> : 'Say what it’s for and paste your notes, numbers or links. Occam drafts the sections, the charts and the tables, and checks every figure.'}>
      {composer && <div className="w-full text-left">{composer}</div>}
      {!working && (
        <Button variant="quiet" onClick={onWrite} className="-mt-3 gap-2 text-[13px] text-ink-3 hover:text-ink">
          <PenLine strokeWidth={1.75} />Or write it yourself
        </Button>
      )}
    </StartScreen>
  )
}
