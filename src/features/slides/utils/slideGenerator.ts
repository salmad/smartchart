/**
 * Slide generation utility with dynamic AI-style insights
 * Analyzes data to generate bespoke commentary (3-5 insights)
 */

import type { ChartConfiguration, ChartDataPoint } from '@/shared/types/chart'

export interface SlideInsight {
  text: string
}

export interface SlideContent {
  title: string
  subtitle?: string
  chartTitle: string
  chartUnits: string
  insights: SlideInsight[]
}

interface SeriesAnalysis {
  name: string
  values: number[]
  categories: (string | number)[]
  total: number
  average: number
  max: number
  min: number
  maxCategory: string | number
  minCategory: string | number
  trend: 'increasing' | 'decreasing' | 'volatile' | 'stable'
  growthRate?: number
}

interface DataAnalysis {
  series: SeriesAnalysis[]
  overallTrend: 'growth' | 'decline' | 'mixed' | 'stable'
  dominantSeries?: SeriesAnalysis
  volatileSeries?: SeriesAnalysis
  topPerformer?: SeriesAnalysis
  underperformer?: SeriesAnalysis
}

/**
 * Infer units from series names and data values
 */
// todo: use llm to infer chart units, change the function signature to accept chart data
function inferUnits(seriesNames: string[], dataPoints: ChartDataPoint[]): string {
  // Check series names for common patterns
  const seriesText = seriesNames.join(' ').toLowerCase()

  if (seriesText.includes('sales') || seriesText.includes('revenue') || seriesText.includes('price')) {
    return '$'
  }
  if (seriesText.includes('percent') || seriesText.includes('%')) {
    return '%'
  }
  if (seriesText.includes('count') || seriesText.includes('number')) {
    return 'units'
  }
  if (seriesText.includes('weight')) {
    return 'kg'
  }
  if (seriesText.includes('temperature')) {
    return '°C'
  }

  // Check if values look like currency (large numbers)
  const allValues = dataPoints.flatMap(point =>
    Object.entries(point)
      .filter(([, value]) => typeof value === 'number')
      .map(([, value]) => value as number)
  )

  const maxValue = Math.max(...allValues)
  if (maxValue > 1000) {
    return '$'
  }

  return 'units'
}

// /**
//  * Analyze a single series for trends and patterns
//  */
// function analyzeSeries(
//   dataPoints: ChartDataPoint[],
//   seriesName: string,
//   xAxisKey: string
// ): SeriesAnalysis | null {
//   const values = dataPoints.map(point => point[seriesName] as number).filter(v => typeof v === 'number')
//   const categories = dataPoints.map(point => point[xAxisKey])

//   if (values.length === 0) {
//     return null
//   }

//   const total = values.reduce((sum, val) => sum + val, 0)
//   const average = total / values.length
//   const max = Math.max(...values)
//   const min = Math.min(...values)
//   const maxIndex = values.indexOf(max)
//   const minIndex = values.indexOf(min)

//   // Calculate trend
//   let trend: 'increasing' | 'decreasing' | 'volatile' | 'stable' = 'stable'
//   let growthRate: number | undefined

//   if (values.length > 1) {
//     const firstHalf = values.slice(0, Math.floor(values.length / 2))
//     const secondHalf = values.slice(Math.floor(values.length / 2))
//     const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
//     const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

//     // Calculate volatility (coefficient of variation)
//     const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length)
//     const cv = (stdDev / average) * 100

//     if (cv > 30) {
//       trend = 'volatile'
//     } else if (secondAvg > firstAvg * 1.1) {
//       trend = 'increasing'
//       growthRate = ((secondAvg - firstAvg) / firstAvg) * 100
//     } else if (secondAvg < firstAvg * 0.9) {
//       trend = 'decreasing'
//       growthRate = ((secondAvg - firstAvg) / firstAvg) * 100
//     } else {
//       trend = 'stable'
//     }
//   }

//   return {
//     name: seriesName,
//     values,
//     categories,
//     total,
//     average,
//     max,
//     min,
//     maxCategory: categories[maxIndex],
//     minCategory: categories[minIndex],
//     trend,
//     growthRate,
//   }
// }

