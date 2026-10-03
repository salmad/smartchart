// The test account behind one agent key, through the app's own decks API: the calls the app itself makes.
import { docFromData } from '@/engine/tools/doc'
import type { Deck } from './types'

export interface Account { origin: string; key: string }
const auth = (a: Account) => ({ Authorization: `Bearer ${a.key}` })
async function ok(r: Response, what: string): Promise<Response> {
  if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r
}
const deckIds = async (a: Account): Promise<string[]> =>
  ((await (await ok(await fetch(`${a.origin}/api/decks`, { headers: auth(a) }), 'GET /api/decks')).json()) as { id: string }[]).map((d) => d.id)

/** Every run starts as a new user: no decks. */
export async function emptyAccount(a: Account): Promise<void> {
  for (const id of await deckIds(a)) await ok(await fetch(`${a.origin}/api/decks?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(a) }), `DELETE deck ${id}`)
}

/** The deck the run made (the newest; none when the agent only asked). */
export async function readOnlyDeck(a: Account): Promise<Deck | null> {
  const [id] = await deckIds(a)
  if (!id) return null
  const row = (await (await ok(await fetch(`${a.origin}/api/decks?id=${encodeURIComponent(id)}`, { headers: auth(a) }), `GET deck ${id}`)).json()) as { id: string; name: string; data: unknown }
  const doc = docFromData(row.id, row.name, row.data)
  return { id: doc.id, style: doc.style, edit: `${a.origin}/d/${doc.id}`, slides: doc.slides.map((s) => ({ id: s.id, slide: s.slide })) }
}
