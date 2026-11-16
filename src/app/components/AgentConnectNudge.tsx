import { useState } from 'react'
import { Plug, X } from 'lucide-react'
import { Button } from './ui/button'
import { AgentKey } from './AgentKey'

/** On a deck with slides, in a visit after the tour's offer: one quiet path to Connect an agent, never again once
    connected, dismissed or shown in the tour. */
export function AgentConnectNudge({ onDismiss, onConnected }: { onDismiss: () => void; onConnected: () => void }) {
  const [keys, setKeys] = useState(false)
  return (
    <>
      <div role="status" className="fixed bottom-6 right-6 z-50 max-w-[min(100vw-2rem,22rem)] rounded-[14px] border border-line-2 bg-raise p-4 text-[13px] text-ink-2 shadow-menu motion-safe:animate-reveal">
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel text-ink">
            <Plug className="size-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">Connect an agent</p>
            <p className="mt-1 leading-snug text-ink-3">Let Claude or Cursor build and edit your decks here, by the same rules you see in the app.</p>
            <Button size="sm" className="mt-3" onClick={() => setKeys(true)}>Make a key</Button>
          </div>
          <Button type="button" variant="quiet" size="icon-sm" onClick={onDismiss} aria-label="Dismiss" title="Dismiss" className="-mr-1 -mt-1 shrink-0">
            <X strokeWidth={1.75} />
          </Button>
        </div>
      </div>
      <AgentKey open={keys} onOpenChange={(o) => { setKeys(o); if (!o) onConnected() }} />
    </>
  )
}
