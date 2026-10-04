import { useEffect, useMemo, useState } from 'react'
import { App } from './App'
import { useSession } from './auth'
import { Shared } from './components/Shared'
import { SignIn } from './components/SignIn'
import { Site } from './components/landing/Site'
import { devAccount } from './dev-account'
import { remoteDeckRepo } from './remote'
import { go, useRoute } from './route'
import { Presenter } from './components/Presenter'
import { localDeckRepo } from './store'

/** Picks the screen. Signed out: the site, with sign-in open over it when the editor was asked for (a prompt typed
    on the site waits through sign-in). Signed in: the editor, at / on the deck worked on last; the site stays at
    /home, reached from Occam in the editor's bar, with Open app in place of sign-in. */
export function Root() {
  const route = useRoute(), live = useSession(), dev = useMemo(devAccount, [])
  const session = dev ?? live
  const [signingIn, setSigningIn] = useState(false), [ended, setEnded] = useState(false)
  // Decks live in the account; a 401 from the decks API means the session ended: ask to sign in again, over
  // whatever screen is open. The dev account keeps its decks in this browser, with nothing to back them up to.
  const repo = useMemo(() => (dev ? localDeckRepo() : remoteDeckRepo({ onSignedOut: () => setEnded(true) })), [dev])
  const backup = useMemo(() => (dev ? null : localDeckRepo()), [dev])
  useEffect(() => setEnded(false), [live])

  // A deck shared by link is for anyone who has it: no session needed, nothing of the viewer's own is shown.
  if (route.name === 'shared') return <Shared token={route.token} />
  // The presenter view gets the deck from the presenting window, so it needs no session either.
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
  // Keyed by account, not by deck: a new deck's URL becoming /d/:id after its first save must not restart it.
  return (
    <>
      <App key={session.id} route={route} account={session} repo={repo} backup={backup} />
      <SignIn open={ended} onOpenChange={setEnded} returnTo={location.pathname} title="Sign in again"
        lede="Your session ended. Your deck is kept in this browser until you sign in and it saves to your account." />
    </>
  )
}
