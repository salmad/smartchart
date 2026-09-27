import { test, expect } from 'vitest'
import { sendTurn, type TurnDeps } from '@/app/turn'
import { initialState, reducer, type Action, type AppState } from '@/app/state'
import type { ChatMessage } from '@/engine/agent/llm'
import { fakeAgent, fakeJev, toolCall } from './fakes'

const COVER = { template: 'cover', title: 'Acme', subtitle: 'Cards for small businesses.' }
const reservedId = (m: ChatMessage[]) => JSON.parse(m.filter((x) => x.role === 'tool').at(-1)?.content ?? '{}').slideId

/** A reducer-backed store and the deps a turn needs, with a stub measurer and no judgment checks. */
function harness(models: TurnDeps['models']) {
  let state: AppState = { ...initialState(), deckId: 'd_test', live: true }
  const deps: TurnDeps = {
    measurer: { measure: () => [], lines: 1, warnings: [] },
    dispatch: (a: Action) => { state = reducer(state, a) },
    getState: () => state,
    models,
    judge: async () => ({ checks: [], ms: 0 }),
  }
  return { deps, state: () => state }
}

test('a turn that writes a cover ends with one slide, one user and one bot message, not busy', async () => {
  const agentStep = fakeAgent([(m) => toolCall('edit_slide', { slideId: reservedId(m), slide: COVER, reply: 'Added the cover.' })])
  const h = harness({ agentStep, jev: fakeJev({ intent: ['new_slide', 0.95], template: ['cover', 0.9] }) })
  const r = await sendTurn('A cover for Acme', h.deps)
  const s = h.state()
  expect(s.items).toHaveLength(1)
  expect(s.items[0].slide.title).toBe('Acme')
  expect(s.busy).toBe(false)
  expect(s.messages.map((m) => m.kind)).toEqual(['user', 'bot'])
  expect(s.messages[1].text).toBe('Added the cover.')
  expect(s.history.length).toBeGreaterThan(0)
  expect(r.reply).toBe('Added the cover.')
  expect(r.items).toHaveLength(1)
})

test('a turn whose model call fails ends with an error message and not busy', async () => {
  const agentStep = async () => { throw new Error('api down') }
  const h = harness({ agentStep, jev: fakeJev({ intent: ['other', 0.9] }) })
  const r = await sendTurn('hello', h.deps)
  const s = h.state()
  expect(s.busy).toBe(false)
  expect(s.messages.map((m) => m.kind)).toEqual(['user', 'error'])
  expect(s.messages[1].text).toContain('api down')
  expect(r.error).toContain('api down')
})

test('a rate-limited model call reads as a plain sentence, not the API JSON', async () => {
  const agentStep = async () => { throw new Error('{"code":"1302","message":"Rate limit reached for requests"}') }
  const h = harness({ agentStep, jev: fakeJev({ intent: ['other', 0.9] }) })
  const r = await sendTurn('hello', h.deps)
  expect(h.state().messages[1].text).toBe('Something went wrong: the model is busy right now. Wait a few seconds and send it again.')
  expect(r.error).toContain('1302')
})

test('judgment checks land on the slide written this turn and the pending flag clears', async () => {
  const agentStep = fakeAgent([(m) => toolCall('edit_slide', { slideId: reservedId(m), slide: COVER, reply: 'Done.' })])
  const h = harness({ agentStep, jev: fakeJev({ intent: ['new_slide', 0.95], template: ['cover', 0.9] }) })
  h.deps.judge = async () => ({ checks: [{ id: 'J2', ok: true, msg: 'Body supports the claim' }], ms: 0 })
  await sendTurn('A cover', h.deps)
  const it = h.state().items[0]
  expect(it.checks.map((c) => c.id)).toContain('J2')
  expect(it.checksPending).toBe(false)
})
