/* Palette and accent for the signed-in user: cached in this browser, synced with /api/prefs on the server. */
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_USER_LOOK, parseUserLook, type UserLook } from '@/engine/look'
import { callApi } from './workspaces'

const key = (accountId: string) => `smartchart.user.look.v1.${accountId}`

function readCached(accountId: string): UserLook | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key(accountId)) ?? 'null')
    return parseUserLook(raw)
  } catch { return null }
}

function writeCached(accountId: string, look: UserLook) {
  try { localStorage.setItem(key(accountId), JSON.stringify(look)) } catch { /* storage blocked */ }
}

/** `remote`: false for the dev account (local cache only). */
export function useUserLook(accountId: string, remote: boolean): { look: UserLook; setLook: (patch: Partial<UserLook>) => Promise<UserLook> } {
  const [look, setLookState] = useState<UserLook>(() => readCached(accountId) ?? DEFAULT_USER_LOOK)

  useEffect(() => {
    if (!remote) return
    let live = true
    void callApi<UserLook>(fetch, '/api/prefs').then((got) => {
      if (!live) return
      const next = parseUserLook(got) ?? DEFAULT_USER_LOOK
      setLookState(next)
      writeCached(accountId, next)
    }).catch(() => undefined)
    return () => { live = false }
  }, [accountId, remote])

  const setLook = useCallback(async (patch: Partial<UserLook>) => {
    const next = { ...look, ...patch }
    setLookState(next)
    writeCached(accountId, next)
    if (remote) await callApi(fetch, '/api/prefs', { method: 'PUT', body: next })
    return next
  }, [accountId, look, remote])

  return { look, setLook }
}
