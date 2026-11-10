import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import type { Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { keyOf } from '@/engine/roadmaps/fields'
import { issueTree } from '@/engine/roadmaps/tree'
import { StatusGlyph } from './StatusGlyph'
import { newIssueId } from './issueIds'

interface Props {
  parent: Issue
  roadmap: Roadmap
  issues: Issue[]
  members: MemberLite[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpen: (id: string) => void
}

export function SubIssues({ parent, roadmap, issues, canEdit, act, onOpen }: Props) {
  const tree = issueTree(issues)
  const kids = tree.children(parent.id)
  const [title, setTitle] = useState('')
  const [composing, setComposing] = useState(false)

  const add = () => {
    const t = title.trim()
    if (!t) { setComposing(false); return }
    const id = newIssueId()
    const last = kids[kids.length - 1]
    act({ op: 'create', issues: [{ id, parentId: parent.id, title: t, after: last?.id }] })
    setTitle('')
    setComposing(false)
  }

  const moveKid = (from: number, to: number) => {
    if (to < 0 || to >= kids.length || from === to) return
    const id = kids[from].id
    const target = kids[to]
    const out = to < from
      ? act({ op: 'move', id, parentId: parent.id, before: target.id })
      : act({ op: 'move', id, parentId: parent.id, after: target.id })
    if (out !== 'ok') return
  }

  return (
    <section className="mt-6" aria-label="Sub-issues">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Sub-issues</h3>
      <ul className="space-y-0.5" data-sub-issues={parent.id}>
        {kids.map((kid, idx) => (
          <li key={kid.id} data-sub-issue-row={kid.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-raise/60">
            {canEdit && (
              <button
                type="button"
                aria-label={`Move ${kid.title}`}
                className="grid size-7 shrink-0 cursor-grab place-items-center rounded text-ink-3 hover:text-ink active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault()
                  const grip = e.currentTarget
                  grip.setPointerCapture(e.pointerId)
                  let over = idx
                  const rows = () => [...grip.closest('[data-sub-issues]')?.querySelectorAll('[data-sub-issue-row]') ?? []] as HTMLElement[]
                  const pick = (ev: PointerEvent) => {
                    const y = ev.clientY
                    const ix = rows().findIndex((el) => {
                      const b = el.getBoundingClientRect()
                      return y >= b.top && y <= b.bottom
                    })
                    if (ix >= 0) over = ix
                  }
                  const up = () => {
                    grip.removeEventListener('pointermove', pick)
                    grip.removeEventListener('pointerup', up)
                    if (over !== idx) moveKid(idx, over)
                  }
                  grip.addEventListener('pointermove', pick)
                  grip.addEventListener('pointerup', up)
                }}
              >
                <GripVertical className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
            <StatusGlyph status={kid.status} />
            <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:text-ink-2" onClick={() => onOpen(kid.id)}>
              <span className="font-mono text-ink-3">{keyOf(roadmap, kid)}</span> {kid.title}
            </button>
          </li>
        ))}
      </ul>
      {canEdit && (
        composing ? (
          <input
            autoFocus
            className="mt-1 w-full border-0 bg-transparent px-1 py-1 text-[13px] text-ink outline-none ring-0 placeholder:text-ink-3 shadow-[inset_2px_0_0_theme(colors.ink)] focus:ring-0"
            aria-label="New sub-issue title"
            placeholder="Sub-issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add() }
              if (e.key === 'Escape') { setComposing(false); setTitle('') }
            }}
            onBlur={() => { if (!title.trim()) setComposing(false) }}
          />
        ) : (
          <button type="button" className="mt-2 text-[12.5px] text-ink-2 hover:text-ink" onClick={() => setComposing(true)}>
            Add sub-issue
          </button>
        )
      )}
    </section>
  )
}
