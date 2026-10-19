import { useEffect, useState } from 'react'
import type { WorkspaceRepo } from '@/app/workspaces'

/** /i/:token, signed in: accept the invite, make its workspace the one that opens, and go to it. A refusal (another
    email, expired, taken back) says why, in the server's words. Signed out, Root shows sign-in first, then returns here. */
export function Invite({ token, repo, onJoined }: { token: string; repo: WorkspaceRepo; onJoined: () => void }) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const { workspaceId } = await repo.accept(token)
        await repo.use(workspaceId).catch(() => undefined)
        if (live) onJoined()
      } catch (e) { if (live) setError(e instanceof Error ? e.message : String(e)) }
    })()
    return () => { live = false }
  }, [token, repo, onJoined])
  return (
    <div className="grid h-full place-content-center gap-2 bg-app-bg px-6 text-center text-ink">
      {error === null
        ? <p className="text-[13.5px] text-ink-3">Joining the workspace…</p>
        : <>
            <p className="text-[17px] font-medium">This invite can’t be used.</p>
            <p className="max-w-[420px] text-ink-3">{error}</p>
            <a href="/" className="mt-4 text-[13px] text-ink-2 hover:text-ink">Open Occam</a>
          </>}
    </div>
  )
}
