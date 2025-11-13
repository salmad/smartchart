import React, { useMemo, useEffect, useState } from 'react'

type ArrowStyle = 'flowing-s' | 'curved-arc' | 'angular-bracket'

interface ConnectingArrowsProps {
  data: Array<Record<string, any>>
  seriesName: string
  seriesColor: string
  fromQuarter: string
  toQuarter: string
  chartWidth: number
  chartHeight: number
  style: ArrowStyle
  xAxisKey: string
  containerRef?: React.RefObject<HTMLDivElement>
}

export function ConnectingArrows({
  data,
  seriesName,
  seriesColor,
  fromQuarter,
  toQuarter,
  chartWidth,
  chartHeight,
  style,
  xAxisKey,
  containerRef,
}: ConnectingArrowsProps) {
  const MARGIN = { top: 20, right: 30, left: 20, bottom: 5 }
  const CHART_WIDTH = chartWidth - MARGIN.left - MARGIN.right
  const CHART_HEIGHT = chartHeight - MARGIN.top - MARGIN.bottom

  const arrowData = useMemo(() => {
    // Find Q1 and Q4 data points
    const fromData = data.find((d) => d[xAxisKey] === fromQuarter)
    const toData = data.find((d) => d[xAxisKey] === toQuarter)

    if (!fromData || !toData) return null

    const fromValue = fromData[seriesName]
    const toValue = toData[seriesName]

    // Calculate max value for scaling
    const maxValue = Math.max(
      ...data.flatMap((d) => Object.values(d).filter((v) => typeof v === 'number') as number[])
    )

    // Find indices for positioning
    const fromIndex = data.findIndex((d) => d[xAxisKey] === fromQuarter)
    const toIndex = data.findIndex((d) => d[xAxisKey] === toQuarter)

    // Calculate bar dimensions and positions
    const barWidth = CHART_WIDTH / data.length

  // Center X positions for each bar's center (fallback math)
  const fromX = MARGIN.left + fromIndex * barWidth + barWidth / 2
  const toX = MARGIN.left + toIndex * barWidth + barWidth / 2

    // Y positions: Top of the bar (where value reaches)
    // SVG y-axis is inverted: 0 at top, increases downward
    const chartBottomY = MARGIN.top + CHART_HEIGHT
    const fromY = chartBottomY - (fromValue / maxValue) * CHART_HEIGHT
    const toY = chartBottomY - (toValue / maxValue) * CHART_HEIGHT

    // Calculate differences
    const absoluteDifference = toValue - fromValue
    const percentageDifference = ((toValue - fromValue) / fromValue) * 100
    const isPositive = absoluteDifference >= 0

    return {
      fromX,
      fromY,
      toX,
      toY,
      fromValue,
      toValue,
      absoluteDifference,
      percentageDifference,
      isPositive,
      maxValue,
    }
  }, [data, seriesName, fromQuarter, toQuarter, xAxisKey])

  // If consumer provided a containerRef and we can find actual bar rects in the DOM,
  // prefer those positions (more accurate than our fallback math calculation).
  const [domPositions, setDomPositions] = useState<{
    fromX: number
    fromY: number
    toX: number
    toY: number
  } | null>(null)

  useEffect(() => {
    if (!containerRef || !containerRef.current) return
    const root = containerRef.current

    let mounted = true

    const measurePositions = () => {
      if (!mounted) return
      const svg = root.querySelector('svg')
      if (!svg) return false

      // Query any element with our data attributes (not assuming tag name)
      const selFrom = `[data-quarter="${fromQuarter}"][data-series="${seriesName}"]`
      const selTo = `[data-quarter="${toQuarter}"][data-series="${seriesName}"]`

      const fromEl = svg.querySelector(selFrom) as Element | null
      const toEl = svg.querySelector(selTo) as Element | null

      if (fromEl && toEl) {
        const containerRect = root.getBoundingClientRect()
        const fr = (fromEl as Element).getBoundingClientRect()
        const tr = (toEl as Element).getBoundingClientRect()

        setDomPositions({
          fromX: fr.left - containerRect.left + fr.width / 2,
          fromY: fr.top - containerRect.top,
          toX: tr.left - containerRect.left + tr.width / 2,
          toY: tr.top - containerRect.top,
        })
        return true
      }

      setDomPositions(null)
      return false
    }

    // Try measure immediately and with a few retries in case Recharts renders slightly later
    if (!measurePositions()) {
      let attempts = 0
      const maxAttempts = 5
      const interval = setInterval(() => {
        attempts += 1
        if (measurePositions() || attempts >= maxAttempts) {
          clearInterval(interval)
        }
      }, 120)

      // Also observe mutations within the root to pick up when bars are added/removed
      const mo = new MutationObserver(() => {
        measurePositions()
      })
      mo.observe(root, { childList: true, subtree: true })

      const ro = new ResizeObserver(() => {
        measurePositions()
      })
      ro.observe(root)

      return () => {
        mounted = false
        clearInterval(interval)
        mo.disconnect()
        ro.disconnect()
      }
    }

    // If measured immediately, still attach observers to update on resize/mutation
    const mo = new MutationObserver(() => {
      measurePositions()
    })
    mo.observe(root, { childList: true, subtree: true })

    const ro = new ResizeObserver(() => {
      measurePositions()
    })
    ro.observe(root)

    return () => {
      mounted = false
      mo.disconnect()
      ro.disconnect()
    }
  }, [containerRef, data, seriesName, fromQuarter, toQuarter])

  if (!arrowData) return null

  let {
    fromX,
    fromY,
    toX,
    toY,
    absoluteDifference,
    percentageDifference,
    isPositive,
  } = arrowData as any

  // Prefer DOM-measured positions when available (more accurate)
  if (domPositions) {
    fromX = domPositions.fromX
    fromY = domPositions.fromY
    toX = domPositions.toX
    toY = domPositions.toY
  }

  const arrowColor = seriesColor
  const labelColor = isPositive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)' // Green for positive, red for negative

  const renderFlowingS = () => {
    // Think-cell style: line from source bar top-center to a label box, then arrow from the box to the target bar top-center.
    const midX = (fromX + toX) / 2
    const labelX = midX
    const labelY = Math.min(fromY, toY) - 48 // place label above the higher of the two bars

    // Points for the two line segments
    const p1 = { x: fromX, y: fromY }
    const labelPoint = { x: labelX, y: labelY }
    const p2 = { x: toX, y: toY }

    return (
      <g>
        <defs>
          <linearGradient id="arrowGradientS" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={arrowColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={arrowColor} stopOpacity="1" />
          </linearGradient>
          <marker
            id="arrowheadS"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={arrowColor} opacity="0.95" />
          </marker>
        </defs>

        {/* Line from source bar to label box */}
        <line
          x1={p1.x}
          y1={p1.y}
          x2={labelPoint.x}
          y2={labelPoint.y}
          stroke="url(#arrowGradientS)"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.9}
        />

        {/* Line from label box to target bar with arrowhead */}
        <line
          x1={labelPoint.x}
          y1={labelPoint.y}
          x2={p2.x}
          y2={p2.y}
          stroke="url(#arrowGradientS)"
          strokeWidth={2.5}
          strokeLinecap="round"
          markerEnd="url(#arrowheadS)"
          opacity={0.95}
        />

        {/* Glass morphic label placed at labelPoint */}
        <g transform={`translate(${labelPoint.x}, ${labelPoint.y})`}>
          <g transform="translate(-60, -28)">
            <rect
              width={120}
              height={56}
              rx={8}
              fill="rgba(255,255,255,0.95)"
              stroke="rgba(0,0,0,0.04)"
            />
            <text x={60} y={18} textAnchor="middle" className="font-bold" fill={labelColor} fontSize={13}>
              {percentageDifference > 0 ? '+' : ''}{percentageDifference.toFixed(1)}%
            </text>
            <text x={60} y={36} textAnchor="middle" className="text-xs" fill="#64748b" fontSize={11}>
              {absoluteDifference > 0 ? '+' : ''}{absoluteDifference.toFixed(0)}
            </text>
          </g>

          {/* small connector from bottom of label box toward the target line (visual attachment) */}
          <line x1={0} y1={28} x2={0} y2={44} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
        </g>
      </g>
    )
  }

  const renderCurvedArc = () => {
    // Think-cell style smooth arc above bars
    const arcOffset = 60
    const midX = (fromX + toX) / 2

    // Quadratic bezier for smooth arc
    const pathD = `M ${fromX} ${fromY} Q ${midX} ${Math.min(fromY, toY) - arcOffset} ${toX} ${toY}`

    return (
      <g>
        <defs>
          <linearGradient id="arrowGradientArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={arrowColor} stopOpacity="0.6" />
            <stop offset="50%" stopColor={arrowColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={arrowColor} stopOpacity="0.6" />
          </linearGradient>
          <marker
            id="arrowheadArc"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={arrowColor} opacity="0.85" />
          </marker>
        </defs>

        {/* Glow effect background */}
        <path
          d={pathD}
          stroke={arrowColor}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          opacity="0.15"
          className="blur-sm"
        />

        {/* Main arrow */}
        <path
          d={pathD}
          stroke="url(#arrowGradientArc)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#arrowheadArc)"
          className="transition-all duration-300 hover:stroke-width-3"
        />

        {/* Label positioned above the arc */}
        <g filter="drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))">
          <rect
            x={midX - 48}
            y={Math.min(fromY, toY) - arcOffset - 35}
            width="96"
            height="48"
            rx="6"
            fill="rgba(255, 255, 255, 0.9)"
            stroke={arrowColor}
            strokeWidth="1"
            strokeOpacity="0.3"
          />

          <text
            x={midX}
            y={Math.min(fromY, toY) - arcOffset - 18}
            textAnchor="middle"
            className="font-bold"
            fill={labelColor}
            fontSize="12"
          >
            {percentageDifference > 0 ? '+' : ''}{percentageDifference.toFixed(1)}%
          </text>

          <text
            x={midX}
            y={Math.min(fromY, toY) - arcOffset - 5}
            textAnchor="middle"
            className="font-medium text-xs"
            fill="#94a3b8"
            fontSize="10"
          >
            ({absoluteDifference > 0 ? '+' : ''}{absoluteDifference.toFixed(0)})
          </text>
        </g>
      </g>
    )
  }

  const renderAngularBracket = () => {
    // Rectangular 90-degree bracket: vertical up from source to a label box (centered at the vertical),
    // horizontal connector to above the target, then vertical down to the target with arrowhead.
    const offsetAboveBar = 48 // distance from bar top to label center
    const boxW = 110
    const boxH = 48

    const midX = (fromX + toX) / 2
    const boxCenterY = Math.min(fromY, toY) - offsetAboveBar
    const boxX = midX - boxW / 2
    const boxY = boxCenterY - boxH / 2

    // Ensure boxY is not above too far (keep within a reasonable visual area)
    const minBoxY = -20
    const finalBoxY = boxY < minBoxY ? minBoxY : boxY

    return (
      <g>
        <defs>
          <linearGradient id="arrowGradientBracket" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={arrowColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={arrowColor} stopOpacity="1" />
          </linearGradient>
          <marker
            id="arrowheadBracket"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill={arrowColor} />
          </marker>
        </defs>


        {/* Vertical up from source to horizontal connector */}
        <line
          x1={fromX}
          y1={fromY}
          x2={fromX}
          y2={boxCenterY}
          stroke="url(#arrowGradientBracket)"
          strokeWidth={2.5}
          strokeLinecap="butt"
        />

        {/* Horizontal connector at box center Y (from source to target) */}
        <line
          x1={fromX}
          y1={boxCenterY}
          x2={toX}
          y2={boxCenterY}
          stroke="url(#arrowGradientBracket)"
          strokeWidth={2.5}
          strokeLinecap="butt"
        />

        {/* Vertical down to target with arrowhead */}
        <line
          x1={toX}
          y1={boxCenterY}
          x2={toX}
          y2={toY}
          stroke="url(#arrowGradientBracket)"
          strokeWidth={2.5}
          strokeLinecap="butt"
          markerEnd="url(#arrowheadBracket)"
        />

        {/* Small ticks at the horizontal ends */}
        <line x1={fromX - 6} y1={boxCenterY} x2={fromX + 6} y2={boxCenterY} stroke={arrowColor} strokeWidth={2} />
        <line x1={toX - 6} y1={boxCenterY} x2={toX + 6} y2={boxCenterY} stroke={arrowColor} strokeWidth={2} />

        {/* Label box centered between the two bars */}
        <g>
          <rect x={boxX} y={finalBoxY} width={boxW} height={boxH} rx={6} fill="rgba(255,255,255,0.95)" stroke="#e2e8f0" />
          <text x={midX} y={finalBoxY + 18} textAnchor="middle" className="font-bold" fill={labelColor} fontSize={13}>
            {percentageDifference > 0 ? '+' : ''}{percentageDifference.toFixed(1)}%
          </text>
          <text x={midX} y={finalBoxY + 36} textAnchor="middle" className="text-xs" fill="#94a3b8" fontSize={10}>
            {absoluteDifference > 0 ? '+' : ''}{Math.abs(absoluteDifference).toFixed(0)}
          </text>
        </g>
      </g>
    )
  }

  const renderArrow = () => {
    switch (style) {
      case 'flowing-s':
        return renderFlowingS()
      case 'curved-arc':
        return renderCurvedArc()
      case 'angular-bracket':
        return renderAngularBracket()
      default:
        return null
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        overflow: 'visible', // allow arrows/labels to extend outside the SVG viewport if needed
      }}
      overflow="visible"
    >
      {renderArrow()}
    </svg>
  )
}
