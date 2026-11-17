import type { Pill } from '@/engine/agent/suggest'
import type { Style } from '@/engine/types'
import type { Attached } from '@/app/files'
import type { Message } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { Chat, type ChatAbout } from './Chat'
import { ChatModelTip } from './ChatModelTip'
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
  about?: ChatAbout
}

/** The agent, docked on the right of a deck or a doc. It shares that slot with the inspectors: one of them open takes
    its place, and closing it brings the agent back. On a phone it is a sheet over the page's foot. */
export function ChatPanel({ open, messages, offline, onUndo, busy, fresh, chips, canSend, composerBusy, hint, onSend, onClear, start, about = 'deck' }: ChatPanelProps) {
  return (
    <aside aria-label="Chat" data-tour="chat" className={cn(
      'flex w-side min-h-0 flex-none flex-col border-l border-line bg-app-bg animate-in fade-in-0 slide-in-from-right-3 duration-200 ease-out-strong',
      'max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[70dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:shadow-[0_-12px_48px_rgb(var(--app-shade)/var(--app-depth))]',
      !open && 'hidden',
    )}>
      <Chat messages={messages} offline={offline} onUndo={onUndo} busy={busy} fresh={fresh} about={about} />
      <ChatModelTip />
      <Composer chips={chips} canSend={canSend} busy={composerBusy} hint={hint ?? (about === 'doc' ? 'Ask for a change to this doc…' : undefined)} onSend={onSend} onClear={onClear} canClear={messages.length > 0} start={start} />
    </aside>
  )
}
