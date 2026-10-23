import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from './auth'
import { devAccount } from './dev-account'
import { bootDone } from './boot'
import { cachedDeckRepo } from './cached-decks'
import { cachedDocRepo } from './doc-cache'
import { remoteDeckRepo } from './remote'
import { go, useRoute } from './route'
import { localDeckRepo } from './store'
import { localDocRepo, remoteDocRepo } from './docs'
import { localPageRepo, remotePageRepo } from './pages'
import { localWorkspaceRepo, remoteWorkspaceRepo } from './workspaces'

// One screen per route: the site, the editor and the shared views load only when they are shown.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })))
const Shared = lazy(() => import('./components/Shared').then((m) => ({ default: m.Shared })))
const Invite = lazy(() => import('./components/Invite').then((m) => ({ default: m.Invite })))
const SignIn = lazy(() => import('./components/SignIn').then((m) => ({ default: m.SignIn })))
const Site = lazy(() => import('./components/landing/Site').then((m) => ({ default: m.Site })))
const Present = lazy(() => import('./components/Present').then((m) => ({ default: m.Present })))
const Presenter = lazy(() => import('./components/Presenter').then((m) => ({ default: m.Presenter })))

/** Picks the screen. Signed out: the site, with sign-in open over it when the editor was asked for (a prompt typed
    on the site waits through sign-in). Signed in: the editor, at / on the deck worked on last; the site stays at
    /home, reached from Occam in the editor's bar, with Open app in place of sign-in. */
export function Root() {
  const route = useRoute()
  return <Suspense fallback={<div className={route.name === 'home' || route.name === 'site' ? 'h-full bg-paper' : 'h-full bg-app-bg'} />}><Screens /></Suspense>
}

function Screens() {
  const route = useRoute(), live = useSession(), dev = useMemo(devAccount, [])
  const session = dev ?? live
  const [signingIn, setSigningIn] = useState(false), [ended, setEnded] = useState(false)
  // Decks live in the account; a 401 from the decks API means the session ended: ask to sign in again, over
  // whatever screen is open. The dev account keeps its decks in this browser, with nothing to back them up to.
  // The workspace open in the app, where a new deck is saved; App keeps it current.
  const workspace = useRef<string | null>(null)
  // Signed in, what the repo reads and saves of a deck is kept in this browser too, for the next visit to open at once.
  const repo = useMemo(() => {
    if (dev) return localDeckRepo(undefined, { versions: true })
    const remote = remoteDeckRepo({ onSignedOut: () => setEnded(true), workspace: () => workspace.current })
    return session ? cachedDeckRepo(remote, session.id) : remote
  }, [dev, session?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const workspaces = useMemo(() => (dev ? localWorkspaceRepo() : remoteWorkspaceRepo({ onSignedOut: () => setEnded(true) })), [dev])
  const docs = useMemo(() => (dev ? cachedDocRepo(localDocRepo()) : cachedDocRepo(remoteDocRepo({ onSignedOut: () => setEnded(true) }), session?.id)), [dev, session?.id])
  const pages = useMemo(() => (dev ? localPageRepo() : remotePageRepo({ onSignedOut: () => setEnded(true) })), [dev])
  const backup = useMemo(() => (dev ? null : localDeckRepo()), [dev])
  useEffect(() => setEnded(false), [live])
  // The frame index.html painted for the editor stays until the editor has its own; any other screen replaces it at once.
  useEffect(() => { if (session === null || !['home', 'new', 'deck', 'doc'].includes(route.name)) bootDone() }, [session, route.name])
  const joined = useCallback(() => go('/', { replace: true }), [])

  // A deck shared by link is for anyone who has it: no session needed, nothing of the viewer's own is shown.
  if (route.name === 'shared') return <Shared token={route.token} />
  // The presentation and the presenter view get the deck from the tab that has it open, so they need no session either.
  if (route.name === 'present') return <Present />
  if (route.name === 'presenter') return <Presenter />
  // The first session check is quick; until it answers, a blank page beats a flash of the wrong screen.
  if (session === undefined) return <div className={route.name === 'home' || route.name === 'site' ? 'h-full bg-paper' : 'h-full bg-app-bg'} />
  if (!session) {
    const wantsEditor = route.name !== 'home' && route.name !== 'site'
    return (
      <>
        <Site onSignIn={() => setSigningIn(true)} />
        <SignIn open={signingIn || wantsEditor} returnTo={wantsEditor ? location.pathname : '/'}
          onOpenChange={(o) => { setSigningIn(o); if (!o && wantsEditor) go('/') }}
          lede={route.name === 'new' ? 'Sign in and Occam makes your slide. Your decks are saved to your account.' : undefined} />
      </>
    )
  }
  if (route.name === 'site') return <Site signedIn onSignIn={() => go('/')} />
  // An invite link: accepted as this account, then the app opens on its workspace.
  if (route.name === 'invite') return <Invite token={route.token} repo={workspaces} onJoined={joined} />
  // Keyed by account, not by deck: a new deck's URL becoming /d/:id after its first save must not restart it.
  return (
    <>
      <App key={session.id} route={route} account={session} repo={repo} backup={backup} workspaces={workspaces} docs={docs} pages={pages} onWorkspace={(id) => { workspace.current = id }} />
      <SignIn open={ended} onOpenChange={setEnded} returnTo={location.pathname} title="Sign in again"
        lede="Your session ended. Your deck is kept in this browser until you sign in and it saves to your account." />
    </>
  )
}
