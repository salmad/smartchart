import { App } from './App'
import { Site } from './components/landing/Site'
import { useRoute } from './route'

/** Picks the screen from the path: the site at /, the editor at /new and /d/:id. */
export function Root() {
  const route = useRoute()
  if (route.name === 'home') return <Site onSignIn={() => { /* sign-in arrives with accounts (plan task 4) */ }} />
  // Not keyed by deck: a new deck's URL becomes /d/:id after its first save, mid-session.
  return <App route={route} />
}
