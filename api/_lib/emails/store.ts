// The engagement emails' own tables: who is in the series, and what each maker has been sent or skipped.
import { randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import type { Done, Facts } from './series.js'
import type { EmailKey } from './templates.js'

/** The day the series started: makers who signed up before it start on it, later ones on their signup day. */
export const LAUNCH = '2026-11-07'

export interface Maker { userId: string; email: string; name: string; started: Date; existing: boolean; token: string }

type Q = <T>(text: string, params?: unknown[]) => Promise<T[]>

const SCHEMA = [
  `create table if not exists email_makers (user_id text primary key, email text not null, name text not null default '', started date not null, existing boolean not null, token text not null unique, unsubscribed_at timestamptz, enrolled timestamptz not null default now())`,
  // One row per slot: 'sending' is written before the send, so a retried or doubled run never sends twice.
  `create table if not exists email_sends (user_id text not null, slot integer not null, key text not null, status text not null check (status in ('sending','sent','skipped','failed')), resend_id text, error text, at timestamptz not null default now(), primary key (user_id, slot))`,
  // Clicks from the email into the site: the first one's time, and how many.
  `alter table email_sends add column if not exists clicked_at timestamptz`,
  `alter table email_sends add column if not exists clicks integer not null default 0`,
]

export function emailStore(url: string) {
  const sql = neon(url)
  let ready: Promise<unknown> | null = null
  const q: Q = async <T>(text: string, params: unknown[] = []) => {
    await (ready ??= SCHEMA.reduce<Promise<unknown>>((p, s) => p.then(() => sql.query(s)), Promise.resolve()).catch((e: unknown) => { ready = null; throw e }))
    return (await sql.query(text, params)) as T[]
  }

  return {
    /** Adds every verified account not yet in the series. Returns how many joined. */
    async enrol(): Promise<number> {
      const rows = await q<{ id: string }>(`select id::text as id from neon_auth."user" u where u."emailVerified" and not exists (select 1 from email_makers m where m.user_id = u.id::text)`)
      for (const { id } of rows) {
        await q(`insert into email_makers (user_id, email, name, started, existing, token)
          select id::text, email, coalesce(name, ''), greatest("createdAt"::date, $2::date), "createdAt"::date < $2::date, $3 from neon_auth."user" where id::text = $1
          on conflict (user_id) do nothing`, [id, LAUNCH, randomBytes(18).toString('base64url')])
      }
      return rows.length
    },

    /** Makers still in the series: not unsubscribed, account not banned. */
    makers: async (): Promise<Maker[]> => (await q<{ user_id: string; email: string; name: string; started: string; existing: boolean; token: string }>(
      `select m.user_id, u.email, m.name, m.started::text as started, m.existing, m.token from email_makers m join neon_auth."user" u on u.id::text = m.user_id
       where m.unsubscribed_at is null and not coalesce(u.banned, false) order by m.started, m.user_id`))
      .map((r) => ({ userId: r.user_id, email: r.email, name: r.name, started: new Date(`${r.started}T00:00:00Z`), existing: r.existing, token: r.token })),

    done: async (userId: string): Promise<Done[]> => (await q<{ slot: number; at: Date; status: string }>(
      `select slot, at, status from email_sends where user_id = $1 and status <> 'failed'`, [userId]))
      .map((r) => ({ slot: r.slot, at: new Date(r.at), sent: r.status !== 'skipped' })),

    async facts(userId: string): Promise<Facts> {
      const [r] = await q<{ connected: boolean; templates: number; docs: number }>(`select
        exists (select 1 from api_keys where user_id = $1) or exists (select 1 from deck_events where user_id = $1) as connected,
        (select count(distinct s->'slide'->>'template')::int from decks d, jsonb_array_elements(coalesce(d.data->'items', '[]'::jsonb)) s where d.user_id = $1) as templates,
        (select count(*)::int from docs where user_id = $1) as docs`, [userId])
      return r
    },

    latestDeck: async (userId: string): Promise<{ id: string; name: string } | null> =>
      (await q<{ id: string; name: string }>(`select id, name from decks where user_id = $1 order by updated_at desc limit 1`, [userId]))[0] ?? null,

    skip: (userId: string, slot: number) => q(`insert into email_sends (user_id, slot, key, status) values ($1, $2, '', 'skipped') on conflict do nothing`, [userId, slot]),

    /** Claims a slot before sending; false when another run already has it. A failed slot can be claimed again. */
    claim: async (userId: string, slot: number, key: EmailKey): Promise<boolean> => (await q(
      `insert into email_sends (user_id, slot, key, status) values ($1, $2, $3, 'sending')
       on conflict (user_id, slot) do update set status = 'sending', key = $3, error = null, at = now() where email_sends.status = 'failed' returning slot`, [userId, slot, key])).length > 0,

    settle: (userId: string, slot: number, result: { id: string } | { error: string }) => q(
      `update email_sends set status = $3, resend_id = $4, error = $5, at = now() where user_id = $1 and slot = $2`,
      [userId, slot, 'id' in result ? 'sent' : 'failed', 'id' in result ? result.id : null, 'error' in result ? result.error : null]),

    /** Records a click on email `key`: by the maker whose ref it is, else by `userId` (signed in), else nothing. */
    click: (key: string, ref: string, userId: string | null) => q(
      `update email_sends set clicked_at = coalesce(clicked_at, now()), clicks = clicks + 1
       where key = $1 and status = 'sent' and user_id = coalesce((select user_id from email_makers where token = $2), $3)`, [key, ref, userId]),

    unsubscribe: async (token: string): Promise<boolean> =>
      (await q(`update email_makers set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = $1 returning user_id`, [token])).length > 0,
  }
}

export type EmailStore = ReturnType<typeof emailStore>
