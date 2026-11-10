/* Roadmap chrome in the app's own dialect: the bar's quiet buttons (Bar.Toggle), the deck's view switch (Seg), and the
   Share / Download menu surface. Popover, accent and muted all resolve to raise, so a menu marks its highlighted row panel. */

/** Quiet actions in the header and filter row, on app-bg. */
export const chromeGhost = 'rounded-lg text-ink-3 transition-colors hover:bg-panel hover:text-ink'

/** The deck bar's view switch track, passed to Seg. */
export const segTrack = 'flex rounded-[9px] border border-line bg-panel p-[3px]'

/** Every roadmap popover. Callers add width and padding. */
export const menuSurface =
  'rounded-[14px] border-line-2 bg-raise shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]'

/** On a Command inside a menu: the search rule is a hairline (a bare border here falls back to the text colour), the
    highlighted item steps to panel, group headings read as section labels. */
export const menuCommand =
  'bg-transparent [&_[cmdk-input-wrapper]]:border-line [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:transition-colors [&_[cmdk-item][data-selected=true]]:bg-panel [&_[cmdk-item][data-selected=true]]:text-ink [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-3'

/** A pickable row or chip inside a menu (sort, group, matrix fields). */
export const menuRow =
  'rounded-md px-2 py-1 text-left text-[12.5px] text-ink-2 transition-colors hover:bg-panel hover:text-ink aria-pressed:bg-panel aria-pressed:font-medium aria-pressed:text-ink'
