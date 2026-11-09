import type { FieldDef, Issue, IssueComment, IssueEvent, MemberLite } from '@/engine/roadmaps/types'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
export interface ActivityItem {
  at: number
  label: string
}

export function activityItems(
  issue: Issue,
  events: IssueEvent[],
  comments: IssueComment[],
  members: MemberLite[],
  fields: FieldDef[],
): ActivityItem[] {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone'
  const items: ActivityItem[] = []

  const hasCreated = events.some((e) => e.what === 'created')
  if (!hasCreated) {
    items.push({ at: issue.createdAt, label: `${name(issue.createdBy)} created` })
  }

  for (const e of events) {
    const who = name(e.by)
    if (e.what === 'created') {
      items.push({ at: e.at, label: `${who} created` })
      continue
    }
    if (e.what === 'commented') {
      const text = typeof e.changes[0]?.to === 'string' ? e.changes[0].to : ''
      items.push({ at: e.at, label: text ? `${who} commented · ${text}` : `${who} commented` })
      continue
    }
    if (e.what === 'deleted') {
      items.push({ at: e.at, label: `${who} deleted` })
      continue
    }
    if (e.what === 'restored') {
      items.push({ at: e.at, label: `${who} restored` })
      continue
    }
    if (e.what === 'moved') {
      items.push({ at: e.at, label: `${who} moved` })
      continue
    }
    if (e.what === 'set') {
      const rest = e.changes.filter((c) => c.path !== 'start' && c.path !== 'due')
      if (e.changes.some((c) => c.path === 'start' || c.path === 'due')) {
        items.push({ at: e.at, label: `${who} set dates` })
      }
      for (const ch of rest) {
        if (ch.path === 'title') items.push({ at: e.at, label: `${who} set title` })
        else if (ch.path === 'status' && typeof ch.to === 'string') items.push({ at: e.at, label: `${who} set status to ${STATUS_LABEL[ch.to as keyof typeof STATUS_LABEL] ?? ch.to}` })
        else if (ch.path === 'assignee') items.push({ at: e.at, label: `${who} set assignee` })
        else if (ch.path === 'body') items.push({ at: e.at, label: `${who} updated the description` })
        else if (ch.path === 'fields') items.push({ at: e.at, label: `${who} set fields` })
        else if (ch.path.startsWith('fields.')) {
          const fid = ch.path.slice('fields.'.length)
          const field = fields.find((f) => f.id === fid)
          items.push({ at: e.at, label: `${who} set ${field?.name ?? 'a field'}` })
        }
      }
      continue
    }
    for (const ch of e.changes) {
      if (ch.path === 'title') items.push({ at: e.at, label: `${who} set title` })
      else if (ch.path === 'status' && typeof ch.to === 'string') items.push({ at: e.at, label: `${who} set status to ${STATUS_LABEL[ch.to as keyof typeof STATUS_LABEL] ?? ch.to}` })
      else if (ch.path === 'assignee') items.push({ at: e.at, label: `${who} set assignee` })
      else if (ch.path === 'body') items.push({ at: e.at, label: `${who} updated the description` })
      else if (ch.path.startsWith('fields.')) {
        const fid = ch.path.slice('fields.'.length)
        const field = fields.find((f) => f.id === fid)
        items.push({ at: e.at, label: `${who} set ${field?.name ?? 'a field'}` })
      }
    }
  }

  // Comments without a matching event (older data)
  const eventTexts = new Set(events.filter((e) => e.what === 'commented').map((e) => e.changes[0]?.to))
  for (const c of comments) {
    if (eventTexts.has(c.text)) continue
    items.push({ at: c.at, label: `${name(c.by)} commented · ${c.text}` })
  }

  items.sort((a, b) => a.at - b.at)
  return items
}
