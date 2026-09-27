/* The app's settings in one place; the only module that reads import.meta.env. Secrets live in api/. */
export const config = {
  /** Reports whether the model keys are present on the server. */
  healthUrl: '/api/health',
  /** Deck saves wait this long after the last change. */
  saveDelayMs: 250,
  /** A failed save is tried again after this long, doubling up to the cap. */
  saveRetryMs: 2000,
  saveRetryMaxMs: 30_000,
  /** A visitor's first slide stays in view this long before the sign-in dialog asks to keep it. */
  gateDelayMs: 3000,
  dev: import.meta.env.DEV,
  /** Model traces and check ids in the editor: ?debug=1, or localStorage smartchart.debug = 1. */
  debug: (() => {
    try { return new URLSearchParams(location.search).has('debug') || localStorage.getItem('smartchart.debug') === '1' } catch { return false }
  })(),
}
