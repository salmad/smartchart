/* The frame index.html paints for a repeat visit (#boot) goes when the app has something of its own on screen.
   Drop boot-app / boot-decks / boot-chat too: .boot-app body pins #0B0A09 and would keep light chrome from painting. */
export const bootDone = (): void => {
  document.getElementById('boot')?.remove()
  const html = document.documentElement
  html.classList.remove('boot-app', 'boot-decks', 'boot-chat')
}
