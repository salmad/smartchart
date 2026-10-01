// Model calls made by tools on the server: straight to the provider, each counted against the user's day.
import { jevAnswers, jevRequest, type JevFn, type JevResponse } from '../../src/engine/agent/llm.js'
import { ToolError } from '../../src/engine/tools/types.js'
import type { Db } from './db.js'
import { DAILY_CALLS } from './quota.js'

const JEV_URL = 'https://openrouter.ai/api/alpha/decisions', JEV_MODEL = '~typesafe/jev-latest'

export function serverJev({ userId, db, fetcher = (...a) => fetch(...a), limit = DAILY_CALLS }: { userId: string; db: Db; fetcher?: typeof fetch; limit?: number }): JevFn {
  return async (state, questions) => {
    if ((await db.countCall(userId)) > limit) throw new ToolError('quota', 'You’ve used today’s model calls. They reset at midnight UTC.')
    const { qs, back } = jevRequest(questions), t0 = performance.now()
    const r = await fetcher(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state, questions: qs }), signal: AbortSignal.timeout(55_000) })
    if (!r.ok) throw new ToolError('upstream', `The decision model answered ${r.status}. Try again in a moment.`)
    const j = (await r.json()) as JevResponse
    return Object.assign(jevAnswers(j, back), { _ms: Math.round(performance.now() - t0), _cost: j.usage?.cost ?? 0 })
  }
}
