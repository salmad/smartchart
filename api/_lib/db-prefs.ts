import type { Db, Q } from './db.js'

type Calls = 'getUserLook' | 'setUserLook' | 'agentConnectState' | 'dismissAgentNudge' | 'markAgentConnectDone'

type Onboarding = { agentNudgeDismissed?: boolean; agentConnectDone?: boolean }

const readOnboarding = (raw: unknown): Onboarding => {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Onboarding
  return {
    ...(o.agentNudgeDismissed ? { agentNudgeDismissed: true } : {}),
    ...(o.agentConnectDone ? { agentConnectDone: true } : {}),
  }
}

export function prefsCalls(q: Q): Pick<Db, Calls> {
  return {
    getUserLook: async (u) => (await q<{ look: unknown }>('select look from user_prefs where user_id = $1', [u]))[0]?.look ?? null,
    setUserLook: async (u, look) => {
      await q(`insert into user_prefs (user_id, look) values ($1, $2) on conflict (user_id) do update set look = excluded.look`, [u, JSON.stringify(look)])
      return true
    },
    agentConnectState: async (u) => {
      const row = (await q<{ onboarding: unknown }>('select onboarding from user_prefs where user_id = $1', [u]))[0]
      const on = readOnboarding(row?.onboarding)
      const keys = Number((await q<{ n: number }>('select count(*)::int as n from api_keys where user_id = $1', [u]))[0]?.n ?? 0)
      const done = keys > 0 || !!on.agentConnectDone
      return { dismissed: !!on.agentNudgeDismissed, done }
    },
    dismissAgentNudge: async (u) => {
      await q(`insert into user_prefs (user_id, look, onboarding) values ($1, $2::jsonb, $3::jsonb)
        on conflict (user_id) do update set onboarding = user_prefs.onboarding || excluded.onboarding`,
        [u, JSON.stringify({ theme: 'ink', accent: null }), JSON.stringify({ agentNudgeDismissed: true })])
    },
    markAgentConnectDone: async (u) => {
      await q(`insert into user_prefs (user_id, look, onboarding) values ($1, $2::jsonb, $3::jsonb)
        on conflict (user_id) do update set onboarding = user_prefs.onboarding || excluded.onboarding`,
        [u, JSON.stringify({ theme: 'ink', accent: null }), JSON.stringify({ agentConnectDone: true })])
    },
  }
}
