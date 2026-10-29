import { useState } from 'react'
import { Plug, X } from 'lucide-react'
import { chatModelTipDismissed, dismissChatModelTip } from '@/app/chat-model-tip'

/** One-time tip in the chat column: MCP with a strong model is best; in-app chat is for quick tests. */
export function ChatModelTip() {
  const [show, setShow] = useState(() => !chatModelTipDismissed())
  if (!show) return null
  const dismiss = () => { dismissChatModelTip(); setShow(false) }
  return (
    <div role="status" className="mx-[18px] mb-1 mt-2 flex gap-2.5 rounded-[10px] border border-line-2 bg-raise px-3 py-2.5 text-[12.5px] leading-snug text-ink-2 max-[900px]:mx-4">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-panel text-ink-3" aria-hidden>
        <Plug className="size-3.5" strokeWidth={1.75} />
      </div>
      <p className="min-w-0 flex-1 pt-0.5">For the best results, use a strong model over MCP. This chat is for quick tests.</p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
        <X className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}
