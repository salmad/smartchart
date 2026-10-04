/* "From your website", in the accent panel: a domain in, the colours its site offers as its brand out (/api/brand: the
   colour it declares, its logo's, the ones its pages use most). The maker picks one; nothing is applied unasked. */
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'

type Found = { state: 'idle' } | { state: 'busy' } | { state: 'done'; colours: { hex: string; from: string }[] } | { state: 'failed'; why: string }
const paint = (el: HTMLElement | null, hex: string) => el?.style.setProperty('--sw', hex)

export function BrandColours({ chosen, drawn, refuses, onPick }: { chosen: string; drawn: (hex: string) => string; refuses: (hex: string) => string | undefined; onPick: (hex: string) => void }) {
  const [found, setFound] = useState<Found>({ state: 'idle' }), site = useRef<HTMLInputElement>(null), dots = useRef<(HTMLButtonElement | null)[]>([])
  useLayoutEffect(() => { if (found.state === 'done') found.colours.forEach((c, i) => paint(dots.current[i], drawn(c.hex))) }, [found, drawn])
  const find = async (e: FormEvent) => {
    e.preventDefault()
    const domain = site.current?.value.trim()
    if (!domain) return
    setFound({ state: 'busy' })
    try {
      const r = await fetch('/api/brand', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ domain }) })
      const j = (await r.json().catch(() => null)) as { colours?: { hex: string; from: string }[]; error?: string } | null
      if (!r.ok || !j?.colours) throw new Error(j?.error ?? (r.status === 401 ? 'Sign in to take a colour from a website.' : 'That didn’t work. Try again.'))
      setFound({ state: 'done', colours: j.colours })
    } catch (err) { setFound({ state: 'failed', why: err instanceof Error ? err.message : String(err) }) }
  }
  return (
    <div className="grid gap-2">
      <form onSubmit={(e) => void find(e)} className="flex h-[34px] items-center gap-2.5 rounded-[9px] border border-line bg-panel px-2.5 transition-colors focus-within:border-line-2">
        {found.state === 'busy' ? <Loader2 className="size-3.5 flex-none animate-spin text-ink-3" /> : <Globe className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} />}
        <input ref={site} spellCheck={false} aria-label="Your website" placeholder="Your website, e.g. acme.com" disabled={found.state === 'busy'}
          className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] leading-none text-ink outline-none placeholder:text-ink-3" />
      </form>
      {found.state === 'failed' && <p className="text-xs leading-[1.45] text-ink-3">{found.why}</p>}
      {found.state === 'done' && (
        <ul aria-label="Colours from the website" className="grid gap-1">
          {found.colours.map((c, i) => {
            const no = refuses(c.hex)
            return (
              <li key={c.hex}>
                <button type="button" ref={(el) => { dots.current[i] = el }} aria-pressed={c.hex === chosen} disabled={!!no} title={no} onClick={() => onPick(c.hex)}
                  className={cn('-mx-1.5 flex w-[calc(100%+.75rem)] items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-xs text-ink-2 transition-colors enabled:hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60', c.hex === chosen && 'text-ink')}>
                  <i className="size-3.5 flex-none rounded-full bg-[var(--sw)] shadow-[0_0_0_1px_rgba(255,255,255,.14)]" />
                  <span className="font-mono text-[11.5px] uppercase tracking-[.04em]">{c.hex}</span>
                  <span className="truncate text-ink-3">{no ? no.replace(/^This colour is /, '').replace(/[;:].*$/, '') : c.from}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
