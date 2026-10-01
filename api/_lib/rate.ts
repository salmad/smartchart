// A looping agent is stopped per key: at most RATE_PER_MINUTE calls in a minute, counted in Neon (functions keep no memory).
import type { Db } from './db.js'

export const RATE_PER_MINUTE = 60
export async function overRate(db: Db, key: string, now: number): Promise<boolean> {
  return (await db.bumpRate(key, Math.floor(now / 60_000))) > RATE_PER_MINUTE
}
