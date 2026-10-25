import { useState } from 'react'
import { Plug, X } from 'lucide-react'
import { Button } from './ui/button'
import { AgentKey } from './AgentKey'

/** After the first slide: one quiet path to Connect an agent, never again once connected or dismissed. */
export function AgentConnectNudge({ onDismiss, onConnected }: { onDismiss: () => void; onConnected: () => void }) {
  const [keys, setKeys] = useState(false)
  return (
    <>
      <div role="status" className="fixed bottom-6 right-6 z-50 max-w-[min(100vw-2rem,22rem)] rounded-xl bg-raise p-4 text-[13px] text-ink-2 shadow-[0_0_0_1px_theme(colors.line-2),0_12px_32px_rgba(0,0,0,.5)] motion-safe:animate-reveal">
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel text-ink">
            <Plug className="size-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">Connect an agent</p>
            <p className="mt-1 leading-snug text-ink-3">Let Claude or Cursor build and edit your decks here, by the same rules you see in the app.</p>
            <Button size="sm" className="mt-3" onClick={() => setKeys(true)}>Make a key</Button>
          </div>
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <AgentKey open={keys} onOpenChange={(o) => { setKeys(o); if (!o) onConnected() }} />
    </>
  )
}
