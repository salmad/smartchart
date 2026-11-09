import { useState } from 'react'
import type { FieldDef, Issue, IssueComment, IssueEvent, MemberLite } from '@/engine/roadmaps/types'
import { activityItems } from './issueActivityLine'
import { Button } from '../ui/button'

interface Props {
  issue: Issue
  events: IssueEvent[]
  comments: IssueComment[]
  fields: FieldDef[]
  members: MemberLite[]
  canEdit: boolean
  onComment: (text: string) => Promise<void>
}

export function IssueActivity({ issue, events, comments, fields, members, canEdit, onComment }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const items = activityItems(issue, events, comments, members, fields)

  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    setCommentError(null)
    try {
      await onComment(t)
      setText('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Couldn’t post the comment.'
      setCommentError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6" aria-label="Activity">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Activity</h3>
      <ol className="space-y-2 text-[12.5px] text-ink-2">
        {items.map((item, i) => (
          <li key={`${item.at}-${i}`}>{item.label}</li>
        ))}
      </ol>
      {canEdit && (
        <div className="mt-3 flex flex-col gap-2">
          {commentError && <p role="alert" className="text-[12.5px] text-bad">{commentError}</p>}
          <div className="flex gap-2">
            <textarea
              className="min-h-[72px] flex-1 resize-y rounded border border-line bg-app-bg px-2 py-1.5 text-[13px] text-ink outline-none focus:border-gold/50"
              aria-label="Comment"
              placeholder="Add a comment…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button size="sm" disabled={!text.trim() || busy} onClick={() => void send()}>Post</Button>
          </div>
        </div>
      )}
    </section>
  )
}
