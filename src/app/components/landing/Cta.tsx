import { createContext, useContext } from 'react'
import { cn } from '@/app/lib/utils'

/** Whether the visitor is signed in: the offer under each CTA is for new visitors only. */
export const SignedIn = createContext(false)

/** Every call to action on the site leads to the one prompt at the top: scroll there and put the cursor in it. */
export function startPrompt() {
  const box = document.getElementById('hero-prompt-text')
  box?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  box?.focus({ preventScroll: true })
}

/** The site's call to action, repeated after each section that makes the case: the button, the offer under it.
    It says what the prompt's own button says, so the two read as one action. */
export function Cta({ night = false, className }: { night?: boolean; className?: string }) {
  const signedIn = useContext(SignedIn)
  return (
    <div className={cn('grid justify-items-center gap-2.5 text-center', className)}>
      <button type="button" onClick={startPrompt}
        className={cn('h-11 rounded-full px-5 text-[14px] font-medium transition-opacity hover:opacity-90', night ? 'bg-[#F3EEE4] text-stage' : 'bg-type text-paper')}>
        Make slides
      </button>
      {!signedIn && <span className={cn('text-[13px]', night ? 'text-[#A39B8E]' : 'text-type-3')}>First slide free.</span>}
    </div>
  )
}
