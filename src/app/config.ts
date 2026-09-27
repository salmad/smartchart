/* The app's settings in one place; the only module that reads import.meta.env. Secrets live in api/. */
export const config = {
  /** Reports whether the model keys are present on the server. */
  healthUrl: '/api/health',
  /** Deck saves wait this long after the last change. */
  saveDelayMs: 250,
  dev: import.meta.env.DEV,
}
