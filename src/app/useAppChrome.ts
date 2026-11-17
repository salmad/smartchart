/* Puts the resolved app chrome on <html data-chrome>, so --app-* tokens flip. Cleared when the signed-in app unmounts. */
import { useEffect, useState } from 'react'
import { resolveChrome, type Chrome, type ResolvedChrome } from '@/engine/look'

const QUERY = '(prefers-color-scheme: dark)'

export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => typeof matchMedia === 'function' ? matchMedia(QUERY).matches : true)
  useEffect(() => {
    const m = matchMedia(QUERY)
    const on = () => setDark(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return dark
}

/** Apply `data-chrome` for the signed-in app; remove it on leave so the marketing site is not stuck. */
export function useAppChrome(chrome: Chrome): ResolvedChrome {
  const prefersDark = usePrefersDark()
  const resolved = resolveChrome(chrome, prefersDark)
  useEffect(() => {
    document.documentElement.dataset.chrome = resolved
    return () => { delete document.documentElement.dataset.chrome }
  }, [resolved])
  return resolved
}
