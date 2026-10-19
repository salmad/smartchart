import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Invite, Member, Role, Workspace, WorkspaceRepo } from '@/app/workspaces'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface Props {
  /** Null while closed. */
  workspace: Workspace | null
  repo: WorkspaceRepo
  /** The signed-in user's id: their own row says You, and offers Leave. */
  me: string
  onClose: () => void
  /** After the user left the workspace. */
  onLeft: () => void
}

const ROLES: { value: Role; label: string }[] = [{ value: 'owner', label: 'Owner' }, { value: 'editor', label: 'Editor' }, { value: 'viewer', label: 'Viewer' }]
const label = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r
const SMALL = 'text-[12px] text-ink-3'

function RolePick({ value, onChange, aria }: { value: Role; onChange: (r: Role) => void; aria: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger aria-label={aria} className="h-8 w-[104px] flex-none border-line-2 bg-app-bg text-[12.5px]"><SelectValue /></SelectTrigger>
      <SelectContent className="border-line-2 bg-raise text-ink">{ROLES.map((r) => <SelectItem key={r.value} value={r.value} className="text-[13px]">{r.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

/** Who is in the workspace, and their roles. An owner changes roles, removes people, and invites by link: no email is
    sent, the owner shares the link, which works only for that email once signed in, for 7 days. */
export function Members({ workspace, repo, me, onClose, onLeft }: Props) {
  const [list, setList] = useState<{ members: Member[]; invites: Invite[] } | null>(null)
  const [error, setError] = useState<string | null>(null), [email, setEmail] = useState(''), [role, setRole] = useState<Role>('editor')
  const [link, setLink] = useState<string | null>(null), [copied, setCopied] = useState(false)
  const owner = workspace?.role === 'owner', id = workspace?.id ?? ''
  const load = useCallback(async () => {
    if (!id) return
    try { setList(await repo.members(id)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [repo, id])
  useEffect(() => { setList(null); setError(null); setEmail(''); setLink(null); setCopied(false); void load() }, [load])
  // Every change says why when it's refused (the last owner, a lost connection), then shows the list as it now is.
  const act = async (run: () => Promise<unknown>) => { setError(null); try { await run() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } await load() }
  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setCopied(false)
    try { setLink(await repo.invite(id, email.trim(), role)); await load() } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setCopied(false) } }

  return (
    <Dialog open={workspace !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[480px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Members of {workspace?.name}</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Owners manage members. Editors make and change docs and decks. Viewers read them.</DialogDescription>

        <ul aria-label="Members" className="mt-5 grid max-h-[40vh] gap-px overflow-y-auto">
          {list === null && !error && <li className="h-10 animate-pulse rounded-lg bg-line" />}
          {list?.members.map((m) => {
            const you = m.userId === me
            return (
              <li key={m.userId} className="flex items-center gap-3 rounded-lg py-2 pl-1">
                <div className="grid min-w-0 flex-1">
                  <span className="truncate text-[13.5px] text-ink">{m.name || m.email}{you && <span className="ml-1.5 text-ink-3">You</span>}</span>
                  {m.name && <span className={`truncate ${SMALL}`}>{m.email}</span>}
                </div>
                {owner ? <RolePick value={m.role} aria={`Role of ${m.name || m.email}`} onChange={(r) => void act(() => repo.setRole(id, m.userId, r))} />
                  : <span className={`flex-none ${SMALL}`}>{label(m.role)}</span>}
                {/* One slot for Leave or Remove, so the roles line up. */}
                <div className="flex w-14 flex-none justify-end">
                  {(owner || you) && !(you && workspace?.personal) && (
                    you ? <Button variant="ghost" size="sm" onClick={() => void act(async () => { await repo.setRole(id, me, null); onLeft() })}>Leave</Button>
                      : <button type="button" aria-label={`Remove ${m.name || m.email}`} onClick={() => void act(() => repo.setRole(id, m.userId, null))}
                        className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-panel hover:text-ink"><X className="size-3.5" strokeWidth={1.75} /></button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {owner && !!list?.invites.length && (
          <div className="mt-4 grid gap-1 border-t border-line pt-4">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[.1em] text-ink-3">Invited</h3>
            <ul aria-label="Invites" className="grid gap-px">
              {list.invites.map((i) => (
                <li key={i.token} className="flex items-center gap-3 py-1.5 pl-1">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{i.email}</span>
                  <span className={`flex-none ${SMALL}`}>{label(i.role)}</span>
                  <Button variant="ghost" size="sm" onClick={() => void act(() => repo.revoke(id, i.token))} aria-label={`Revoke the invite for ${i.email}`}>Revoke</Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {owner && (
          <form onSubmit={(e) => void invite(e)} className="mt-4 grid gap-3 border-t border-line pt-4">
            <div className="flex gap-2">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-label="Email" className="h-8 min-w-0 flex-1 border-line-2 bg-app-bg text-[13px] md:text-[13px]" />
              <RolePick value={role} onChange={setRole} aria="Role for the invite" />
              <Button type="submit" size="sm" disabled={!email.trim()}>Create invite link</Button>
            </div>
            {link && (
              <div className="grid gap-1.5">
                <div className="flex gap-2">
                  <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 border-line-2 bg-app-bg font-mono text-[12px] md:text-[12px]" />
                  <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button>
                </div>
                <p className={SMALL}>Send it however you like. It works for that email once they sign in, for 7 days.</p>
              </div>
            )}
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-[12.5px] text-ink-2">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
