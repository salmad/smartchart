/* The signed-in person's palette and accent, for the controls that change them (the avatar menu's Appearance). They are
   the person's, on every deck and doc, so they live with the account, not with a page. */
import { createContext, useContext } from 'react'
import type { Theme } from '@/engine/types'

export interface UserLookControls { theme: Theme; accent: string | null; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void }

export const UserLookContext = createContext<UserLookControls | null>(null)
export const useUserLookControls = () => useContext(UserLookContext)
