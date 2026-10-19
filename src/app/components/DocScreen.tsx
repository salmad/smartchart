import '@/engine/docs/doc.css'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
import { parseDoc } from '@/engine/docs/parse'
import { mountDoc } from '@/engine/docs/mount'
import type { Account } from '@/app/auth'
import type { DocRepo } from '@/app/docs'
import { AccountMenu } from './AccountMenu'
import { Toggle } from './Bar'

interface Props {
  id: string
  docs: DocRepo
  /** The workspace sidebar; null while hidden. */
  sidebar: ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSite: () => void
  account: Account
}

/** A doc in the workspace shell: the sidebar, a quiet bar, and the doc's read view (M2). Writing in it comes in M4. */
export function DocScreen({ id, docs, sidebar, sidebarOpen, onToggleSidebar, onSite, account }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ id: string; name: string } | 'missing' | 'failed' | null>(null)
  useEffect(() => {
    let live = true, mounted: { destroy(): void } | null = null
    setState(null)
    void docs.get(id).then(async (d) => {
      if (!live) return
      if (!d) { setState('missing'); return }
      setState({ id: d.id, name: d.name })
      // Figures measure text, as slides do: the fonts first.
      await document.fonts.ready
      if (live && page.current) mounted = mountDoc(page.current, parseDoc(d.text).doc, d.id)
    }, () => { if (live) setState('failed') })
    return () => { live = false; mounted?.destroy() }
  }, [id, docs])

  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
        <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
          <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        </div>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          <span aria-hidden className="text-ink-3">/</span>
          <span className="truncate text-ink-2">{typeof state === 'object' && state ? state.name : ''}</span>
        </nav>
        <AccountMenu account={account} />
      </header>
      <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto">
        {sidebar}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-app-bg">
          {state === 'missing' && <p className="px-8 py-10 text-[13.5px] text-ink-2">That doc isn’t in this workspace.</p>}
          {state === 'failed' && <p className="px-8 py-10 text-[13.5px] text-ink-2">Couldn’t open the doc. Reload to try again.</p>}
          <div ref={page} />
        </main>
      </div>
    </>
  )
}
