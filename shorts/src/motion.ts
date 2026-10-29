import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { spring as config } from './theme'

/** 0 → 1 as an element enters, starting `at` seconds into the scene. Fast: short-form cuts, not slide fades. */
export function useEnter(at = 0, frames = 9) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  return spring({ frame: frame - Math.round(at * fps), fps, config, durationInFrames: frames })
}

/** Seconds since the scene started. */
export function useSeconds() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  return frame / fps
}

export const rise = (p: number, px = 36) => ({ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [px, 0])}px)` })
