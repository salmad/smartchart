/* The slide being edited, as the edit tools reach it. Every remount replaces the slide element (a structural edit, and
   StrictMode mounting twice), so an element kept from an earlier render can be one no longer on the page: a listener on
   it hears nothing, and boxes read from it are empty. `mount`, the element the slide renders into, stays for the whole
   edit: listen there, and read `slide` when it is needed. A new surface comes with each remount, so readers re-render. */
export interface Surface { readonly mount: HTMLElement; readonly slide: HTMLElement | null }

export const surfaceOf = (mount: HTMLElement): Surface => ({
  mount,
  get slide() { const s = mount.firstElementChild; return s instanceof HTMLElement ? s : null },
})
