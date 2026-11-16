import { useEffect, useState } from 'react'
import { PREFIX } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

interface Props {
  open: boolean
  onCreate: (name: string, prefix: string) => Promise<void>
  onClose: () => void
}

/** Suggested from the name's initials, uppercased, 2–6 characters. */
export function suggestPrefix(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const raw = parts.map((w) => w.replace(/[^a-zA-Z0-9]/g, '').charAt(0)).join('').toUpperCase()
  if (!raw) return ''
  return raw.slice(0, 6)
}

/** A new roadmap: a name and an issue-key prefix, suggested from the name and checked against `PREFIX`. */
export function NewRoadmap({ open, onCreate, onClose }: Props) {
  const [name, setName] = useState(''), [prefix, setPrefix] = useState(''), [error, setError] = useState<string | null>(null), [making, setMaking] = useState(false)
  useEffect(() => {
    if (open) { setName(''); setPrefix(''); setError(null); setMaking(false) }
  }, [open])
  useEffect(() => {
    if (!open) return
    setPrefix(suggestPrefix(name))
  }, [name, open])
  const create = async () => {
    if (making) return
    const n = name.trim(), p = prefix.trim()
    if (!n) { setError('Name is required.'); return }
    if (!PREFIX.test(p)) { setError('Prefix must be 2–6 uppercase letters or digits, starting with a letter.'); return }
    setMaking(true)
    try { await onCreate(n, p); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work. Try again.'); setMaking(false) }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle>New roadmap</DialogTitle>
        <DialogDescription>Name it and choose a short prefix for its issue keys. The prefix can’t change later.</DialogDescription>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="roadmap-name" className="text-[13px] text-ink-2">Name</label>
            <Input id="roadmap-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="SME credit launch" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="roadmap-prefix" className="text-[13px] text-ink-2">Prefix</label>
            <div className="flex items-center gap-3">
              <Input id="roadmap-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="SCL" maxLength={6} className="w-24 tabular-nums"
                onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
              {PREFIX.test(prefix.trim()) && <p className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-3">Issues will be {prefix.trim()}-1, {prefix.trim()}-2…</p>}
            </div>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-[12.5px] text-ink-2">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void create()} disabled={making}>Create roadmap</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
