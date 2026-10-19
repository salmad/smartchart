/* Edit chrome over a doc page takes the page's colours (its theme's variables), not the app's dark chrome: a menu on
   Paper is a light card. The variables come from a `theme-<name>` class on an ancestor, or on the menu itself in a portal.
   Written out whole: Tailwind finds classes by reading the source. */
export const surface = 'bg-[var(--surface)] text-[var(--fg)] shadow-[0_0_0_1px_var(--line-2),0_12px_32px_rgba(0,0,0,.14)]'
export const tint = 'bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] text-[var(--fg)]'
export const tintOnHover = 'hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--fg)]'
export const tintOnFocus = 'focus:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] focus:text-[var(--fg)] data-[selected=true]:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] data-[selected=true]:text-[var(--fg)]'
