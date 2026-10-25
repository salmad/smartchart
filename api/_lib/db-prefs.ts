import type { Db, Q } from './db.js'

type Calls = 'getUserLook' | 'setUserLook'

export function prefsCalls(q: Q): Pick<Db, Calls> {
  return {
    getUserLook: async (u) => (await q<{ look: unknown }>('select look from user_prefs where user_id = $1', [u]))[0]?.look ?? null,
    setUserLook: async (u, look) => {
      await q(`insert into user_prefs (user_id, look) values ($1, $2) on conflict (user_id) do update set look = excluded.look`, [u, JSON.stringify(look)])
      return true
    },
  }
}
