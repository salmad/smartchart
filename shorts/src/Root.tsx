import { Composition, type CalculateMetadataFunction } from 'remotion'
import { loadFonts } from './fonts'
import { Short } from './Short'
import { FPS, H, W } from './theme'
import type { ShortProps } from './types'

loadFonts()

const TAIL = 0.5

const metadata: CalculateMetadataFunction<ShortProps> = ({ props }) => {
  const end = Math.max(1, ...props.scenes.map((s) => s.from + s.dur))
  return { durationInFrames: Math.ceil((end + TAIL) * FPS) }
}

export const Root = () => (
  <Composition id="Short" component={Short} width={W} height={H} fps={FPS} durationInFrames={FPS * 30}
    defaultProps={{ scenes: [], base: 'episodes', pinned: undefined, music: undefined } as ShortProps} calculateMetadata={metadata} />
)
