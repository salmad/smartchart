/* The one-time “Connect an agent” nudge (FUTURE #18a): server remembers dismiss and when MCP or a key connected. */
import { useCallback, useEffect, useState } from 'react'
import { callApi } from './workspaces'

interface PrefsAgent {
  agentNudgeDismissed?: boolean
  agentConnectDone?: boolean
  showAgentNudge?: boolean
}

const dismissKey = (accountId: string) => `smartchart.agentNudge.dismissed.${accountId}`

function readLocalDismiss(accountId: string): boolean {
  try { return localStorage.getItem(dismissKey(accountId)) === '1' } catch { return false }
}

function writeLocalDismiss(accountId: string) {
  try { localStorage.setItem(dismissKey(accountId), '1') } catch { /* blocked */ }
}

/** `remote`: false for the dev account (local dismiss only). */
export function useAgentConnect(accountId: string, remote: boolean) {
  const [show, setShow] = useState(false)

  const load = useCallback(async () => {
    if (!remote) {
      setShow(!readLocalDismiss(accountId))
      return
    }
    try {
      const j = await callApi<PrefsAgent>(fetch, '/api/prefs')
      setShow(!!j.showAgentNudge)
    } catch { setShow(false) }
  }, [accountId, remote])

  useEffect(() => { void load() }, [load])

  const dismiss = useCallback(async () => {
    setShow(false)
    if (!remote) { writeLocalDismiss(accountId); return }
    try {
      const j = await callApi<PrefsAgent>(fetch, '/api/prefs', { method: 'PUT', body: { dismissAgentNudge: true } })
      setShow(!!j.showAgentNudge)
    } catch { writeLocalDismiss(accountId) }
  }, [accountId, remote])

  const refresh = useCallback(() => { void load() }, [load])

  return { show, dismiss, refresh }
}
