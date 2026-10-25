import { describe, expect, it } from 'vitest'
import { fakeDb } from './fake-db'
import { prefsHandler } from '../../api/_lib/prefs'

const as = (id: string) => async () => ({ id, email: `${id}@x.co`, name: id, via: 'session' as const })

describe('/api/prefs', () => {
  it('reads and writes look for the signed-in user', async () => {
    const db = fakeDb(), h = prefsHandler({ userFrom: as('u1'), db: () => db })
    expect(await (await h(new Request('http://x/prefs'))).json()).toEqual({
      theme: 'paper', accent: null, agentNudgeDismissed: false, agentConnectDone: false, showAgentNudge: true,
    })
    expect((await h(new Request('http://x/prefs', { method: 'PUT', body: JSON.stringify({ theme: 'ink', accent: '#665EFD' }) }))).status).toBe(200)
    expect(await (await h(new Request('http://x/prefs'))).json()).toMatchObject({ theme: 'ink', accent: '#665EFD', showAgentNudge: true })
    expect((await h(new Request('http://x/prefs', { method: 'PUT', body: JSON.stringify({ dismissAgentNudge: true }) }))).status).toBe(200)
    expect(await (await h(new Request('http://x/prefs'))).json()).toMatchObject({ agentNudgeDismissed: true, showAgentNudge: false })
  })
})
