/* Roadmap menus in the app's own dialect. The menu surface itself is the primitives' (components/ui). */

/** On a Command inside a menu: the search rule is a hairline (a bare border here falls back to the text colour), the
    highlighted item steps to panel, group headings are quiet labels. */
export const menuCommand =
  'bg-transparent [&_[cmdk-input-wrapper]]:border-line [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:transition-colors [&_[cmdk-item][data-selected=true]]:bg-panel [&_[cmdk-item][data-selected=true]]:text-ink [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:text-ink-3'