// /**
//  * Perform comprehensive data analysis
//  */
// function performDataAnalysis(
//   dataPoints: ChartDataPoint[],
//   seriesNames: string[],
//   xAxisKey: string
// ): DataAnalysis {
//   const series = seriesNames
//     .map(name => analyzeSeries(dataPoints, name, xAxisKey))
//     .filter((s): s is SeriesAnalysis => s !== null)

//   if (series.length === 0) {
//     return { series: [], overallTrend: 'stable' }
//   }

//   // Identify dominant series (highest total)
//   const dominantSeries = series.reduce((best, current) =>
//     current.total > best.total ? current : best
//   )

//   // Identify volatile series
//   const volatileSeries = series.find(s => s.trend === 'volatile')

//   // Identify top performer
//   const topPerformer = series.reduce((best, current) =>
//     current.average > best.average ? current : best
//   )

//   // Identify underperformer
//   const underperformer = series.length > 1 ? series.reduce((worst, current) =>
//     current.average < worst.average ? current : worst
//   ) : undefined

//   // Determine overall trend
//   const growingSeries = series.filter(s => s.trend === 'increasing').length
//   const decliningSeries = series.filter(s => s.trend === 'decreasing').length
//   const totalSeries = series.length

//   let overallTrend: 'growth' | 'decline' | 'mixed' | 'stable' = 'stable'
//   if (growingSeries > totalSeries / 2) {
//     overallTrend = 'growth'
//   } else if (decliningSeries > totalSeries / 2) {
//     overallTrend = 'decline'
//   } else if (growingSeries > 0 || decliningSeries > 0) {
//     overallTrend = 'mixed'
//   }

//   return {
//     series,
//     overallTrend,
//     dominantSeries,
//     volatileSeries,
//     topPerformer,
//     underperformer,
//   }
// }

/**
 * Generate dynamic, AI-style insights (3-5 insights, prefer 3)
 */
// todo: refactor to accept context and to generate insights by calling llm to analyse data to add more flexibility (vs fully pre-coded analysis)
function generateInsights(
  dataPoints: ChartDataPoint[],
  seriesNames: string[],
  xAxisKey: string,
  units: string
): SlideInsight[] {
  try {
    // const analysis = performDataAnalysis(dataPoints, seriesNames, xAxisKey) // todo: remove performDataAnalysis usage as it is too prescriptive, analysis should be bespoke depending on data and context

    // if (analysis.series.length === 0) {
    //   return [{ text: 'Insufficient data for meaningful analysis' }]
    // }

    // const insights: SlideInsight[] = []
    // const { series, overallTrend, dominantSeries, volatileSeries, topPerformer, underperformer } = analysis

    // // Insight 1: Overall trend and dominant pattern. todo: refactor to be more flexible and less templated
    // if (overallTrend === 'growth' && dominantSeries) {
    //   const growthDesc = dominantSeries.growthRate
    //     ? ` showing ${Math.abs(dominantSeries.growthRate).toFixed(0)}% growth`
    //     : ''
    //   insights.push({
    //     text: `Strong upward momentum across the board${growthDesc}, with ${dominantSeries.name} driving ${((dominantSeries.total / series.reduce((sum, s) => sum + s.total, 0)) * 100).toFixed(0)}% of total performance`,
    //   })
    // } else if (overallTrend === 'decline') {
    //   insights.push({
    //     text: `Performance shows declining trend, requiring strategic intervention to reverse the downward trajectory`,
    //   })
    // } else if (overallTrend === 'mixed' && dominantSeries && topPerformer) {
    //   insights.push({
    //     text: `Mixed performance landscape: ${topPerformer.name} demonstrates ${topPerformer.trend === 'increasing' ? 'consistent growth' : 'strength'} while other metrics show variability`,
    //   })
    // } else if (dominantSeries) {
    //   insights.push({
    //     text: `${dominantSeries.name} dominates with ${formatNumber(dominantSeries.total)} ${units}, representing the lion's share of overall activity`,
    //   })
    // }

    // // Insight 2: Peak performance or volatility pattern
    // if (volatileSeries && series.length > 1) {
    //   insights.push({
    //     text: `${volatileSeries.name} exhibits high volatility, suggesting either cyclical patterns or external influences worth investigating`,
    //   })
    // } else if (topPerformer && topPerformer.max > topPerformer.average * 1.5) {
    //   insights.push({
    //     text: `Notable spike in ${topPerformer.name} during ${topPerformer.maxCategory} period reaching ${formatNumber(topPerformer.max)} ${units} — a potential model for replication`,
    //   })
    // } else if (series.length > 1 && topPerformer && underperformer) {
    //   const gap = topPerformer.average - underperformer.average
    //   const gapPercent = ((gap / underperformer.average) * 100).toFixed(0)
    //   insights.push({
    //     text: `Performance gap of ${gapPercent}% between ${topPerformer.name} and ${underperformer.name} highlights opportunity for optimization`,
    //   })
    // }

    // // Insight 3: Actionable observation or trend detail (optional, only if we have good data)
    // if (insights.length < 3) {
    //   if (series.length > 1) {
    //     const stableSeries = series.filter(s => s.trend === 'stable').length
    //     if (stableSeries > 0) {
    //       insights.push({
    //         text: `${stableSeries === series.length ? 'All metrics show' : `${stableSeries} of ${series.length} metrics maintain`} steady performance, indicating operational consistency`,
    //       })
    //     }
    //   }

    //   // If still under 3, add a comparison insight
    //   if (insights.length < 3 && dominantSeries && series.length > 1) {
    //     const others = series.filter(s => s.name !== dominantSeries.name)
    //     const othersTotal = others.reduce((sum, s) => sum + s.total, 0)
    //     insights.push({
    //       text: `Combined performance of remaining categories (${formatNumber(othersTotal)} ${units}) ${othersTotal > dominantSeries.total ? 'exceeds' : 'trails'} the lead category`,
    //     })
    //   }
    // }

    return insights.slice(0, 5) // Maximum 5, prefer 3
  } catch (error) {
    console.error('Error generating insights:', error)
    return [
      { text: 'Data analysis indicates notable patterns worth deeper investigation' },
      { text: 'Performance metrics suggest areas for strategic focus' },
    ]
  }
}

