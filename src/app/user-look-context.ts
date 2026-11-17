/* The signed-in person's slides palette, accent, and app chrome, for Appearance. They are the person's, on every
   deck and doc (and the shell), so they live with the account, not with a page. */
import { createContext, useContext } from 'react'
import type { Chrome, ResolvedChrome } from '@/engine/look'
import type { Theme } from '@/engine/types'

export interface UserLookControls {
  theme: Theme
  accent: string | null
  chrome: Chrome
  /** Dark or light after resolving System against the OS. */
  resolvedChrome: ResolvedChrome
  onTheme: (t: Theme) => void
  onAccent: (hex: string | null) => void
  onChrome: (c: Chrome) => void
}

export const UserLookContext = createContext<UserLookControls | null>(null)
export const useUserLookControls = () => useContext(UserLookContext)
