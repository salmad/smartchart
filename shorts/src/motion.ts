import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { springs, type SpringKind } from './theme'

/** 0 → 1 as an element enters, starting `at` seconds into the scene, on the spring for its class of object.
 *  Springs with overshoot pass 1 briefly; a closed-form spring stays a pure function of the frame. */
export function useEnter(at = 0, kind: SpringKind = 'ui') {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  return spring({ frame: frame - Math.round(at * fps), fps, config: springs[kind] })
}

/** Seconds since the scene started. */
export function useSeconds() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  return frame / fps
}

const fade = (p: number) => Math.min(1, Math.max(0, p))
export const rise = (p: number, px = 36) => ({ opacity: fade(p * 1.4), transform: `translateY(${interpolate(p, [0, 1], [px, 0])}px)` })

/** A panel arriving in depth: tilted back and pushed away, it swings flat as it settles. Flat once settled, so the
 *  text the narration reads is sharp. */
export const tiltIn = (p: number, deg = 24, z = 420) => ({
  opacity: fade(p * 1.6),
  transform: `translateZ(${interpolate(p, [0, 1], [-z, 0])}px) rotateX(${interpolate(p, [0, 1], [deg, 0])}deg) translateY(${interpolate(p, [0, 1], [70, 0])}px)`,
  transformOrigin: '50% 100%',
})
