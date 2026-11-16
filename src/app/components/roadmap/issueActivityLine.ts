import type { FieldDef, Issue, IssueComment, IssueEvent, MemberLite } from '@/engine/roadmaps/types'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
import { isoOf, shortDate, todayIso } from './dates'

/** One line of an issue's history: who did what, or what they wrote. */
export interface ActivityItem {
  at: number
  who: string
  /** The rest of the sentence after the name: "created the issue". */
  did: string
  /** A comment's words; `did` is then "commented". */
  comment?: string
}

const WHOLE: Partial<Record<IssueEvent['what'], string>> = {
  created: 'created the issue',
  deleted: 'deleted the issue',
  restored: 'restored the issue',
  moved: 'moved the issue',
}

function changeLine(path: string, to: unknown, fields: FieldDef[]): string | null {
  if (path === 'title') return 'renamed the issue'
  if (path === 'status' && typeof to === 'string') return `set status to ${STATUS_LABEL[to as keyof typeof STATUS_LABEL] ?? to}`
  if (path === 'assignee') return to ? 'changed the assignee' : 'removed the assignee'
  if (path === 'start' || path === 'due') return 'changed the dates'
  if (path === 'body') return 'updated the description'
  if (path === 'fields') return 'changed fields'
  if (path.startsWith('fields.')) return `changed ${fields.find((f) => f.id === path.slice('fields.'.length))?.name ?? 'a field'}`
  return null
}

/** Within this long, the same person doing the same thing again reads as one line. */
const SAME_MS = 5 * 60_000

/** The issue's events and comments in time order, oldest first. */
export function activityItems(issue: Issue, events: IssueEvent[], comments: IssueComment[], members: MemberLite[], fields: FieldDef[]): ActivityItem[] {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone'
  const items: ActivityItem[] = []
  if (!events.some((e) => e.what === 'created')) items.push({ at: issue.createdAt, who: name(issue.createdBy), did: 'created the issue' })

  for (const e of events) {
    const who = name(e.by)
    const whole = WHOLE[e.what]
    if (whole) items.push({ at: e.at, who, did: whole })
    else if (e.what !== 'commented') {
      const lines = new Set(e.changes.map((c) => changeLine(c.path, c.to, fields)).filter((l): l is string => l !== null))
      for (const did of lines) items.push({ at: e.at, who, did })
    }
  }
  for (const c of comments) items.push({ at: c.at, who: name(c.by), did: 'commented', comment: c.text })
  // Older data kept a comment's words only on its event.
  const kept = new Set(comments.map((c) => c.text))
  for (const e of events) {
    const text = e.what === 'commented' ? e.changes[0]?.to : null
    if (typeof text === 'string' && text && !kept.has(text)) items.push({ at: e.at, who: name(e.by), did: 'commented', comment: text })
  }

  items.sort((a, b) => a.at - b.at)
  return items.filter((it, i) => {
    const prev = items[i - 1]
    return !prev || it.comment !== undefined || prev.who !== it.who || prev.did !== it.did || it.at - prev.at > SAME_MS
  })
}

/** "now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(at: number, now: number): string {
  const min = Math.floor((now - at) / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min} min ago`
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`
  if (min < 7 * 24 * 60) return `${Math.floor(min / (24 * 60))} d ago`
  return shortDate(isoOf(new Date(at)), todayIso())
}

export const fullTime = (at: number): string =>
  new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
