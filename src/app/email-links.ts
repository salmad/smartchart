/* Links from Occam's emails open one thing in the app: ?connect=1 opens Connect an agent, ?new=doc opens New doc.
   Read once on mount, then dropped from the address so a reload doesn't open it again. */
export const linkParam = (name: string): string | null => new URLSearchParams(location.search).get(name)

export function dropLinkParam(name: string) {
  const url = new URL(location.href)
  if (!url.searchParams.has(name)) return
  url.searchParams.delete(name)
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
}
