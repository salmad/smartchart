import { useEffect, useRef, useState } from 'react'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { cn } from '@/app/lib/utils'
import { GrowingText } from './issueParts'

interface Props {
  title: string
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  issueId: string
  /** The full page's title is the page heading and a size up. */
  page?: boolean
}

/** The issue's title, typed in place: a long one wraps instead of clipping. Enter or leaving saves, Escape drops the edit. */
export function IssueTitle({ title, canEdit, act, issueId, page }: Props) {
  const [draft, setDraft] = useState(title)
  useEffect(() => setDraft(title), [title])
  const dropped = useRef(false)
  const type = cn('font-semibold leading-[1.3] tracking-[-.015em] text-ink', page ? 'text-[24px]' : 'text-[18px]')

  const commit = () => {
    const t = dropped.current ? '' : draft.replace(/\s+/g, ' ').trim()
    dropped.current = false
    if (!t || t === title) { setDraft(title); return }
    act({ op: 'set', ids: [issueId], props: { title: t } })
  }

  if (!canEdit) {
    const Tag = page ? 'h1' : 'h2'
    return <Tag className={type}>{title}</Tag>
  }

  return (
    <GrowingText
      className={cn('w-full p-0', type)}
      aria-label="Issue title"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') { dropped.current = true; e.currentTarget.blur() }
      }}
    />
  )
}
