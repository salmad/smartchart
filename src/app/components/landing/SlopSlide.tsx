/* The first problem card: a doc pasted into a slide tool, the way a chatbot or a stock template lays it out.
   A topic title, a wall of bullets, a stock picture and text running off the bottom. The same facts as the
   chart-notes starter in the hero. Generic on purpose: no product's theme is copied or named.
   SVG text is fine here (never CSS-scaled). */

const FONT = 'Arial, Helvetica, sans-serif'
const BULLETS: string[][] = [
  ['Interest income has grown significantly over the five-year period, from £0.4m in', 'Year 1 to £80m in Year 5, driven by strong customer acquisition and balances'],
  ['Interchange revenue is also a key growth driver, increasing from £0.3m to £85m', 'as spend per customer grows 3x as the card replaces personal cards over time'],
  ['Gross margin improves from 12% to 24% to 31% to 36% to 38% across Years 1–5,', 'reflecting a range of factors including funding costs, rewards and bad debt'],
  ['Revolvers make up 40–60% of customers and carry margin while spend ramps up,', 'which is important for the overall profitability of the business going forward'],
  ['Bad debt stabilises near 10% of revolver balances from Year 4 onwards, which', 'together with the above leads to a significantly improved margin profile and'],
]

export function SlopSlide({ className }: { className?: string }) {
  let y = 290
  return (
    <svg viewBox="0 0 1920 1080" className={className} role="img" aria-label="A doc pasted into a slide: a topic title, a wall of bullets, a stock picture and text running off the page">
      <rect width="1920" height="1080" fill="#FFFFFF" />
      <rect width="1920" height="36" fill="#2F5597" />
      <text x="110" y="170" fontFamily={FONT} fontSize="72" fontWeight="700" fill="#1F3864">Revenue Overview and Key Highlights</text>
      <rect x="110" y="205" width="1700" height="4" fill="#2F5597" />
      <g fontFamily={FONT} fontSize="37" fill="#333">
        {BULLETS.map((lines, i) => {
          const top = y
          y += lines.length * 52 + 26
          return (
            <g key={i}>
              <circle cx="128" cy={top - 12} r="8" fill="#2F5597" />
              {lines.map((l, k) => <text key={k} x="160" y={top + k * 52}>{l}</text>)}
            </g>
          )
        })}
        <circle cx="128" cy={y - 12} r="8" fill="#2F5597" />
        <text x="160" y={y}>Key risks include funding costs, competition from incumbent banks and the</text>
        <text x="160" y={y + 52}>macroeconomic environment, which could impact customer spend and growth</text>
        <circle cx="128" cy={y + 130} r="8" fill="#2F5597" />
        <text x="160" y={y + 142}>Next steps: finalise the funding strategy, confirm the warehouse facility and</text>
        <text x="160" y={y + 194}>align with the board on the timeline for EU entry and further product launches</text>
      </g>
      <g transform="translate(1440 700)">
        <rect width="380" height="250" rx="6" fill="#DDE6F2" />
        <path d="M30 220 140 100l70 80 50-50 90 90z" fill="#9FB6D6" />
        <circle cx="300" cy="70" r="30" fill="#F2C94C" />
      </g>
      <text x="1810" y="1060" textAnchor="end" fontFamily={FONT} fontSize="24" fill="#999">Confidential · Page 3</text>
    </svg>
  )
}
