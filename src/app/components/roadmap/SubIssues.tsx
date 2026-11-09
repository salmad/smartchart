import { useState } from 'react'
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

  const move = (id: string, dir: -1 | 1) => {
    const i = kids.findIndex((k) => k.id === id)
    const swap = kids[i + dir]
    if (!swap) return
    act(dir < 0 ? { op: 'move', id, parentId: parent.id, before: swap.id } : { op: 'move', id, parentId: parent.id, after: swap.id })
  }

  return (
    <section className="mt-6" aria-label="Sub-issues">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Sub-issues</h3>
      <ul className="space-y-0.5">
        {kids.map((kid, idx) => (
          <li key={kid.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-raise/60">
            {canEdit && (
              <span className="flex flex-col gap-0.5 text-ink-3">
                <button type="button" className="leading-none disabled:opacity-30" disabled={idx === 0} aria-label={`Move ${kid.title} up`} onClick={() => move(kid.id, -1)}>↑</button>
                <button type="button" className="leading-none disabled:opacity-30" disabled={idx === kids.length - 1} aria-label={`Move ${kid.title} down`} onClick={() => move(kid.id, 1)}>↓</button>
              </span>
            )}
            <StatusGlyph status={kid.status} />
            <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:text-gold" onClick={() => onOpen(kid.id)}>
              <span className="font-mono text-ink-3">{keyOf(roadmap, kid)}</span> {kid.title}
            </button>
          </li>
        ))}
      </ul>
      {canEdit && (
        composing ? (
          <input
            autoFocus
            className="mt-2 w-full rounded border border-line bg-app-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-gold/50"
            aria-label="New sub-issue title"
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
