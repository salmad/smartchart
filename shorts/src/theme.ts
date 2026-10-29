// The Occam ink look, from the landing film and components.css (.theme-ink).
export const C = {
  bg: '#0B0A09',
  surface: '#13110F',
  line: '#2A2621',
  fg: '#F3EEE4',
  fg2: '#CFC8BB',
  muted: '#A39B8E',
  gold: '#E8B94A',
  neg: '#FF5A45',
  pos: '#7BD88F',
}

export const F = {
  display: 'Archivo, sans-serif',
  text: 'Geist, system-ui, sans-serif',
  mono: '"Geist Mono", monospace',
  serif: '"Instrument Serif", serif',
}

/** 1080×1920. Platform chrome covers the top ~180px and the bottom ~420px (and the right edge near the bottom). */
export const W = 1080, H = 1920, FPS = 30
export const SAFE = { x: 84, top: 300, bottom: 1290, captions: 1340 }

export const spring = { damping: 200, stiffness: 180, mass: 0.6 }
