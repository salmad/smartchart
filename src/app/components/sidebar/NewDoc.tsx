import { useEffect, useState } from 'react'
import { DOC_STARTERS, type DocStarter } from '@/engine/starters'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'

interface Props {
  open: boolean
  /** Throws the sentence to show when the doc can't be made. */
  onCreate: (starter: DocStarter | null) => Promise<void>
  onClose: () => void
}

const BLANK = 'blank'

/** A new doc is blank, or starts from one of the doc starters (the one gallery): pick one, then make it. */
export function NewDoc({ open, onCreate, onClose }: Props) {
  const [picked, setPicked] = useState<string>(BLANK), [error, setError] = useState<string | null>(null), [making, setMaking] = useState(false)
  useEffect(() => { if (open) { setPicked(BLANK); setError(null); setMaking(false) } }, [open])
  const starter = DOC_STARTERS.find((s) => s.id === picked) ?? null
  const create = async () => {
    if (making) return
    setMaking(true)
    try { await onCreate(starter); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work. Try again.'); setMaking(false) }
  }
  const options = [{ id: BLANK, label: 'Blank doc', blurb: 'Just a title. Add sections as you go.' }, ...DOC_STARTERS]
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[440px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">New doc</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Start blank, or from an example, then make it yours.</DialogDescription>
        <div role="radiogroup" aria-label="Start from" className="mt-5 grid gap-1.5">
          {options.map((s) => (
            <label key={s.id} className={cn('grid cursor-pointer gap-0.5 rounded-lg border px-3 py-2.5 transition-colors',
              picked === s.id ? 'border-line-2 bg-panel' : 'border-line hover:bg-panel')}>
              <input type="radio" name="doc-starter" value={s.id} checked={picked === s.id} onChange={() => setPicked(s.id)} className="sr-only" aria-label={`${s.label}: ${s.blurb}`} />
              <span className="text-[13.5px] text-ink">{s.label}</span>
              <span className="text-[12px] leading-[1.45] text-ink-3">{s.blurb}</span>
            </label>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-[12.5px] text-ink-2">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void create()} disabled={making}>Create doc</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
