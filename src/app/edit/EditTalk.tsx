/* Speaker notes in edit mode: what the maker says over the slide (`talk`, never drawn on it), typed by hand under the
   slide. Written to the draft when the field is left, like any other edit; closed until asked for when there are none. */
import { useEffect, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Textarea } from '@/app/components/ui/textarea'
import type { SlideEdit } from './useSlideEdit'

export function EditTalk({ edit }: { edit: SlideEdit }) {
  const saved = edit.draft.talk ?? '', [text, setText] = useState(saved), [open, setOpen] = useState(!!saved)
  useEffect(() => { setText(saved) }, [saved])
  const commit = () => { const t = text.trim(); if (t !== saved) edit.patch({ talk: t || null }) }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink">
        <MessageSquareText className="size-3.5" strokeWidth={1.75} />Add speaker notes
      </button>
    )
  }
  return (
    <label className="mb-3 grid gap-1.5">
      <span className="text-[12px] font-medium uppercase tracking-[.12em] text-ink-3">Speaker notes · not on the slide</span>
      <Textarea value={text} rows={3} maxLength={700} onChange={(e) => setText(e.target.value)} onBlur={commit}
        placeholder="What you say over this slide. It shows in the presenter view (P while presenting)."
        className="min-h-0 resize-y rounded-[10px] border-line-2 bg-app-bg px-3 py-2 text-[13.5px] leading-[1.5] shadow-none focus-visible:border-ink-3 focus-visible:ring-0" />
    </label>
  )
}
