/* The "before": the chart-notes starter's numbers drawn the way a slide tool draws them by default.
   Stock colours, a legend to decode, a shaded and boxed plot, major and minor gridlines, a second axis on its own
   scale, a label on every mark with a decimal it doesn't need, a topic title. Each is a default or one click away.
   Generic on purpose: no product's theme is copied or named. SVG text is fine here (never CSS-scaled). */

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']
const INTEREST = [0.4, 3.1, 14, 36, 80], INTERCHANGE = [0.3, 2.2, 11, 42, 85], MARGIN = [12, 24, 31, 36, 38]
const BLUE = '#3366CC', RED = '#DC3912', ORANGE = '#FF9900'
const FONT = 'Arial, Helvetica, sans-serif'

// Plot box in a 1920×1080 frame, so it lines up with the slide it is compared with.
const L = 190, R = 1730, T = 250, B = 900
const y = (v: number) => B - (v / 100) * (B - T)
const y2 = (v: number) => B - (v / 45) * (B - T)
const band = (R - L) / YEARS.length, bw = 88

export function DefaultChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1920 1080" className={className} strokeDasharray="none" role="img" aria-label="A chart in a slide tool's default style: stock colours, a legend, a boxed plot, gridlines and a label on every bar">
      <rect width="1920" height="1080" fill="#FFFFFF" />
      <text x="960" y="110" textAnchor="middle" fontFamily={FONT} fontSize="54" fill="#222">Revenue and Margin by Year</text>
      <g fontFamily={FONT} fontSize="30" fill="#444">
        {[[BLUE, 'Interest income', 560], [RED, 'Interchange', 900], [ORANGE, 'Gross margin %', 1180]].map(([c, t, x]) => (
          <g key={t as string}><rect x={Number(x)} y={160} width="30" height="30" fill={c as string} /><text x={Number(x) + 42} y={186}>{t}</text></g>
        ))}
      </g>
      <rect x="12" y="12" width="1896" height="1056" fill="none" stroke="#BFBFBF" strokeWidth="3" />
      <rect x={L} y={T} width={R - L} height={B - T} fill="#EFEFEF" stroke="#8C8C8C" strokeWidth="3" />
      {[10, 30, 50, 70, 90].map((v) => <line key={v} x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#DADADA" strokeWidth="2" strokeDasharray="8 6" />)}
      {[0, 20, 40, 60, 80, 100].map((v, i) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#B3B3B3" strokeWidth="2" />
          <text x={L - 20} y={y(v) + 10} textAnchor="end" fontFamily={FONT} fontSize="28" fill="#666">{v.toFixed(1)}</text>
          <text x={R + 20} y={y(v) + 10} fontFamily={FONT} fontSize="28" fill="#666">{(i * 9).toFixed(1)}%</text>
        </g>
      ))}
      {YEARS.map((yr, i) => {
        const cx = L + band * i + band / 2
        return (
          <g key={yr} fontFamily={FONT} fontSize="26" fill="#333">
            <rect x={cx - bw - 4} y={y(INTEREST[i])} width={bw} height={B - y(INTEREST[i])} fill={BLUE} stroke="#1F3F80" strokeWidth="3" />
            <rect x={cx + 4} y={y(INTERCHANGE[i])} width={bw} height={B - y(INTERCHANGE[i])} fill={RED} stroke="#8A2308" strokeWidth="3" />
            <text x={cx - bw / 2 - 4} y={y(INTEREST[i]) - 12} textAnchor="middle">{INTEREST[i].toFixed(1)}</text>
            <text x={cx + bw / 2 + 4} y={y(INTERCHANGE[i]) - 12} textAnchor="middle">{INTERCHANGE[i].toFixed(1)}</text>
            <text x={cx} y={B + 50} textAnchor="middle" fontSize="30" fill="#666">{yr}</text>
          </g>
        )
      })}
      <polyline fill="none" stroke={ORANGE} strokeWidth="6"
        points={MARGIN.map((v, i) => `${L + band * i + band / 2},${y2(v)}`).join(' ')} />
      {MARGIN.map((v, i) => (
        <g key={i}>
          <circle cx={L + band * i + band / 2} cy={y2(v)} r="11" fill={ORANGE} stroke="#FFF" strokeWidth="3" />
          <text x={L + band * i + band / 2 + 18} y={y2(v) - 18} fontFamily={FONT} fontSize="26" fill="#333">{v.toFixed(1)}%</text>
        </g>
      ))}
      <line x1={L} x2={R} y1={B} y2={B} stroke="#888" strokeWidth="2" />
      <text x="70" y={(T + B) / 2} fontFamily={FONT} fontSize="28" fill="#666" transform={`rotate(-90 70 ${(T + B) / 2})`} textAnchor="middle">£m</text>
      <text x="1860" y={(T + B) / 2} fontFamily={FONT} fontSize="28" fill="#666" transform={`rotate(90 1860 ${(T + B) / 2})`} textAnchor="middle">Margin (%)</text>
    </svg>
  )
}
