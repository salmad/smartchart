import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Thinking } from './Working'

interface Props {
  /** What the page will be, drawn small and making itself. */
  visual: ReactNode
  /** The promise, one line. */
  title: string
  /** Why it is worth starting, and how: one or two sentences. While the agent works, what it is doing. */
  body: ReactNode
  /** The next step (a prompt box, a button) and any quiet second way in. */
  children?: ReactNode
  /** Room for a prompt box rather than a button. */
  wide?: boolean
}

/** The first screen of an empty page (a deck, a doc, a roadmap): the picture, the promise, the next step, centred and
    arriving together. One layout, so every empty page in the app greets you the same way. */
export function StartScreen({ visual, title, body, children, wide = false }: Props) {
  return (
    <div className="grid min-h-full flex-1 grid-cols-[minmax(0,1fr)] place-items-center overflow-y-auto px-8 py-10 max-[900px]:order-1 max-[900px]:px-4">
      <div className={cn('grid w-full justify-items-center gap-8 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out-strong', wide ? 'max-w-[600px]' : 'max-w-[440px]')}>
        {visual}
        <div className="grid justify-items-center gap-2.5">
          <h2 className="app-title text-[30px]">{title}</h2>
          <div className="max-w-[480px] text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">{body}</div>
        </div>
        {children}
      </div>
    </div>
  )
}

/** While the agent writes the first draft: its steps, one line at a time. */
export function Working({ lines }: { lines: string[] }) {
  return lines.length ? <Thinking lines={lines} /> : <>Reading what you sent…</>
}

/** The proof under a start screen's picture: the checks every page passes. Hidden (keeping its room) while working. */
export function Proof({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  return (
    <span className={cn('flex items-center gap-1.5 text-[12px] text-ink-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:delay-1000 motion-safe:fill-mode-both', hidden && 'invisible')}>
      <Check className="size-3.5 text-ok" strokeWidth={2} />{children}
    </span>
  )
}

/** The frame a start screen's picture is drawn in: a small page on the panel surface. */
export const PICTURE = 'rounded-[12px] border border-line bg-panel shadow-menu transition-opacity duration-500'
