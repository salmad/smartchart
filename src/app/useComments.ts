/* The maker's own comment actions: leave a note on a slide, resolve it, delete it, or ask SmartChart to address the
   open ones. Like every other write, they wait while a turn runs or a slide is being edited. */
import { useMemo } from 'react'
import { MAX_COMMENT, newCommentId, openComments, resolveComment } from '@/engine/comments'
import { locked, type Action, type AppState } from './state'

export interface CommentActions {
  /** `path`: the part of the slide it is about (none: the whole slide); `quote`: that part's text, as it was. */
  add(slideId: string, text: string, path?: string | null, quote?: string): void
  resolve(id: string): void
  remove(id: string): void
  /** Sends the agent a request to address the slide's open comments. */
  ask(slideId: string): void
}

export function useComments(app: { getState(): AppState; dispatch(a: Action): void }, author: string, send: (text: string) => void): CommentActions {
  return useMemo(() => {
    const set = (comments: AppState['comments']) => app.dispatch({ type: 'set', patch: { comments } })
    const free = () => !locked(app.getState())
    return {
      add: (slideId, text, path, quote) => {
        const s = app.getState()
        if (!free() || !text.trim()) return
        set([...s.comments, { id: newCommentId(s.comments.map((c) => c.id)), slideId, text: text.trim().slice(0, MAX_COMMENT), by: author, at: Date.now(), ...(path ? { path, ...(quote ? { quote } : {}) } : {}) }])
      },
      resolve: (id) => { const next = resolveComment(app.getState().comments, id, author, undefined, Date.now()); if (free() && typeof next !== 'string') set(next) },
      remove: (id) => { if (free()) set(app.getState().comments.filter((c) => c.id !== id)) },
      ask: (slideId) => {
        const s = app.getState(), n = s.items.findIndex((it) => it.id === slideId) + 1, count = openComments(s.comments, slideId).length
        if (free() && count) send(`Address the ${count === 1 ? 'open comment' : `${count} open comments`} on slide ${n}.`)
      },
    }
  }, [app, author, send])
}

/** How the maker signs a comment: their name, else the start of their email. */
export const authorOf = (a: { name?: string | null; email: string }) => a.name?.trim() || a.email.split('@')[0] || 'You'
