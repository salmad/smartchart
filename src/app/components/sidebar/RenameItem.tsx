import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

interface Props {
  /** Null while closed. */
  open: { title: string; name: string; action: string; about?: string } | null
  /** Throws the sentence to show when the name can't be saved. */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}

/** A name, typed: renaming a deck, a doc or a workspace, or naming a new workspace. */
export function RenameItem({ open, onSubmit, onClose }: Props) {
  const [name, setName] = useState(''), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false)
  // Reset when it opens on something else; `open` itself is a new object on every render.
  const opened = open && `${open.title}\n${open.name}`
  useEffect(() => { setName(open?.name ?? ''); setError(null); setSaving(false) }, [opened]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || saving) return
    setSaving(true)
    try { await onSubmit(n); onClose() } catch (err) { setError(err instanceof Error ? err.message : 'That didn’t work. Try again.'); setSaving(false) }
  }
  return (
    <Dialog open={open !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[400px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">{open?.title}</DialogTitle>
        <DialogDescription className={open?.about ? 'mt-2 text-[13.5px] leading-[1.5] text-ink-2' : 'sr-only'}>{open?.about ?? 'Type a name.'}</DialogDescription>
        <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-label="Name" className="h-9 border-line-2 bg-app-bg text-[13.5px] md:text-[13.5px]" />
          {error && <p role="alert" className="text-[12.5px] text-ink-2">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving}>{open?.action}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
