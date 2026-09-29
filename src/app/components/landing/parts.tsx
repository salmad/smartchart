import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/** The heading's one emphasis: grey in Paper, gold serif italic in Ink. */
export function Em({ children }: { children: ReactNode }) {
  return <em className="site-em">{children}</em>
}

/** A section's head: the heading and its lede, no label above it (the heading says what the section is). `center` for
    sections whose content runs full width. */
export function Head({ id, title, lede, center = false, className }: {
  id: string; title: ReactNode; lede?: ReactNode; center?: boolean; className?: string
}) {
  return (
    <div className={cn('site-head', center && 'site-head-c', className)}>
      <h2 id={id} className="site-h2">{title}</h2>
      {lede && <p className="site-lede">{lede}</p>}
    </div>
  )
}

export type Look = 'ink' | 'paper'
const KEY = 'occam.look'

/** The site's look: ?look= wins, then the visitor's last pick, then Ink. */
export function useLook(): [Look, (l: Look) => void] {
  const [look, setLook] = useState<Look>(() => {
    const q = new URLSearchParams(location.search).get('look')
    if (q === 'ink' || q === 'paper') return q
    try { return localStorage.getItem(KEY) === 'paper' ? 'paper' : 'ink' } catch { return 'ink' }
  })
  useEffect(() => { try { localStorage.setItem(KEY, look) } catch { /* private mode: the pick lasts this visit */ } }, [look])
  return [look, setLook]
}

/** Ink / Paper: the same page in the brand board's look or the light one. */
export function LookSwitch({ look, onChange, night }: { look: Look; onChange: (l: Look) => void; night: boolean }) {
  return (
    <div role="group" aria-label="Page look" className={cn('flex rounded-full p-0.5 max-[520px]:hidden', night ? 'bg-[#F3EEE4]/10' : 'bg-paper-2')}>
      {(['ink', 'paper'] as Look[]).map((l) => (
        <button key={l} type="button" aria-pressed={look === l} onClick={() => onChange(l)}
          className={cn('h-8 rounded-full px-3 text-[12px] font-medium capitalize transition-colors',
            night ? 'text-[#A39B8E] aria-pressed:bg-[#F3EEE4] aria-pressed:text-stage' : 'text-type-3 hover:text-type aria-pressed:bg-card aria-pressed:text-type aria-pressed:shadow-sm')}>
          {l}
        </button>
      ))}
    </div>
  )
}
