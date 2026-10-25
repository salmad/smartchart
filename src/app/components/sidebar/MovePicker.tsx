import { useEffect, useMemo, useState } from 'react'
import { FileText, Presentation } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { PageRef, PageSummary } from '@/engine/pages/tree'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { moveTargets } from './moveTargets'

interface Props {
  /** The page to move (null: closed), the workspace's pages, and its name for the title. */
  page: { ref: PageRef; name: string } | null
  pages: PageSummary[]
  /** Resolves with the sentence when the move is refused. */
  onMove: (parent: PageRef | null, workspaceId?: string) => Promise<string | null>
  /** Workspaces the user may move into (editor or owner), except the current one. */
  workspaces?: { id: string; name: string }[]
  currentWorkspaceId?: string
  onClose: () => void
}

const TOP = 'top'
/** 14 px a level, written out so Tailwind sees every class (pages nest 6 deep). */
const PAD = ['pl-2.5', 'pl-6', 'pl-[38px]', 'pl-[52px]', 'pl-[66px]', 'pl-[80px]']

/** Move to…: the workspace's pages as an indented list, "Top level" first. The page and what is inside it are greyed (a page
    can't go inside itself), and so is anything that would nest too deep, each with its reason. Enter moves; the page goes last. */
export function MovePicker({ page, pages, onMove, onClose, workspaces = [], currentWorkspaceId }: Props) {
  const [query, setQuery] = useState(''), [picked, setPicked] = useState<string>(TOP), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  useEffect(() => { if (page) { setQuery(''); setPicked(TOP); setError(null); setBusy(false) } }, [page])
  const targets = useMemo(() => (page ? moveTargets(pages, page.ref) : []), [page, pages])
  const q = query.trim().toLowerCase()
  const shown = q ? targets.filter((t) => t.name.toLowerCase().includes(q)) : targets
  const wsPick = picked.startsWith('ws:') ? picked.slice(3) : null
  const wsTarget = wsPick ? workspaces.find((w) => w.id === wsPick) : null
  const choice = picked === TOP ? null : wsPick ? null : targets.find((t) => `${t.ref.kind}:${t.ref.id}` === picked)
  const go = async () => {
    if (busy || (choice && choice.reason)) return
    if (wsTarget && !window.confirm(`Move “${page?.name}” into “${wsTarget.name}”? It and its subpages leave this workspace. People here who are not in that workspace will lose access.`)) return
    setBusy(true)
    const why = await onMove(wsPick ? null : choice ? choice.ref : null, wsPick ?? undefined)
    if (why) { setError(why); setBusy(false) } else onClose()
  }
  const option = 'flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-line-2 aria-disabled:cursor-not-allowed'
  return (
    <Dialog open={page !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[440px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Move “{page?.name}”</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Pick the page it goes inside. It goes last there.</DialogDescription>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages" aria-label="Search pages" className="mt-4"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void go() } }} />
        <div role="listbox" aria-label="Move to" className="mt-3 grid max-h-[280px] content-start gap-px overflow-y-auto">
          {!q && (
            <button type="button" role="option" aria-selected={picked === TOP} onClick={() => setPicked(TOP)} onDoubleClick={() => void go()}
              className={cn(option, PAD[0], picked === TOP ? 'bg-panel text-ink' : 'text-ink-2 hover:bg-panel')}>Top level</button>
          )}
          {shown.map((t) => {
            const k = `${t.ref.kind}:${t.ref.id}`, Glyph = t.ref.kind === 'doc' ? FileText : Presentation
            return (
              <button key={k} type="button" role="option" aria-selected={picked === k} aria-disabled={t.reason ? true : undefined} title={t.reason ?? undefined}
                onClick={() => { if (!t.reason) setPicked(k) }} onDoubleClick={() => { if (!t.reason) void go() }}
                className={cn(option, q ? PAD[0] : PAD[Math.min(t.depth, PAD.length) - 1], picked === k ? 'bg-panel text-ink' : 'text-ink-2 hover:bg-panel', t.reason && 'opacity-45 hover:bg-transparent')}>
                <Glyph className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.reason && <span className="flex-none text-[11.5px] text-ink-3">{t.reason}</span>}
              </button>
            )
          })}
          {q && !shown.length && <p className="px-2.5 py-2 text-[12.5px] text-ink-3">No pages match.</p>}
          {wsTarget && (
            <p className="mt-3 rounded-lg bg-panel px-3 py-2.5 text-[12.5px] leading-[1.45] text-ink-2">
              This page and everything inside it will move to <span className="text-ink">{wsTarget.name}</span>. Members of this workspace who are not in that workspace will no longer see it.
            </p>
          )}
          {!q && workspaces.filter((w) => w.id !== currentWorkspaceId).map((w) => {
            const k = `ws:${w.id}`
            return (
              <button key={k} type="button" role="option" aria-selected={picked === k} onClick={() => setPicked(k)} onDoubleClick={() => void go()}
                className={cn(option, PAD[0], picked === k ? 'bg-panel text-ink' : 'text-ink-2 hover:bg-panel', 'mt-2 border-t border-line-2 pt-2')}>
                <span className="min-w-0 flex-1 truncate">Workspace: {w.name}</span>
              </button>
            )
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-[12.5px] text-ink-2">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void go()} disabled={busy || !!choice?.reason}>Move</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
