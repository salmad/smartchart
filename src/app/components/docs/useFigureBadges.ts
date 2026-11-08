/* The checks badge under each figure (drawn by the engine, in the read view and the editor alike): dismissed checks leave
   it, its count follows, and a message opens its check in the Checks panel. The engine's HTML knows nothing of dismissals,
   so this pass runs over the page each time it is drawn. */
import { useEffect } from 'react'

const plural = (n: number) => `${n} check${n === 1 ? '' : 's'}`

/** Hide the dismissed rows of every badge under `root`, and the badge when none is left; the summary counts what shows. */
export function quietBadges(root: ParentNode, quiet: ReadonlySet<string>) {
  for (const badge of root.querySelectorAll<HTMLDetailsElement>('details.fig-checks')) {
    let hard = 0, shown = 0
    for (const b of badge.querySelectorAll<HTMLElement>('[data-check-key]')) {
      const off = quiet.has(b.dataset.checkKey ?? ''), li = b.closest('li') ?? b
      if (li.hidden !== off) li.hidden = off
      if (off) continue
      shown++
      if (!/^S\d/.test(b.dataset.check ?? '')) hard++
    }
    if (badge.hidden !== !shown) badge.hidden = !shown
    const summary = badge.querySelector('summary'), text = hard ? plural(hard) : 'Could be better'
    if (summary && shown && summary.textContent !== text) summary.textContent = text
  }
}

export function useFigureBadges(root: HTMLElement | null, quiet: ReadonlySet<string>, onPick: (key: string) => void) {
  useEffect(() => {
    if (!root) return
    let frame = 0
    const pass = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => quietBadges(root, quiet)) }
    quietBadges(root, quiet)
    // The page is drawn again after a save, a fold or a figure edit: watch for new badges.
    const watch = new MutationObserver(pass)
    watch.observe(root, { childList: true, subtree: true })
    const click = (e: MouseEvent) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.fig-checks [data-check-key]') : null
      if (!b?.dataset.checkKey) return
      e.preventDefault(); e.stopPropagation()
      onPick(b.dataset.checkKey)
    }
    root.addEventListener('click', click)
    // The badge's messages look clickable only where this answers them (doc.css).
    root.setAttribute('data-checks-live', '')
    return () => { cancelAnimationFrame(frame); watch.disconnect(); root.removeEventListener('click', click); root.removeAttribute('data-checks-live') }
  }, [root, quiet, onPick])
}