/**
 * Extract context and metadata from chart data, todo: remove the fucntion
 */
function extractChartContext(
  seriesNames: string[],
  xAxisKey: string,
  dataDescription?: string
): {
  metric: string
  dimension: string
  hasTimeData: boolean
  userObjective?: string
} {
  // Determine if this is time-based data
  const xAxisName = xAxisKey.toLowerCase()
  const hasTimeData =
    xAxisName.includes('quarter') ||
    xAxisName.includes('month') ||
    xAxisName.includes('year') ||
    xAxisName.includes('date') ||
    xAxisName.includes('period')

  // Infer what we're measuring (metric)
  const seriesText = seriesNames.join(' ').toLowerCase()
  let metric = 'performance'

  if (seriesText.includes('product')) {
    metric = 'product performance'
  } else if (seriesText.includes('region') || seriesText.includes('location')) {
    metric = 'regional performance'
  } else if (seriesText.includes('sales') || seriesText.includes('revenue')) {
    metric = 'revenue'
  } else if (seriesText.includes('customer')) {
    metric = 'customer metrics'
  } else if (seriesText.includes('market')) {
    metric = 'market share'
  }

  // What dimension are we analyzing
  let dimension = xAxisKey
  if (hasTimeData) {
    dimension = 'time period'
  }

  // Extract user objective from description if provided
  let userObjective: string | undefined
  if (dataDescription) {
    const lowerDesc = dataDescription.toLowerCase()
    // Look for objective keywords
    if (lowerDesc.includes('objective:') || lowerDesc.includes('goal:') || lowerDesc.includes('aim:')) {
      const match = dataDescription.match(/(?:objective|goal|aim):\s*(.+?)(?:\.|$)/i)
      if (match) {
        userObjective = match[1].trim()
      }
    } else if (lowerDesc.includes('want to') || lowerDesc.includes('need to') || lowerDesc.includes('trying to')) {
      const match = dataDescription.match(/(?:want to|need to|trying to)\s+(.+?)(?:\.|$)/i)
      if (match) {
        userObjective = match[1].trim()
      }
    }

    // Also update metric inference from description
    if (!metric || metric === 'performance') {
      if (lowerDesc.includes('sales')) metric = 'revenue'
      else if (lowerDesc.includes('revenue')) metric = 'revenue'
      else if (lowerDesc.includes('product')) metric = 'product performance'
      else if (lowerDesc.includes('customer')) metric = 'customer metrics'
      else if (lowerDesc.includes('market')) metric = 'market share'
    }
  }

  return { metric, dimension, hasTimeData, userObjective }
}

