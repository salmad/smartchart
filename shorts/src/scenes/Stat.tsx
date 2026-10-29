import { interpolate } from 'remotion'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

/** "73%", "$1.2M", "3x": counts up the number, keeps the prefix and suffix. */
function countUp(value: string, p: number) {
  const m = /^(\D*?)(\d[\d,]*\.?\d*)(.*)$/.exec(value)
  if (!m) return value
  const [, pre, num, post] = m
  const n = Number(num.replace(/,/g, '')), dec = num.includes('.') ? num.split('.')[1].length : 0
  const v = (n * p).toFixed(dec)
  return pre + (num.includes(',') ? Number(v).toLocaleString('en-US', { minimumFractionDigits: dec }) : v) + post
}

export const Stat = ({ value, label, source }: { value: string; label: string; source?: string }) => {
  const s = useSeconds(), p = useEnter(0), q = useEnter(0.35)
  const t = interpolate(s, [0, 0.9], [0, 1], { extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) })
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: F.display, fontStretch: '78%', fontWeight: 600, fontSize: value.length > 6 ? 230 : 300, lineHeight: 0.95, color: C.gold, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', ...rise(p, 50) }}>
        {countUp(value, t)}
      </div>
      <div style={{ marginTop: 40, fontFamily: F.text, fontWeight: 500, fontSize: 54, lineHeight: 1.2, color: C.fg, textWrap: 'balance', ...rise(q) }}>
        <Rich text={label} />
      </div>
      {source && <div style={{ marginTop: 36, fontFamily: F.mono, fontSize: 24, color: C.muted, opacity: q }}>{source}</div>}
    </div>
  )
}
