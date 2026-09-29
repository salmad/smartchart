/* The problem, shown: what the standard tools give you by default, what fixing it by hand looks like.
   Generic on purpose: the look is recognisable, but no product's theme, logo or name is copied.
   SVG text is fine here (the SVGs scale by viewBox, never inside a CSS-scaled slide frame). */

const FONT = 'Arial, Helvetica, sans-serif'

/** A spreadsheet's default column chart: four stock colours, a legend to decode, gridlines, a label on every bar. */
export function DefaultColumns({ className }: { className?: string }) {
  const years = ['2021', '2022', '2023', '2024', '2025']
  const series: [string, string, number[]][] = [
    ['Interest', '#4285F4', [4, 31, 140, 360, 800]],
    ['Interchange', '#EA4335', [3, 22, 110, 420, 850]],
    ['Fees', '#FBBC04', [12, 40, 95, 180, 260]],
    ['Other', '#34A853', [8, 15, 30, 55, 90]],
  ]
  const L = 170, R = 1500, T = 190, B = 900, max = 1000
  const y = (v: number) => B - (v / max) * (B - T)
  const band = (R - L) / years.length, bw = 48
  return (
    <svg viewBox="0 0 1920 1080" className={className} role="img" aria-label="A spreadsheet's default chart: four stock colours, a legend, gridlines and a label on every bar">
      <rect width="1920" height="1080" fill="#FFFFFF" />
      <text x="90" y="110" fontFamily={FONT} fontSize="52" fill="#757575">Revenue vs. Year</text>
      {[0, 250, 500, 750, 1000].map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#CCCCCC" strokeWidth="2" />
          <text x={L - 22} y={y(v) + 12} textAnchor="end" fontFamily={FONT} fontSize="32" fill="#444">{v}</text>
        </g>
      ))}
      {years.map((yr, i) => (
        <g key={yr}>
          {series.map(([name, c, vals], k) => {
            const x = L + band * i + (band - bw * 4 - 18) / 2 + k * (bw + 6)
            return (
              <g key={name}>
                <rect x={x} y={y(vals[i])} width={bw} height={B - y(vals[i])} fill={c} />
                <text x={x + bw / 2} y={y(vals[i]) - 12} textAnchor="middle" fontFamily={FONT} fontSize="24" fill="#444">{vals[i].toFixed(1)}</text>
              </g>
            )
          })}
          <text x={L + band * i + band / 2} y={B + 52} textAnchor="middle" fontFamily={FONT} fontSize="32" fill="#444">{yr}</text>
        </g>
      ))}
      <g fontFamily={FONT} fontSize="34" fill="#222">
        {series.map(([name, c], k) => (
          <g key={name}><circle cx="1600" cy={400 + k * 70} r="16" fill={c} /><text x="1632" y={412 + k * 70}>{name}</text></g>
        ))}
      </g>
    </svg>
  )
}

/** A slide mid-edit: a selected box, a second box a few pixels off, the guides that show it, the cursor still at it. */
export function Nudging({ className }: { className?: string }) {
  const handles = [[300, 180], [890, 180], [1480, 180], [300, 300], [1480, 300], [300, 420], [890, 420], [1480, 420]]
  return (
    <svg viewBox="0 0 1920 1080" className={className} role="img" aria-label="A slide being edited: a selected text box, another box slightly out of line, and alignment guides">
      <rect width="1920" height="1080" fill="#E8EAED" />
      <rect x="160" y="80" width="1600" height="900" fill="#FFFFFF" />
      <text x="330" y="325" fontFamily={FONT} fontSize="92" fontWeight="700" fill="#202124">Q3 Results</text>
      <rect x="300" y="180" width="1180" height="240" fill="none" stroke="#1A73E8" strokeWidth="4" />
      {handles.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 14} y={y - 14} width="28" height="28" fill="#FFFFFF" stroke="#1A73E8" strokeWidth="4" />)}
      <rect x="300" y="520" width="560" height="340" fill="#D2E3FC" />
      <rect x="918" y="534" width="560" height="340" fill="#FCE8E6" />
      <line x1="200" x2="1720" y1="520" y2="520" stroke="#EA4335" strokeWidth="4" strokeDasharray="14 10" />
      <line x1="200" x2="1720" y1="534" y2="534" stroke="#EA4335" strokeWidth="4" strokeDasharray="14 10" />
      <rect x="1500" y="470" width="190" height="56" rx="8" fill="#202124" />
      <text x="1595" y="508" textAnchor="middle" fontFamily={FONT} fontSize="30" fill="#FFFFFF">0.14 in</text>
      <path d="M1240 690l0 110 28-28 22 50 22-10-22-48 40 0z" fill="#202124" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}
