import { useMemo, useState } from 'react'
import { App } from './App'
import { useSession } from './auth'
import { Home } from './components/Home'
import { SignIn } from './components/SignIn'
import { Site } from './components/landing/Site'
import { remoteDeckRepo } from './remote'
import { useRoute } from './route'
import { localDeckRepo } from './store'

/** Picks the screen: at /, the site (signed out) or your decks (signed in); the editor at /new and /d/:id. */
export function Root() {
  const route = useRoute(), session = useSession()
  const [signingIn, setSigningIn] = useState(false)
  // Signed in, decks live in the account; a visitor's deck lives in this browser until they sign in.
  const repo = useMemo(() => (session ? remoteDeckRepo() : localDeckRepo()), [session])

  // The first session check is quick; until it answers, a blank page beats a flash of the wrong screen.
  if (session === undefined) return <div className={route.name === 'home' ? 'h-full bg-paper' : 'h-full bg-app-bg'} />
  if (route.name === 'home') {
    if (session) return <Home account={session} repo={repo} />
    return (
      <>
        <Site onSignIn={() => setSigningIn(true)} />
        <SignIn open={signingIn} onOpenChange={setSigningIn} returnTo="/" />
      </>
    )
  }
  // Keyed by account, not by deck: signing in mid-deck restarts the editor on the account's repo, which picks the
  // deck up; a new deck's URL becoming /d/:id after its first save must not restart it.
  return <App key={session?.id ?? 'visitor'} route={route} account={session} repo={repo} />
}
