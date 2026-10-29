import { Audio } from '@remotion/media'
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Captions } from './Captions'
import { cueTimes } from './cues'
import { useEnter } from './motion'
import { plain } from './Rich'
import { Compare } from './scenes/Compare'
import { List, Recap } from './scenes/Lists'
import { Deck } from './scenes/Deck'
import { Shot } from './scenes/Shot'
import { Slide } from './scenes/Slide'
import { Stat } from './scenes/Stat'
import { Hook, Statement } from './scenes/Text'
import { Prompt, Terminal } from './scenes/Typing'
import { C, F, SAFE } from './theme'
import type { Placed, ShortProps } from './types'

const Body = ({ scene, base }: { scene: Placed; base: string }) => {
  switch (scene.type) {
    case 'hook': return <Hook text={scene.text} kicker={scene.kicker} dur={scene.dur} />
    case 'statement': return <Statement text={scene.text} />
    case 'list': return <List title={scene.title} items={scene.items} cues={cueTimes(scene, scene.items)} />
    case 'recap': return <Recap title={scene.title} items={scene.items} loop={scene.loop} cues={cueTimes(scene, scene.items)} dur={scene.dur} />
    case 'stat': return <Stat value={scene.value} label={scene.label} source={scene.source} />
    case 'terminal': return <Terminal title={scene.title} steps={scene.steps} cues={cueTimes(scene, scene.steps.map((s) => s.cmd ?? s.out ?? ''))} />
    case 'prompt': return <Prompt text={scene.text} reply={scene.reply} cues={scene.cues ? cueTimes(scene, [scene.text, scene.reply ?? '']) : []} />
    case 'shot': return <Shot src={scene.src} base={base} focus={scene.focus} zoom={scene.zoom} caption={scene.caption} cues={cueTimes(scene, [scene.caption ?? ''])} />
    case 'compare': return <Compare before={scene.before} after={scene.after} cues={cueTimes(scene, [scene.before.text, scene.after.text])} />
    case 'slide': return <Slide title={scene.title} retitle={scene.retitle} bars={scene.bars} focus={scene.focus} unit={scene.unit} label={scene.label}
      before={scene.before} checks={scene.checks}
      cues={cueTimes(scene, [...(scene.retitle ? [scene.retitle] : scene.before ? [scene.focus ?? ''] : []), ...(scene.checks ?? []).map((c) => c.text)])} />
    case 'deck': return <Deck titles={scene.titles} reorder={scene.reorder} cues={cueTimes(scene, scene.reorder ? [scene.titles[scene.reorder[0]]] : scene.titles)} />
  }
}

/** Every scene drifts in slowly so no frame is ever still. */
const Stage = ({ scene, base }: { scene: Placed; base: string }) => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  const push = interpolate(frame, [0, scene.dur * fps], [1, 1.025])
  return (
    <div style={{ position: 'absolute', left: SAFE.x, right: SAFE.x, top: SAFE.top, height: SAFE.bottom - SAFE.top, display: 'flex', flexDirection: 'column', justifyContent: 'center', transform: `scale(${push})` }}>
      <Body scene={scene} base={base} />
    </div>
  )
}

const Pinned = ({ text }: { text: string }) => {
  const p = useEnter(0, 8)
  return (
    <div style={{ position: 'absolute', left: SAFE.x, right: SAFE.x, top: 196, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, opacity: p }}>
      <div style={{ fontFamily: F.display, fontStretch: '78%', fontWeight: 560, fontSize: 46, lineHeight: 1.08, color: C.fg2, textAlign: 'center', textWrap: 'balance' }}>{plain(text)}</div>
      <div style={{ width: 96, height: 4, borderRadius: 2, background: C.gold }} />
    </div>
  )
}

const captioned = (s: Placed) => s.captions ?? !(s.type === 'hook' || s.type === 'statement')

export const Short = ({ scenes, voice, pinned, music, base }: ShortProps) => {
  const { fps, durationInFrames } = useVideoConfig()
  const f = (sec: number) => Math.round(sec * fps)
  const hook = scenes[0]?.type === 'hook' ? scenes[0] : undefined
  const words = scenes.filter(captioned).flatMap((s) => s.words)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1100px 1500px at 50% 42%, #1A1714 0%, ${C.bg} 64%, #060505 100%)` }}>
      {scenes.map((s, i) => (
        <Sequence key={i} from={f(s.from)} durationInFrames={Math.max(1, f(s.from + s.dur) - f(s.from))} name={`${i} ${s.type}`}>
          <Stage scene={s} base={base} />
        </Sequence>
      ))}
      {voice && <Audio src={staticFile(`${base}/${voice}`)} />}
      {pinned && hook && (
        <Sequence from={f(hook.from + hook.dur)} name="pinned hook">
          <Pinned text={pinned} />
        </Sequence>
      )}
      <Captions words={words} />
      {music && <Audio src={staticFile(`${base}/${music.src}`)} volume={music.volume} loop trimAfter={durationInFrames} />}
    </AbsoluteFill>
  )
}