/**
 * Generate action-oriented title (the conclusion) based on data analysis
 * This is the "so what" that the bullet points will support
 */
function generateActionTitle(
  analysis: DataAnalysis,
  context: ReturnType<typeof extractChartContext>
): string {
  const { series, overallTrend, dominantSeries, volatileSeries, topPerformer, underperformer } = analysis
  const { metric, hasTimeData, userObjective } = context

  if (series.length === 0) {
    return 'Further analysis required to determine strategic direction'
  }

  // Growth scenario - focus on scaling winner
  if (overallTrend === 'growth' && dominantSeries && dominantSeries.growthRate && dominantSeries.growthRate > 15) {
    return userObjective
      ? `Prioritize ${dominantSeries.name} to ${userObjective.toLowerCase()}`
      : `Prioritize ${dominantSeries.name} to capitalize on ${Math.abs(dominantSeries.growthRate).toFixed(0)}% growth momentum`
  }

  // Strong performer - investment recommendation
  if (topPerformer && topPerformer.trend === 'increasing' && series.length > 1) {
    return `Scale ${topPerformer.name} operations to replicate success across portfolio`
  }

  // Volatility - stabilization needed
  if (volatileSeries && series.length > 1) {
    return `Address ${volatileSeries.name} volatility to improve ${metric} predictability`
  }

  // Performance gap - optimization opportunity
  if (series.length > 1 && topPerformer && underperformer) {
    const gap = topPerformer.average - underperformer.average
    const gapPercent = ((gap / underperformer.average) * 100)
    if (gapPercent > 50) {
      return `Bridge ${gapPercent.toFixed(0)}% performance gap between ${topPerformer.name} and ${underperformer.name}`
    }
  }

  // Decline scenario - intervention needed
  if (overallTrend === 'decline') {
    return `Implement turnaround strategy to reverse declining ${metric} trend`
  }

  // Mixed performance - focus recommendation
  if (overallTrend === 'mixed' && dominantSeries) {
    return `Consolidate focus on ${dominantSeries.name} while optimizing underperformers`
  }

  // Dominance scenario - maintain or diversify
  if (dominantSeries && series.length > 1) {
    const dominancePercent = (dominantSeries.total / series.reduce((sum, s) => sum + s.total, 0)) * 100
    if (dominancePercent > 60) {
      return `Diversify beyond ${dominantSeries.name} to reduce ${dominancePercent.toFixed(0)}% concentration risk`
    } else {
      return `Maintain ${dominantSeries.name} leadership while growing secondary categories`
    }
  }

  // Stable performance - optimization or growth
  if (overallTrend === 'stable' && topPerformer) {
    return `Leverage stable ${metric} foundation to pursue strategic growth initiatives`
  }

  // Fallback - generic but still action-oriented
  return hasTimeData
    ? `Accelerate ${metric} growth through targeted resource allocation`
    : `Optimize ${metric} across all categories for maximum efficiency`
}

/**
 * Format number with commas for readability
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/**
 * Generate slide content from chart configuration
 */
export function generateSlideContent(config: ChartConfiguration): SlideContent {
  const { data, styling } = config
  const { dataPoints, xAxisKey, seriesNames, description } = data

  // Filter out hidden series
  const visibleSeries = seriesNames.filter(
    name => !styling.hiddenSeries.includes(name)
  )

  // Infer units and context
  const units = inferUnits(data) 
  // const context = extractChartContext(visibleSeries, xAxisKey, description)

    // Generate insights (supporting evidence for the action title)
  const insights = generateInsights(data) // todo : lets use simply chart settings and then generate insights with llm inside the function
  
  // // Perform analysis - todo: remove as it was too complex and too templated
  // const analysis = performDataAnalysis(dataPoints, visibleSeries, xAxisKey)

  // Generate action-oriented title (the conclusion), todo: i want to change the signature of the function to accept insights
  const {actionTitle, subtitle} = generateActionTitle(insights, data)

  // Generate chart title (descriptive, not action)
  const chartTitle = styling.title || `${visibleSeries.join(', ')} by ${xAxisKey}`



  return {
    title: actionTitle,
    subtitle: subtitle || undefined,
    chartTitle,
    chartUnits: units,
    insights,
  }
}
