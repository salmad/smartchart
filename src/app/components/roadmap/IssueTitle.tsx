import { useEffect, useState } from 'react'
import type { RoadmapOp } from '@/engine/roadmaps/ops'

interface Props {
  title: string
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  issueId: string
  as?: 'h1' | 'h2'
}

export function IssueTitle({ title, canEdit, act, issueId, as: Tag = 'h2' }: Props) {
  const [draft, setDraft] = useState(title)
  useEffect(() => setDraft(title), [title])

  const commit = () => {
    const t = draft.trim()
    if (!t || t === title) { setDraft(title); return }
    act({ op: 'set', ids: [issueId], props: { title: t } })
  }

  if (!canEdit) return <Tag className="text-[20px] font-semibold tracking-[-.015em] text-ink">{title}</Tag>

  return (
    <input
      className="w-full border-0 bg-transparent p-0 text-[20px] font-semibold tracking-[-.015em] text-ink outline-none focus:ring-0"
      aria-label="Issue title"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setDraft(title); (e.target as HTMLInputElement).blur() }
      }}
    />
  )
}
