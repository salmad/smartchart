import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import type { FieldDef, Issue, IssueComment, IssueEvent, MemberLite, SprintRhythm } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Avatar } from './Avatar'
import { activityItems, fullTime, timeAgo } from './issueActivityLine'
import { GrowingText, Hint, IssueSection } from './issueParts'

interface Props {
  issue: Issue
  events: IssueEvent[]
  comments: IssueComment[]
  fields: FieldDef[]
  members: MemberLite[]
  rhythm: SprintRhythm | null
  canEdit: boolean
  onComment: (text: string) => Promise<void>
}

function When({ at, now }: { at: number; now: number }) {
  return (
    <Hint label={fullTime(at)}>
      <time dateTime={new Date(at).toISOString()} className="flex-none cursor-default whitespace-nowrap text-[12px] tabular-nums text-ink-3">{timeAgo(at, now)}</time>
    </Hint>
  )
}

/** The issue's history as a quiet timeline: changes as one-line sentences, comments as entries, and a field to add one. */
export function IssueActivity({ issue, events, comments, fields, members, rhythm, canEdit, onComment }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const items = activityItems(issue, events, comments, members, fields, rhythm)
  const now = Date.now()
  const ready = !!text.trim() && !busy

  const send = async () => {
    if (!ready) return
    setBusy(true)
    setFailed(null)
    try {
      await onComment(text.trim())
      setText('')
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Couldn’t post the comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <IssueSection label="Activity">
      <ol className="grid gap-0.5">
        {items.map((item, i) => item.comment === undefined ? (
          <li key={`${item.at}-${i}`} className="flex min-h-7 items-baseline gap-2.5 py-1 text-[12.5px] leading-[1.45] text-ink-3">
            <span aria-hidden className="grid w-[18px] flex-none place-items-center self-center"><span className="size-[5px] rounded-full bg-line-2" /></span>
            <p className="min-w-0"><span className="text-ink-2">{item.who}</span> {item.did}</p>
            <When at={item.at} now={now} />
          </li>
        ) : (
          <li key={`${item.at}-${i}`} className="flex gap-2.5 py-2">
            <Avatar name={item.who} className="mt-px" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 text-[13px] leading-[1.45]">
                <span className="truncate font-medium text-ink">{item.who}</span>
                <When at={item.at} now={now} />
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-ink">{item.comment}</p>
            </div>
          </li>
        ))}
      </ol>
      {canEdit && (
        <form
          className="relative mt-3 cursor-text rounded-[10px] border border-line-2 bg-app-bg transition-colors focus-within:border-ink-3"
          onSubmit={(e) => { e.preventDefault(); void send() }}
        >
          <GrowingText
            className="min-h-[76px] w-full px-3 pb-10 pt-2.5 text-[13px] leading-[1.5] text-ink placeholder:text-ink-3"
            aria-label="Comment"
            placeholder="Leave a comment…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
              if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur() }
            }}
          />
          <Hint label="Post (⌘↵)">
            <Button type="submit" size="sm" aria-label="Post" disabled={!ready} className="absolute bottom-2 right-2 w-7 rounded-md px-0">
              <ArrowUp strokeWidth={2} />
            </Button>
          </Hint>
        </form>
      )}
      {failed && <p role="alert" className="mt-2 text-[12.5px] text-bad">{failed}</p>}
    </IssueSection>
  )
}
