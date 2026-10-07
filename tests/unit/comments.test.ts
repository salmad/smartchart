import { describe, expect, it } from 'vitest'
import { commentLines, commentsOf, mergeComments, openComments, pathLabel, quoteOf, resolveComment, type DeckComment } from '../../src/engine/comments'

const c = (id: string, at: number, extra: Partial<DeckComment> = {}): DeckComment => ({ id, slideId: 's1', text: `note ${id}`, by: 'Sam', at, ...extra })

describe('comments', () => {
  it('reads only well-formed comments', () => {
    expect(commentsOf([c('c_1', 1), { id: 'x' }, null, 'no'])).toEqual([c('c_1', 1)])
    expect(commentsOf(undefined)).toEqual([])
  })
  it('resolves with a reply, and says why it can’t', () => {
    const r = resolveComment([c('c_1', 1)], 'c_1', 'Claude', ' Cut to 12 words ', 5)
    expect(r).toEqual([{ ...c('c_1', 1), done: { by: 'Claude', at: 5, reply: 'Cut to 12 words' } }])
    expect(resolveComment(r as DeckComment[], 'c_1', 'Claude', '', 6)).toMatch(/already resolved/)
    expect(resolveComment([c('c_1', 1)], 'c_9', 'Claude', '', 6)).toMatch(/No comment c_9 \(open: c_1\)/)
  })
  it('lists open comments for an agent, naming deleted slides', () => {
    const all = [c('c_1', 1), c('c_2', 2, { slideId: 'gone' }), c('c_3', 3, { done: { by: 'You', at: 4 } })]
    expect(openComments(all)).toHaveLength(2)
    expect(commentLines(all, ['s0', 's1'])).toEqual(['c_1 on s1 (slide 2), by Sam: "note c_1"', 'c_2 on gone (a deleted slide), by Sam: "note c_2"'])
  })
  it('merges by id: both sides’ new comments, resolved on either side wins, deletes stick when untouched', () => {
    const base = [c('c_1', 1), c('c_2', 2)]
    const local = [c('c_1', 1), c('c_2', 2), c('c_l', 5)]                               // added one here
    const server = [{ ...c('c_1', 1), done: { by: 'Claude', at: 6 } }, c('c_s', 4)]    // resolved c_1, deleted c_2, added c_s
    expect(mergeComments(local, server, base).map((x) => [x.id, !!x.done])).toEqual([['c_1', true], ['c_s', false], ['c_l', false]])
    // Deleted here, untouched on the server: stays deleted.
    expect(mergeComments([c('c_1', 1)], base, base).map((x) => x.id)).toEqual(['c_1'])
  })
})

import { runTool } from '../../api/_lib/deck-service'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeDb } from './fake-db'
import { fakeJev } from './fakes'

describe('comments over MCP', () => {
  const card = starterSlide(STARTERS.find((s) => s.consulting.template === 'cards') ?? STARTERS[0], 'consulting')
  const caller = { user: { id: 'u1', email: 'u1@x.y' }, client: 'Claude Code', key: 'k' }
  async function deckWithComment() {
    const db = fakeDb(), d = { db, origin: 'https://app.test', jev: fakeJev(), now: () => 1_000_000 }
    const made = await runTool('create_deck', { style: 'consulting' }, caller, d)
    const deckId = made.ok ? String(made.result.deckId) : ''
    const s = await runTool('create_slide', { deckId, slide: card }, caller, d)
    const slideId = s.ok ? String(s.result.slideId) : ''
    // The maker leaves a note in the app: the comment is in the deck's saved data.
    const row = db.rows.get(deckId)
    if (!row) throw new Error("no deck")
    row.data = { ...(row.data as object), comments: [{ id: 'c_1', slideId, text: 'Too wordy', by: 'Sam', at: 5 }] }
    return { d, deckId, slideId, db }
  }
  it('get_deck and read_slide show open comments', async () => {
    const { d, deckId, slideId } = await deckWithComment()
    expect(await runTool('get_deck', { deckId }, caller, d)).toMatchObject({ ok: true, result: { comments: [{ commentId: 'c_1', slideId, text: 'Too wordy', by: 'Sam' }] } })
    expect(await runTool('read_slide', { deckId, slideId }, caller, d)).toMatchObject({ ok: true, result: { comments: [{ commentId: 'c_1' }] } })
  })
  it('resolve_comment signs with the client, keeps the slides, and refuses twice', async () => {
    const { d, deckId, db } = await deckWithComment()
    expect(await runTool('resolve_comment', { deckId, commentId: 'c_1', reply: 'Cut the subtitle to one line' }, caller, d)).toMatchObject({ ok: true, result: { resolved: 'c_1' } })
    const data = db.rows.get(deckId)?.data as { comments: { done?: { by: string; reply?: string } }[]; items: unknown[] }
    expect(data.comments[0].done).toMatchObject({ by: 'Claude Code', reply: 'Cut the subtitle to one line' })
    expect(data.items).toHaveLength(1)
    const got = await runTool('get_deck', { deckId }, caller, d)
    expect(got.ok && 'comments' in got.result).toBe(false)
    expect(await runTool('resolve_comment', { deckId, commentId: 'c_1', reply: 'again' }, caller, d)).toMatchObject({ ok: false, error: { code: 'refused' } })
    expect(await runTool('resolve_comment', { deckId, commentId: 'c_9', reply: 'x' }, caller, d)).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })
})

describe('comments on a part', () => {
  const base = { id: 'c_1', slideId: 's_x1', by: 'Sam', at: 1 }
  it('labels a path in words', () => {
    expect(pathLabel('title')).toBe('Title')
    expect(pathLabel('points[2].text')).toBe('Point 3 · text')
    expect(pathLabel('notes[0]')).toBe('Note 1')
  })
  it('keeps the start of the part’s text, without markup', () => {
    expect(quoteOf('**Churn** fell [4 pts](https://x.co)')).toBe('Churn fell 4 pts')
    expect(quoteOf('x'.repeat(100))).toHaveLength(60)
    expect(quoteOf(7)).toBeUndefined()
  })
  it('tells an agent where, and when the part is gone', () => {
    const c = [{ ...base, text: 'too wordy', path: 'points[2].text', quote: 'Churn fell 4 pts' }, { ...base, id: 'c_2', text: 'whole' }]
    expect(commentLines(c, ['s_x1'])[0]).toBe('c_1 on s_x1 (slide 1) at points[2].text ("Churn fell 4 pts"), by Sam: "too wordy"')
    expect(commentLines(c, ['s_x1'], () => false)[0]).toContain('at points[2].text (gone; was "Churn fell 4 pts")')
    expect(commentLines(c, ['s_x1'])[1]).toBe('c_2 on s_x1 (slide 1), by Sam: "whole"')
  })
  it('reads saved comments, dropping a malformed path or quote', () => {
    expect(commentsOf([{ ...base, text: 't', path: 3, quote: 'q' }])).toEqual([{ ...base, text: 't', path: undefined, quote: 'q' }])
  })
})
