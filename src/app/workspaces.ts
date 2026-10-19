/* Workspaces as the app reaches them: on the server for a signed-in user (/api/workspaces), or the dev account's one
   workspace in this browser. A refused call throws the sentence to show (what the server said, or why it couldn't). */

export type Role = 'owner' | 'editor' | 'viewer'
/** `personal`: the user's own, made on their first visit; it can't be left. Most recently used first. */
export interface Workspace { id: string; name: string; role: Role; personal: boolean; members: number; usedAt: number | null }
/** `personal`: the workspace is this member's own, so their role there is fixed. */
export interface Member { userId: string; email: string; name: string; role: Role; personal: boolean }
export interface Invite { token: string; email: string; role: Role; expires: number }

export interface WorkspaceRepo {
  list(): Promise<Workspace[]>
  create(name: string): Promise<string>
  rename(id: string, name: string): Promise<void>
  /** Marks it the most recently used: the one the app (and an agent) opens next time. */
  use(id: string): Promise<void>
  /** Members, and the open invites (empty unless the user is an owner). */
  members(id: string): Promise<{ members: Member[]; invites: Invite[] }>
  /** Null removes the member (or, for oneself, leaves). */
  setRole(id: string, member: string, role: Role | null): Promise<void>
  /** The invite link, to send however the owner likes. */
  invite(id: string, email: string, role: Role): Promise<string>
  revoke(id: string, token: string): Promise<void>
  accept(token: string): Promise<{ workspaceId: string; role: Role }>
}

export const OFFLINE = 'You’re offline, or the server can’t be reached.'

/** One call to the API; the answer's JSON, or a thrown sentence. */
export async function callApi<T>(fetcher: typeof fetch, url: string, init?: { method?: string; body?: unknown }, onSignedOut?: () => void): Promise<T> {
  let r: Response
  try {
    r = await fetcher(url, { credentials: 'same-origin', method: init?.method ?? 'GET',
      ...(init?.body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) } : {}) })
  } catch { throw new Error(OFFLINE) }
  if (r.status === 401) onSignedOut?.()
  if (r.status === 204) return undefined as T
  const body = (await r.json().catch(() => null)) as { error?: unknown } | null
  if (!r.ok) throw new Error(typeof body?.error === 'string' ? body.error : `The server answered ${r.status}.`)
  return body as T
}

export function remoteWorkspaceRepo({ fetcher = (...a) => fetch(...a), onSignedOut }: { fetcher?: typeof fetch; onSignedOut?: () => void } = {}): WorkspaceRepo {
  const api = <T>(query: string, init?: { method?: string; body?: unknown }) => callApi<T>(fetcher, `/api/workspaces${query}`, init, onSignedOut)
  const at = (id: string) => `?id=${encodeURIComponent(id)}`
  return {
    list: () => api<Workspace[]>(''),
    create: async (name) => (await api<{ id: string }>('', { method: 'POST', body: { name } })).id,
    rename: async (id, name) => { await api(at(id), { method: 'PUT', body: { name } }) },
    use: async (id) => { await api(at(id), { method: 'PUT', body: { used: true } }) },
    members: (id) => api(`${at(id)}&members`),
    setRole: async (id, member, role) => { await api(`${at(id)}&member=${encodeURIComponent(member)}`, { method: 'PUT', body: { role } }) },
    invite: async (id, email, role) => (await api<{ link: string }>(`${at(id)}&invite`, { method: 'POST', body: { email, role } })).link,
    revoke: async (id, token) => { await api(`${at(id)}&invite=${encodeURIComponent(token)}`, { method: 'DELETE' }) },
    accept: (token) => api(`?accept=${encodeURIComponent(token)}`, { method: 'POST' }),
  }
}

/** The dev account's one workspace: every deck and doc in this browser is in it. */
export const LOCAL_WORKSPACE = 'ws_local'
const SIGN_IN = 'Sign in to share a workspace.'

export function localWorkspaceRepo(): WorkspaceRepo {
  const no = async (): Promise<never> => { throw new Error(SIGN_IN) }
  return {
    list: async () => [{ id: LOCAL_WORKSPACE, name: 'Dev’s workspace', role: 'owner', personal: true, members: 1, usedAt: null }],
    create: async () => { throw new Error('Sign in to make another workspace.') },
    rename: no, setRole: no, invite: no, revoke: no, accept: no,
    use: async () => undefined,
    members: async () => ({ members: [{ userId: 'dev', email: '', name: 'Dev', role: 'owner', personal: true }], invites: [] }),
  }
}

/** The workspace to open: the one asked for (the URL's, or the last one picked) if the user is in it, else the most recently used. */
export const currentWorkspace = (list: Workspace[], wanted: string | null | undefined): Workspace | null =>
  list.find((w) => w.id === wanted) ?? list[0] ?? null
