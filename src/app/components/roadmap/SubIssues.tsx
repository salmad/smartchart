import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import type { Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { issueTree } from '@/engine/roadmaps/tree'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { Avatar } from './Avatar'
import { ProgressBar } from './ProgressBar'
import { StatusPick } from './PropertyPick'
import { shortDate, todayIso } from './dates'
import { newIssueId } from './issueIds'
import { IssueKey, IssueSection } from './issueParts'

interface Props {
  parent: Issue
  roadmap: Roadmap
  issues: Issue[]
  members: MemberLite[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpen: (id: string) => void
}

const open = (i: Issue) => i.status !== 'done' && i.status !== 'cancelled'

/** The issue's children as a tidy list: status in one click, the title opens the child, and a row at the end adds one. */
export function SubIssues({ parent, roadmap, issues, members, canEdit, act, onOpen }: Props) {
  const kids = issueTree(issues).children(parent.id)
  const [title, setTitle] = useState('')
  const [composing, setComposing] = useState(false)
  const today = todayIso()
  const counted = kids.filter((k) => k.status !== 'cancelled')
  const done = counted.filter((k) => k.status === 'done').length

  const say = (out: 'ok' | string) => { if (out !== 'ok') toast(out) }

  const add = () => {
    const t = title.trim()
    if (!t) { setComposing(false); return }
    say(act({ op: 'create', issues: [{ id: newIssueId(), parentId: parent.id, title: t, after: kids[kids.length - 1]?.id }] }))
    setTitle('')
  }

  /** Drag by the grip: the row lands where the pointer is let go. */
  const drag = (e: ReactPointerEvent<HTMLButtonElement>, from: number) => {
    e.preventDefault()
    const grip = e.currentTarget
    grip.setPointerCapture(e.pointerId)
    const rows = [...grip.closest('ul')?.querySelectorAll<HTMLElement>('[data-sub-issue-row]') ?? []]
    let to = from
    const move = (ev: PointerEvent) => {
      const at = rows.findIndex((el) => { const b = el.getBoundingClientRect(); return ev.clientY >= b.top && ev.clientY <= b.bottom })
      if (at >= 0) to = at
    }
    const up = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', up)
      if (to === from) return
      const target = kids[to].id
      say(act({ op: 'move', id: kids[from].id, parentId: parent.id, ...(to < from ? { before: target } : { after: target }) }))
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up)
  }

  if (!kids.length && !canEdit) return null

  return (
    <IssueSection
      label="Sub-issues"
      aside={counted.length > 0 && (
        <p className="flex items-center gap-2 text-[12px] tabular-nums text-ink-3">
          {done} of {counted.length} done
          <ProgressBar value={done / counted.length} />
        </p>
      )}
    >
      <ul>
        {kids.map((kid, idx) => {
          const who = members.find((m) => m.id === kid.assignee)?.name
          return (
            <li key={kid.id} data-sub-issue-row={kid.id} className="group/row relative -mx-2 flex h-9 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-raise/60 focus-within:bg-raise/60">
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Move ${kid.title}`}
                  className="absolute -left-3 grid h-7 w-4 cursor-grab touch-none place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing group-hover/row:opacity-100"
                  onPointerDown={(e) => drag(e, idx)}
                >
                  <GripVertical className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
              <StatusPick status={kid.status} disabled={!canEdit} onPick={(status) => say(act({ op: 'set', ids: [kid.id], props: { status } }))} />
              <button
                type="button"
                title={kid.title}
                className={cn('min-w-0 flex-1 truncate text-left text-[13px] text-ink focus-visible:underline focus-visible:outline-none', !open(kid) && 'text-ink-2')}
                onClick={() => onOpen(kid.id)}
              >
                {kid.title}
              </button>
              <IssueKey roadmap={roadmap} issue={kid} />
              {kid.due && (
                <span className={cn('flex-none whitespace-nowrap text-[12px] tabular-nums', kid.due < today && open(kid) ? 'text-bad' : 'text-ink-3')}>{shortDate(kid.due, today)}</span>
              )}
              {who && <span title={who} className="flex flex-none"><Avatar name={who} /></span>}
            </li>
          )
        })}
      </ul>
      {canEdit && (
        composing ? (
          <label className="-mx-2 flex h-9 items-center gap-1.5 rounded-md bg-raise/60 px-2">
            <span className="grid w-7 flex-none place-items-center text-ink-3"><Plus className="size-3.5" strokeWidth={1.75} aria-hidden /></span>
            <input
              autoFocus
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:ring-0"
              aria-label="New sub-issue title"
              placeholder="Sub-issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); add() }
                if (e.key === 'Escape') { e.stopPropagation(); setComposing(false); setTitle('') }
              }}
              onBlur={() => { add(); setComposing(false) }}
            />
            <kbd className="flex-none font-sans text-[11px] text-ink-3">↵ to add</kbd>
          </label>
        ) : (
          <button
            type="button"
            className="-mx-2 flex h-9 w-[calc(100%+16px)] items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-ink-3 transition-colors hover:bg-raise/60 hover:text-ink-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setComposing(true)}
          >
            <span className="grid w-7 flex-none place-items-center"><Plus className="size-3.5" strokeWidth={1.75} aria-hidden /></span>
            Add sub-issue
          </button>
        )
      )}
    </IssueSection>
  )
}
