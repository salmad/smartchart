import type { Pill } from '@/engine/agent/suggest'
import type { Style } from '@/engine/types'
import type { Attached } from '@/app/files'
import type { Message } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { Chat } from './Chat'
import { Composer } from './Composer'

export interface ChatPanelProps {
  open: boolean
  messages: Message[]
  offline: boolean
  onUndo: ((turn: string) => void) | null
  busy: boolean
  fresh: boolean
  chips: Pill[] | null
  canSend: boolean
  composerBusy: boolean
  hint?: string
  onSend: (text: string, files?: Attached[]) => void
  onClear: () => void
  start?: { style: Style; onStyle: (s: Style) => void }
}

/** The deck chat column shared by the editor and the doc shell. */
export function ChatPanel({ open, messages, offline, onUndo, busy, fresh, chips, canSend, composerBusy, hint, onSend, onClear, start }: ChatPanelProps) {
  return (
    <aside aria-label="Chat" data-tour="chat" className={cn('flex w-[368px] min-h-0 flex-none flex-col border-r border-line bg-panel max-[900px]:order-3 max-[900px]:w-auto max-[900px]:border-r-0 max-[900px]:border-t max-[900px]:bg-transparent', !open && 'min-[901px]:hidden')}>
      <Chat messages={messages} offline={offline} onUndo={onUndo} busy={busy} fresh={fresh} />
      <Composer chips={chips} canSend={canSend} busy={composerBusy} hint={hint} onSend={onSend} onClear={onClear} canClear={messages.length > 0} start={start} />
    </aside>
  )
}
