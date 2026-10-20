/* What this browser last saw of an account's workspaces, lists and open deck, so a repeat visit paints at once and
   the server's answer replaces it. One IndexedDB store keyed `<account>:<name>`; a different schema version is
   thrown away; where IndexedDB is blocked the entries live in memory for the session. Nothing here ever rejects. */

const DB = 'occam-cache', VERSION = 1, STORE = 'entries'

const memory = new Map<string, unknown>()
let opened: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  return (opened ??= new Promise<IDBDatabase | null>((done) => {
    const attempt = (retry: boolean) => {
      let req: IDBOpenDBRequest
      try { req = indexedDB.open(DB, VERSION) } catch { done(null); return }
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => done(req.result)
      // A newer schema than this code knows: start over rather than read what cannot be trusted.
      req.onerror = () => {
        if (!retry || req.error?.name !== 'VersionError') { done(null); return }
        try {
          const del = indexedDB.deleteDatabase(DB)
          del.onsuccess = () => attempt(false)
          del.onerror = () => done(null)
        } catch { done(null) }
      }
    }
    attempt(true)
  }))
}

const key = (account: string, name: string) => `${account}:${name}`
const settle = <T>(req: IDBRequest<T>) => new Promise<T | undefined>((done) => { req.onsuccess = () => done(req.result); req.onerror = () => done(undefined) })

export async function cacheGet<T>(account: string, name: string): Promise<T | undefined> {
  try {
    const db = await open()
    if (!db) return memory.get(key(account, name)) as T | undefined
    return (await settle(db.transaction(STORE).objectStore(STORE).get(key(account, name)))) as T | undefined
  } catch { return undefined }
}

export async function cacheSet(account: string, name: string, value: unknown): Promise<void> {
  try {
    const db = await open()
    if (!db) { memory.set(key(account, name), value); return }
    await settle(db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key(account, name)))
  } catch { /* full or blocked: the next visit starts from the server */ }
}

/** Forgets everything stored for the account (sign-out). */
export async function cacheClear(account: string): Promise<void> {
  const prefix = `${account}:`
  try {
    for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k)
    const db = await open()
    if (db) await settle(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(IDBKeyRange.bound(prefix, `${prefix}￿`)))
  } catch { /* nothing to clear */ }
}
